import { afterEach, describe, expect, it } from 'vitest';
import { io, type Socket } from 'socket.io-client';
import { RoomStore, type RoomState } from '@the-table/game';
import { RoomStoreAdapter, type Deadline } from '../src/game-adapter.js';
import { createTableServer, type TableServer } from '../src/server.js';
import { ProtocolError, type GameCommand } from '../src/protocol.js';
import type { Clock, RuntimeOptions } from '../src/runtime.js';

class ManualClock implements Clock {
  value = 10_000;
  private next = 0;
  readonly tasks = new Map<number, { at: number; callback: () => void }>();
  now = () => this.value;
  setTimeout = (callback: () => void, delay: number): ReturnType<typeof setTimeout> => {
    const id = ++this.next;
    this.tasks.set(id, { at: this.value + delay, callback });
    return id as unknown as ReturnType<typeof setTimeout>;
  };
  clearTimeout = (timer: ReturnType<typeof setTimeout>) => { this.tasks.delete(timer as unknown as number); };
  advance(ms: number, wake = true): void {
    this.value += ms;
    if (!wake) return;
    for (const [id, task] of [...this.tasks]) if (task.at <= this.value) { this.tasks.delete(id); task.callback(); }
  }
}

/** Minimal deterministic engine double; real game integration has a separate suite. */
class TestGame extends RoomStoreAdapter {
  calls = 0;
  expirations = 0;
  pending = new Map<string, { targetId: string; deadline: Deadline }>();
  gate: Promise<void> | undefined;
  waiting = false;
  constructor(readonly clock: ManualClock) { super(new RoomStore({ now: clock.now, issueSessions: false })); }
  override async command(code: string, actorId: string, command: GameCommand): Promise<void> {
    if (this.gate) { this.waiting = true; await this.gate; this.waiting = false; }
    this.calls += 1;
    const room = this.read(code)!;
    if (command.type === 'CLAIM_ROLE') { this.store.claimRole(code, actorId, String(command.payload.roleId)); return; }
    if (command.type === 'START_MATCH') room.status = 'PLAYING';
    else if (command.type === 'RESULTS') room.status = 'RESULTS';
    else if (command.type === 'REMATCH') {
      if (room.hostPlayerId !== actorId) throw new ProtocolError('NOT_HOST', 'Only the host can rematch.');
      if (room.status !== 'RESULTS') throw new ProtocolError('WRONG_PHASE', 'Finish first.');
      room.status = 'LOBBY';
      for (const player of room.players) { player.life = 'ACTIVE'; delete player.objective; }
    } else if (command.type === 'PENDING') {
      this.pending.set(code, { targetId: String(command.payload.targetId), deadline: { id: 'interaction', at: this.clock.now() + 30_000 } });
    } else if (command.type !== 'TOUCH') throw new ProtocolError('UNKNOWN_COMMAND', 'Unknown.');
    room.revision += 1;
    room.updatedAt = this.clock.now();
  }
  override setConnected(code: string, playerId: string, connected: boolean, now: number): void {
    // This transport double has no real match/objectives; keep its connection
    // transition local instead of invoking production objective evaluation.
    const room = this.read(code)!;
    const player = room.players.find(candidate => candidate.id === playerId)!;
    player.connection = connected ? 'CONNECTED' : 'DISCONNECTED';
    room.revision += 1; room.updatedAt = now;
    if (!connected && this.pending.get(code)?.targetId === playerId) this.pending.delete(code);
  }
  override deadlines(code: string): Deadline[] { const pending = this.pending.get(code); return pending ? [pending.deadline] : []; }
  override timeout(code: string): void {
    this.pending.delete(code);
    this.expirations += 1;
    this.read(code)!.revision += 1;
  }
  override project(code: string, playerId: string, spectator: boolean): unknown {
    const room = this.read(code)!;
    const owner = room.players.find(player => player.id === playerId)!;
    const view = this.store.viewFor(code, playerId);
    if (spectator) {
      if (owner.life !== 'DEAD' && owner.life !== 'EXITED') throw new Error('Unverified spectator');
      return { public: view.public, players: structuredClone(room.players), capabilities: [] };
    }
    return { public: view.public, private: { ...view.private, blackMarket: [{ id: `${playerId}-secret-market` }], inspections: [{ text: `${playerId}-secret-inspection` }] } };
  }
  override destroy(code: string): void { super.destroy(code); this.pending.delete(code); }
}

const running: TableServer[] = [];
const clients: Socket[] = [];
afterEach(async () => {
  for (const socket of clients.splice(0)) socket.disconnect();
  await Promise.all(running.splice(0).map(server => server.close()));
});

async function fixture(options: RuntimeOptions = {}) {
  const clock = new ManualClock();
  const game = new TestGame(clock);
  const errors: unknown[] = [];
  const server = createTableServer({ game, clock, onError: error => errors.push(error), ...options });
  running.push(server);
  const url = await server.listen();
  const connect = async () => {
    const socket = io(url, { transports: ['websocket'], reconnection: false, forceNew: true });
    clients.push(socket);
    await new Promise<void>((resolve, reject) => { socket.once('connect', resolve); socket.once('connect_error', reject); });
    return socket;
  };
  return { server, game, clock, errors, url, connect };
}
async function request(socket: Socket, event: string, input: unknown = {}): Promise<any> {
  return socket.timeout(3000).emitWithAck(event, input);
}
async function success(socket: Socket, event: string, input: unknown = {}): Promise<any> {
  const result = await request(socket, event, input);
  expect(result.ok, JSON.stringify(result)).toBe(true);
  return result.data;
}
function command(socket: Socket, key: string, type = 'TOUCH', payload: Record<string, unknown> = {}, extra: Record<string, unknown> = {}) {
  return request(socket, 'room:command', { idempotencyKey: key, type, payload, ...extra });
}
async function pair(options: RuntimeOptions = {}) {
  const f = await fixture(options);
  const a = await f.connect();
  const host = await success(a, 'room:create', { name: 'Alice' });
  const b = await f.connect();
  const guest = await success(b, 'room:join', { code: host.view.public.code, name: 'Bob' });
  const code = host.view.public.code as string;
  return { ...f, a, b, host, guest, code };
}
async function eventually(assertion: () => void) {
  await expect.poll(() => { try { assertion(); return true; } catch { return false; } }, { timeout: 2000, interval: 5 }).toBe(true);
}

// These exercise actual Socket.IO handshakes, packets, acks, disconnects and rebinding.
describe('realtime privacy and session authority', () => {
  it('does not disclose TURN credentials before room authentication', async () => {
    const f = await fixture({
      voiceEnabled: true,
      voiceIceServers: [{ urls: 'turns:relay.example.test:5349', username: 'scoped-user', credential: 'secret' }],
    });
    const socket = io(f.url, { transports: ['websocket'], reconnection: false, forceNew: true, autoConnect: false });
    clients.push(socket);
    const capabilities: unknown[] = [];
    socket.on('server:capabilities', value => capabilities.push(value));
    const connected = new Promise<void>((resolve, reject) => { socket.once('connect', resolve); socket.once('connect_error', reject); });
    socket.connect();
    await connected;
    await new Promise(resolve => setImmediate(resolve));
    expect(capabilities).toEqual([]);

    const admitted = await success(socket, 'room:create', { name: 'Alice' });
    expect(admitted.voice.iceServers[0].credential).toBe('secret');
    await eventually(() => expect(capabilities).toEqual([{ voice: admitted.voice }]));
  });

  it('isolates every private projection, public event, inspection and private message', async () => {
    const f = await pair();
    const room = f.game.read(f.code)!;
    const hostId = f.host.view.private.playerId;
    const guestId = f.guest.view.private.playerId;
    room.players[0]!.objective = { objectiveId: 'HOST-OBJECTIVE-SENTINEL', progress: {}, status: 'ACTIVE', rewardGranted: false };
    room.players[0]!.inventory.pockets[0]!.item = { instanceId: 'HOST-POCKET-SENTINEL', itemId: 'poison', quantity: 1 };
    room.players[1]!.objective = { objectiveId: 'GUEST-OBJECTIVE-SENTINEL', progress: {}, status: 'ACTIVE', rewardGranted: false };
    const aViews: unknown[] = [], bViews: unknown[] = [], publicViews: unknown[] = [];
    f.a.on('room:view', value => aViews.push(value));
    f.b.on('room:view', value => bViews.push(value));
    f.a.on('room:public', value => publicViews.push(value));
    f.b.on('room:public', value => publicViews.push(value));
    await command(f.a, 'touch');
    const guestView = (await success(f.b, 'room:sync')).view;
    expect(JSON.stringify(guestView)).not.toContain('HOST-OBJECTIVE-SENTINEL');
    expect(JSON.stringify(guestView)).not.toContain('HOST-POCKET-SENTINEL');
    expect(JSON.stringify(guestView)).not.toContain(`${hostId}-secret-market`);
    expect(JSON.stringify(guestView)).not.toContain(`${hostId}-secret-inspection`);
    expect(JSON.stringify(bViews)).not.toContain('HOST-');
    expect(JSON.stringify(aViews)).not.toContain('GUEST-OBJECTIVE');
    expect(JSON.stringify(publicViews)).not.toContain('SENTINEL');
    const c = await f.connect();
    await success(c, 'room:join', { code: f.code, name: 'Carol' });
    await success(f.a, 'chat:send', { idempotencyKey: 'private-chat', text: 'PRIVATE-CHAT-SENTINEL', toPlayerId: guestId });
    expect(JSON.stringify((await success(f.b, 'room:sync')).view)).toContain('PRIVATE-CHAT-SENTINEL');
    expect(JSON.stringify((await success(c, 'room:sync')).view)).not.toContain('PRIVATE-CHAT-SENTINEL');
    expect(JSON.stringify(publicViews)).not.toContain('PRIVATE-CHAT-SENTINEL');
  });

  it('gates spectator projections on permanent life state and denies communications', async () => {
    const f = await pair({ voiceEnabled: true });
    expect((await request(f.b, 'room:spectate')).error.code).toBe('SPECTATOR_FORBIDDEN');
    f.game.read(f.code)!.players[1]!.life = 'DOWNED';
    expect((await request(f.b, 'room:spectate')).error.code).toBe('SPECTATOR_FORBIDDEN');
    f.game.read(f.code)!.players[1]!.life = 'DEAD';
    const view = (await success(f.b, 'room:spectate')).view;
    expect(view.players).toHaveLength(2);
    expect(view.capabilities).toEqual([]);
    expect((await command(f.b, 'spectator-action')).error.code).toBe('SPECTATOR_READ_ONLY');
    expect((await request(f.b, 'chat:send', { idempotencyKey: 'spectator-chat', text: 'hello' })).error.code).toBe('SPECTATOR_READ_ONLY');
    expect((await request(f.b, 'voice:join')).error.code).toBe('VOICE_FORBIDDEN');
    expect((await request(f.b, 'voice:signal', { toPlayerId: f.host.view.private.playerId, signal: { type: 'offer', sdp: 'hi' } })).error.code).toBe('VOICE_FORBIDDEN');
  });

  it('rotates tokens, disconnects the old socket, preserves the seat and rejects stale tokens', async () => {
    const f = await pair();
    const replacement = await f.connect();
    const rejoined = await success(replacement, 'room:reconnect', { code: f.code, reconnectToken: f.host.reconnectToken });
    expect(rejoined.reconnectToken).not.toBe(f.host.reconnectToken);
    expect(rejoined.view.private.playerId).toBe(f.host.view.private.playerId);
    expect(rejoined.view.public.players[0].seat).toBe(0);
    await eventually(() => expect(f.a.connected).toBe(false));
    const attacker = await f.connect();
    expect((await request(attacker, 'room:reconnect', { code: f.code, reconnectToken: f.host.reconnectToken })).error.code).toBe('INVALID_SESSION');
    expect(f.game.read(f.code)!.players[0]!.connection).toBe('CONNECTED');
    expect((await command(replacement, 'new-socket-action')).ok).toBe(true);
  });

  it('replays an accepted reconnect acknowledgement without rotating the token twice', async () => {
    const f = await pair();
    const replacement = await f.connect();
    const requestId = 'restore-ack-loss';
    const first = await success(replacement, 'room:reconnect', { code: f.code, reconnectToken: f.host.reconnectToken, idempotencyKey: requestId });
    const replaySocket = await f.connect();
    const replay = await success(replaySocket, 'room:reconnect', { code: f.code, reconnectToken: f.host.reconnectToken, idempotencyKey: requestId });
    expect(replay.reconnectToken).toBe(first.reconnectToken);
    expect(replay.playerId).toBe(first.playerId);
    expect(replay.view.private.playerId).toBe(first.playerId);
    await eventually(() => expect(replacement.connected).toBe(false));
    expect((await command(replaySocket, 'after-lost-ack')).ok).toBe(true);
  });

  it('fences an old socket command queued behind a reconnect', async () => {
    const f = await pair();
    let release!: () => void;
    f.game.gate = new Promise<void>(resolve => { release = resolve; });
    const first = command(f.a, 'first');
    await eventually(() => expect(f.game.waiting).toBe(true));
    const c = await f.connect();
    const observed = new Promise<void>(resolve => f.server.io.sockets.sockets.get(c.id!)!.once('room:reconnect', () => resolve()));
    const reconnect = request(c, 'room:reconnect', { code: f.code, reconnectToken: f.host.reconnectToken });
    await observed;
    f.a.emit('room:command', { idempotencyKey: 'stale-queued', type: 'TOUCH', payload: {} });
    release();
    expect((await first).ok).toBe(true);
    expect((await reconnect).ok).toBe(true);
    await success(c, 'room:sync');
    expect(f.game.calls).toBe(1);
  });

  it('permits only one winner when reconnect tokens race', async () => {
    const f = await pair();
    const c = await f.connect(), d = await f.connect();
    const results = await Promise.all([c, d].map(socket => request(socket, 'room:reconnect', { code: f.code, reconnectToken: f.guest.reconnectToken })));
    expect(results.filter(result => result.ok)).toHaveLength(1);
    expect(results.filter(result => !result.ok)[0].error.code).toBe('INVALID_SESSION');
    expect(f.game.read(f.code)!.players[1]!.connection).toBe('CONNECTED');
  });

  it('prevents socket room switching and forged identity fields', async () => {
    const f = await pair();
    expect((await request(f.a, 'room:create', { name: 'Other' })).error.code).toBe('ALREADY_JOINED');
    expect((await request(f.a, 'room:join', { code: f.code, name: 'Third' })).error.code).toBe('ALREADY_JOINED');
    expect((await command(f.b, 'spoof', 'TOUCH', {}, { actorId: f.host.view.private.playerId })).error.code).toBe('INVALID_INPUT');
    expect((await command(f.b, 'wrong-room', 'TOUCH', {}, { roomId: 'not-this-room' })).error.code).toBe('INVALID_ROOM');
    expect((await request(f.b, 'room:spectate', { playerId: f.host.view.private.playerId })).error.code).toBe('INVALID_INPUT');
  });
});

describe('serialized mutations, idempotency and lifecycle', () => {
  it('releases a guest lobby seat, role, name and reconnect authority for reuse', async () => {
    const f = await pair({ voiceEnabled: true });
    await success(f.b, 'lobby:claim-role', { idempotencyKey: 'guest-role', roleId: 'medic' });
    const peerUpdates: Array<{ playerIds: string[] }> = [];
    f.a.on('voice:peers', value => peerUpdates.push(value));
    await success(f.a, 'voice:join');
    await success(f.b, 'voice:join');

    expect(await success(f.b, 'lobby:leave')).toEqual({ left: true });
    expect(await success(f.b, 'lobby:leave')).toEqual({ left: true });
    expect(f.game.read(f.code)!.players.map(player => player.id)).toEqual([f.host.view.private.playerId]);
    await eventually(() => expect(peerUpdates.at(-1)?.playerIds).toEqual([f.host.view.private.playerId]));

    const stale = await f.connect();
    expect((await request(stale, 'room:reconnect', { code: f.code, reconnectToken: f.guest.reconnectToken })).error.code).toBe('INVALID_SESSION');

    const rejoined = await success(f.b, 'room:join', { code: f.code, name: 'Bob' });
    expect(rejoined.view.public.players.find((player: any) => player.name === 'Bob').seat).toBe(1);
    expect((await request(f.b, 'lobby:claim-role', { idempotencyKey: 'reused-role', roleId: 'medic' })).ok).toBe(true);
  });

  it('hands host ownership to the lowest-seat connected player without renumbering seats', async () => {
    const f = await pair();
    const c = await f.connect();
    const carol = await success(c, 'room:join', { code: f.code, name: 'Carol' });

    expect(await success(f.a, 'lobby:leave')).toEqual({ left: true });
    const room = f.game.read(f.code)!;
    expect(room.hostPlayerId).toBe(f.guest.view.private.playerId);
    expect(room.players.map(player => [player.id, player.seat])).toEqual([
      [f.guest.view.private.playerId, 1],
      [carol.view.private.playerId, 2],
    ]);
    expect((await success(f.b, 'room:sync')).view.public.hostPlayerId).toBe(f.guest.view.private.playerId);

    const replacement = await success(f.a, 'room:join', { code: f.code, name: 'Alice Again' });
    expect(replacement.view.public.players.find((player: any) => player.name === 'Alice Again').seat).toBe(0);
    expect(f.game.read(f.code)!.players.map(player => player.seat)).toEqual([0, 1, 2]);
  });

  it('skips a disconnected lower seat when selecting the next host', async () => {
    const f = await pair();
    const c = await f.connect();
    const carol = await success(c, 'room:join', { code: f.code, name: 'Carol' });
    f.b.disconnect();
    await eventually(() => expect(f.game.read(f.code)!.players.find(player => player.id === f.guest.view.private.playerId)?.connection).toBe('DISCONNECTED'));

    await success(f.a, 'lobby:leave');
    const room = f.game.read(f.code)!;
    expect(room.hostPlayerId).toBe(carol.view.private.playerId);
    expect(room.players.map(player => [player.seat, player.connection])).toEqual([
      [1, 'DISCONNECTED'],
      [2, 'CONNECTED'],
    ]);
    expect((await success(c, 'room:sync')).view.public.hostPlayerId).toBe(carol.view.private.playerId);
  });

  it('destroys an empty lobby and lets the same socket create another room', async () => {
    const f = await fixture();
    const a = await f.connect();
    const original = await success(a, 'room:create', { name: 'Alice' });
    const originalCode = original.view.public.code as string;

    expect(await success(a, 'lobby:leave')).toEqual({ left: true });
    expect(f.server.runtime.roomCount).toBe(0);
    expect(f.game.read(originalCode)).toBeUndefined();

    const replacement = await success(a, 'room:create', { name: 'Alice' });
    expect(replacement.view.public.code).not.toBe(originalCode);
    const stale = await f.connect();
    expect((await request(stale, 'room:reconnect', { code: originalCode, reconnectToken: original.reconnectToken })).error.code).toBe('ROOM_NOT_FOUND');
  });

  it('rejects lobby leave after the match starts without changing the seat or session', async () => {
    const f = await pair();
    await command(f.a, 'start', 'START_MATCH');
    const before = structuredClone(f.game.read(f.code)!);

    const rejected = await request(f.b, 'lobby:leave');
    expect(rejected.error.code).toBe('NOT_IN_LOBBY');
    expect(f.game.read(f.code)).toEqual(before);
    expect((await request(f.b, 'room:sync')).ok).toBe(true);

    f.b.disconnect();
    await eventually(() => expect(f.game.read(f.code)!.players.find(player => player.id === f.guest.view.private.playerId)?.connection).toBe('DISCONNECTED'));
    const replacement = await f.connect();
    const reconnected = await success(replacement, 'room:reconnect', { code: f.code, reconnectToken: f.guest.reconnectToken });
    expect(reconnected.playerId).toBe(f.guest.view.private.playerId);
    expect(reconnected.view.public.players.find((player: any) => player.id === reconnected.playerId).seat).toBe(1);
  });

  it('serializes simultaneous role claims and rejects stale revisions', async () => {
    const f = await pair();
    const results = await Promise.all([f.a, f.b].map(socket => request(socket, 'lobby:claim-role', { idempotencyKey: 'role', roleId: 'medic' })));
    expect(results.filter(result => result.ok)).toHaveLength(1);
    expect(results.find(result => !result.ok).error.code).toBe('ROLE_TAKEN');
    const stale = await command(f.a, 'stale', 'TOUCH', {}, { expectedRevision: 1 });
    expect(stale.error.code).toBe('STALE_REVISION');
    expect(stale.error.revision).toBe(f.game.read(f.code)!.revision);
  });

  it('applies duplicates once, keeps prior outcomes on reconnect, and rejects key conflicts', async () => {
    const f = await pair();
    const first = await command(f.a, 'same-key');
    const duplicate = await command(f.a, 'same-key');
    expect(duplicate).toEqual(first);
    expect(f.game.calls).toBe(1);
    expect((await command(f.a, 'same-key', 'START_MATCH')).error.code).toBe('IDEMPOTENCY_CONFLICT');
    const c = await f.connect();
    await success(c, 'room:reconnect', { code: f.code, reconnectToken: f.host.reconnectToken });
    expect(await command(c, 'same-key')).toEqual(first);
    expect(f.game.calls).toBe(1);
    expect((await command(f.b, 'same-key')).ok).toBe(true);
    expect(f.game.calls).toBe(2);
  });

  it('does not evict receipts and silently reapply old actions at the memory limit', async () => {
    const f = await pair({ maxCommandsPerRoom: 1 });
    const first = await command(f.a, 'one');
    expect((await command(f.a, 'two')).error.code).toBe('COMMAND_LIMIT');
    expect(await command(f.a, 'one')).toEqual(first);
    expect(f.game.calls).toBe(1);
  });

  it('processes absolute deadlines before a late player command even without a scheduler wake', async () => {
    const f = await pair();
    await command(f.a, 'start', 'START_MATCH');
    await command(f.a, 'pending', 'PENDING', { targetId: f.guest.view.private.playerId });
    f.clock.advance(30_001, false);
    await success(f.a, 'room:sync');
    expect(f.game.expirations).toBe(1);
    expect(f.game.pending.size).toBe(0);
    f.clock.advance(1);
    await success(f.a, 'room:sync');
    expect(f.game.expirations).toBe(1);
  });

  it('cancels a disconnected target before automatic response resolution', async () => {
    const f = await pair();
    await command(f.a, 'start', 'START_MATCH');
    await command(f.a, 'pending', 'PENDING', { targetId: f.guest.view.private.playerId });
    f.b.disconnect();
    await eventually(() => expect(f.game.read(f.code)!.players[1]!.connection).toBe('DISCONNECTED'));
    f.clock.advance(31_000);
    await success(f.a, 'room:sync');
    expect(f.game.expirations).toBe(0);
    expect(f.game.pending.size).toBe(0);
  });

  it('cancels before a timeout already queued ahead of the disconnect callback', async () => {
    const f = await pair();
    await command(f.a, 'start', 'START_MATCH');
    await command(f.a, 'pending', 'PENDING', { targetId: f.guest.view.private.playerId });
    let release!: () => void;
    f.game.gate = new Promise<void>(resolve => { release = resolve; });
    const blocked = command(f.a, 'blocked');
    await eventually(() => expect(f.game.waiting).toBe(true));
    f.clock.advance(30_001);
    f.server.io.sockets.sockets.get(f.b.id!)!.disconnect(true);
    release();
    await blocked;
    await success(f.a, 'room:sync');
    expect(f.game.expirations).toBe(0);
    expect(f.game.pending.size).toBe(0);
    expect(f.game.read(f.code)!.players[1]!.connection).toBe('DISCONNECTED');
  });

  it('expires inactive rooms, clears timers, and invalidates stored reconnect tokens', async () => {
    const f = await pair({ lobbyTtlMs: 100 });
    let reason = '';
    f.a.on('room:closed', value => { reason = value.reason; });
    f.clock.advance(101);
    await eventually(() => expect(f.server.runtime.roomCount).toBe(0));
    await eventually(() => expect(reason).toBe('ROOM_EXPIRED'));
    expect(f.clock.tasks.size).toBe(0);
    const c = await f.connect();
    expect((await request(c, 'room:reconnect', { code: f.code, reconnectToken: f.host.reconnectToken })).error.code).toBe('ROOM_NOT_FOUND');
    expect((await request(f.a, 'room:create', { name: 'New host' })).ok).toBe(true);
  });

  it('uses active/results TTLs and clears match chat on host rematch', async () => {
    const f = await pair({ lobbyTtlMs: 100, activeTtlMs: 1000, resultsTtlMs: 200 });
    await command(f.a, 'start', 'START_MATCH');
    f.clock.advance(101);
    expect((await request(f.a, 'room:sync')).ok).toBe(true);
    await success(f.a, 'chat:send', { idempotencyKey: 'chat', text: 'old match' });
    await command(f.a, 'results', 'RESULTS');
    expect((await request(f.b, 'room:rematch', { idempotencyKey: 'guest-rematch' })).error.code).toBe('NOT_HOST');
    f.game.read(f.code)!.players[0]!.life = 'EXITED';
    expect((await request(f.a, 'room:rematch', { idempotencyKey: 'rematch' })).ok).toBe(true);
    expect((await success(f.a, 'room:sync')).view.messages).toEqual([]);
    expect(f.game.read(f.code)!.status).toBe('LOBBY');
    expect(f.game.read(f.code)!.players).toHaveLength(2);
  });

  it('survives malformed packets without ack callbacks and rate limits floods', async () => {
    const f = await fixture({ rateLimit: { requests: 3, windowMs: 1000 } });
    const a = await f.connect();
    a.emit('room:create', { invalid: true });
    expect((await request(a, 'room:create', { name: 'Alice' })).ok).toBe(true);
    expect((await request(a, 'room:command', { type: 'TOUCH' })).error.code).toBe('INVALID_INPUT');
    expect((await request(a, 'room:sync')).error.code).toBe('RATE_LIMITED');
    f.clock.advance(1001);
    expect((await request(a, 'room:sync')).ok).toBe(true);
    expect(f.errors).toEqual([]);
  });

  it('routes voice only to a connected living peer in the same room', async () => {
    const f = await pair({ voiceEnabled: true });
    const c = await f.connect();
    const outsider = await success(c, 'room:create', { name: 'Carol' });
    const signals: unknown[] = [], outsiderSignals: unknown[] = [];
    f.b.on('voice:signal', value => signals.push(value));
    c.on('voice:signal', value => outsiderSignals.push(value));
    const signal = { type: 'offer', sdp: 'private peer SDP' };
    expect(f.host.voice).toEqual({ enabled: true, iceServers: [], relayConfigured: false });
    expect((await request(f.a, 'voice:signal', { toPlayerId: f.guest.view.private.playerId, signal })).error.code).toBe('VOICE_FORBIDDEN');
    expect((await request(f.a, 'voice:join')).ok).toBe(true);
    expect((await request(f.b, 'voice:join')).ok).toBe(true);
    expect((await request(f.a, 'voice:signal', { toPlayerId: f.guest.view.private.playerId, signal })).ok).toBe(true);
    await eventually(() => expect(signals).toHaveLength(1));
    expect(signals[0]).toEqual({ fromPlayerId: f.host.view.private.playerId, signal });
    expect((await request(f.b, 'voice:leave')).ok).toBe(true);
    expect((await request(f.a, 'voice:signal', { toPlayerId: f.guest.view.private.playerId, signal })).error.code).toBe('VOICE_FORBIDDEN');
    expect((await request(f.a, 'voice:signal', { toPlayerId: outsider.view.private.playerId, signal })).error.code).toBe('VOICE_FORBIDDEN');
    expect(outsiderSignals).toEqual([]);
  });

  it('keeps Downed text and opted-in voice available without admitting spectators', async () => {
    const f = await pair({ voiceEnabled: true });
    const hostId = f.host.view.private.playerId;
    const guestId = f.guest.view.private.playerId;
    const downed = f.game.read(f.code)!.players[1]!;
    downed.life = 'DOWNED'; downed.hp = 0;
    downed.downed = { aggressorId: hostId, downedAt: f.clock.now(), eventId: 'test-down', expiresRound: 1, expiresSeat: 0 };
    await success(f.b, 'chat:send', { idempotencyKey: 'downed-text', text: 'Please help me.', toPlayerId: hostId });
    expect(JSON.stringify((await success(f.a, 'room:sync')).view.messages)).toContain('Please help me.');
    await success(f.a, 'voice:join'); await success(f.b, 'voice:join');
    const signals: unknown[] = [];
    f.a.on('voice:signal', signal => signals.push(signal));
    await success(f.b, 'voice:signal', { toPlayerId: hostId, signal: { type: 'offer', sdp: 'rescue-negotiation' } });
    await eventually(() => expect(signals).toHaveLength(1));
    expect(signals[0]).toMatchObject({ fromPlayerId: guestId });
    expect((await request(f.b, 'room:spectate')).error.code).toBe('SPECTATOR_FORBIDDEN');
    expect(f.errors).toEqual([]);
  });
});
