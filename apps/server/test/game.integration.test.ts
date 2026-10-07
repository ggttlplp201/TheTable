import { afterEach, describe, expect, it } from 'vitest';
import { io, type Socket } from 'socket.io-client';
import { RoomStore, type RoleId } from '@the-table/game';
import { RoomStoreAdapter } from '../src/game-adapter.js';
import { createTableServer, type TableServer } from '../src/server.js';
import type { Clock } from '../src/runtime.js';

class EngineClock implements Clock {
  value = 1_000_000;
  now = () => this.value;
  setTimeout = (callback: () => void, delay: number) => setTimeout(callback, delay);
  clearTimeout = (timer: ReturnType<typeof setTimeout>) => clearTimeout(timer);
}
const servers: TableServer[] = [];
const sockets: Socket[] = [];
afterEach(async () => {
  for (const socket of sockets.splice(0)) socket.disconnect();
  await Promise.all(servers.splice(0).map(server => server.close()));
});
let key = 0;
async function req(socket: Socket, event: string, input: unknown = {}): Promise<any> {
  return socket.timeout(3000).emitWithAck(event, input);
}
async function ok(socket: Socket, event: string, input: unknown = {}): Promise<any> {
  const reply = await req(socket, event, input);
  expect(reply.ok, JSON.stringify(reply)).toBe(true);
  return reply.data;
}
function send(socket: Socket, type: string, payload: Record<string, unknown> = {}, idempotencyKey = `command-${++key}`) {
  return req(socket, 'room:command', { idempotencyKey, type, payload });
}
async function match(count = 3) {
  const clock = new EngineClock();
  const store = new RoomStore({ now: clock.now, issueSessions: false });
  const game = new RoomStoreAdapter(store, () => 42);
  const errors: unknown[] = [];
  const server = createTableServer({ game, clock, onError: error => errors.push(error) });
  servers.push(server);
  const url = await server.listen();
  const connect = async () => {
    const socket = io(url, { transports: ['websocket'], reconnection: false, forceNew: true });
    sockets.push(socket);
    await new Promise<void>((resolve, reject) => { socket.once('connect', resolve); socket.once('connect_error', reject); });
    return socket;
  };
  const peers: Socket[] = [];
  const admissions: any[] = [];
  let code = '';
  for (let index = 0; index < count; index += 1) {
    const socket = await connect(); peers.push(socket);
    const admission = await ok(socket, index === 0 ? 'room:create' : 'room:join', { name: `Player ${index}`, ...(index === 0 ? {} : { code }) });
    admissions.push(admission); code = admission.view.public.code;
    const roles: RoleId[] = ['enforcer', 'medic', 'smuggler', 'locksmith'];
    await ok(socket, 'lobby:claim-role', { idempotencyKey: `role-${index}`, roleId: roles[index] });
    await ok(socket, 'lobby:ready', { idempotencyKey: `ready-${index}`, ready: true });
  }
  await ok(peers[0]!, 'match:start', { idempotencyKey: 'start' });
  const room = () => store.rooms.get(code)!;
  const peer = (playerId: string) => peers[room().players.findIndex(player => player.id === playerId)]!;
  return { server, store, game, clock, peers, admissions, code, room, peer, connect, errors };
}

describe('Socket.IO with the authoritative game engine', () => {
  it.each([2, 3, 4])('starts a %i-player match with owner-only objectives and server deadlines', async count => {
    const f = await match(count);
    const room = f.room();
    expect(room.status).toBe('PLAYING');
    expect(room.turn!.deadlineAt).toBe(f.clock.now() + 60_000);
    expect(new Set(room.players.map(player => player.objective!.objectiveId)).size).toBe(count);
    for (const player of room.players) {
      const view = (await ok(f.peer(player.id), 'room:sync')).view;
      expect(view.private.objective.objectiveId).toBe(player.objective!.objectiveId);
      expect(JSON.stringify(view.public)).not.toContain('objectiveId');
      for (const other of room.players.filter(other => other.id !== player.id)) {
        expect(JSON.stringify(view)).not.toContain(other.objective!.objectiveId);
      }
    }
    expect(f.errors).toEqual([]);
  });

  it('locks a proposed trade and applies timeout acceptance exactly once', async () => {
    const f = await match();
    const actor = f.room().players.find(player => player.seat === f.room().turn!.activeSeat)!;
    const target = f.room().players.find(player => player.id !== actor.id)!;
    const requested = target.inventory.visible.find(item => item)!;
    const trade = { targetId: target.id, offeredItems: [], offeredCoins: 0, requestedItems: [requested.instanceId], requestedCoins: 0 };
    const initial = await send(f.peer(actor.id), 'TRADE', trade, 'trade-once');
    expect(initial.ok).toBe(true);
    expect(f.room().turn!.pausedRemainingMs).toBeDefined();
    expect((await send(f.peer(actor.id), 'END_TURN')).error.code).toBe('LOCKED');
    f.clock.value += 30_000;
    const late = await send(f.peer(target.id), 'RESPOND_TRADE', { accept: false });
    expect(late.ok).toBe(false);
    expect(f.room().pendingTrade).toBeUndefined();
    expect(f.room().players.find(player => player.id === actor.id)!.inventory.visible.some(item => item?.instanceId === requested.instanceId)).toBe(true);
    expect(f.room().players.find(player => player.id === target.id)!.inventory.visible.some(item => item?.instanceId === requested.instanceId)).toBe(false);
    expect(await send(f.peer(actor.id), 'TRADE', trade, 'trade-once')).toEqual(initial);
    const all = f.room().players.flatMap(player => player.inventory.visible.filter(item => item?.instanceId === requested.instanceId));
    expect(all).toHaveLength(1);
    expect(f.errors).toEqual([]);
  });

  it('cancels trade on target disconnect, releases locks, and reconnects the same seat', async () => {
    const f = await match();
    const actor = f.room().players.find(player => player.seat === f.room().turn!.activeSeat)!;
    const target = f.room().players.find(player => player.id !== actor.id)!;
    const targetIndex = f.room().players.findIndex(player => player.id === target.id);
    const requested = target.inventory.visible.find(item => item)!;
    expect((await send(f.peer(actor.id), 'TRADE', { targetId: target.id, offeredItems: [], offeredCoins: 0, requestedItems: [requested.instanceId], requestedCoins: 0 })).ok).toBe(true);
    f.server.io.sockets.sockets.get(f.peer(target.id).id!)!.disconnect(true);
    await ok(f.peer(actor.id), 'room:sync');
    expect(f.room().pendingTrade).toBeUndefined();
    expect(f.room().players[targetIndex]!.inventory.visible.some(item => item?.instanceId === requested.instanceId)).toBe(true);
    expect(f.room().turn!.pausedRemainingMs).toBeUndefined();
    const replacement = await f.connect();
    const rejoined = await ok(replacement, 'room:reconnect', { code: f.code, reconnectToken: f.admissions[targetIndex].reconnectToken });
    expect(rejoined.view.private.playerId).toBe(target.id);
    expect(rejoined.view.public.players[targetIndex].seat).toBe(target.seat);
    expect((await send(f.peer(actor.id), 'END_TURN')).ok).toBe(true);
    expect(f.errors).toEqual([]);
  });

  it('defaults an open Threat to Comply without consuming weapon or ammunition', async () => {
    const f = await match();
    const actor = f.room().players.find(player => player.roleId === 'enforcer')!;
    expect(f.room().turn!.activeSeat).toBe(actor.seat);
    const target = f.room().players.find(player => player.id !== actor.id)!;
    const pistol = actor.inventory.visible.find(item => item?.itemId === 'pistol')!;
    const bullet = actor.inventory.visible.find(item => item?.itemId === 'bullet')!;
    const before = actor.inventory.coins;
    expect((await send(f.peer(actor.id), 'THREAT', { targetId: target.id, mode: 'OPEN', committedItemId: pistol.instanceId, demandedItems: [], demandedCoins: 1 })).ok).toBe(true);
    f.clock.value += 30_001;
    await ok(f.peer(actor.id), 'room:sync');
    const after = f.room().players.find(player => player.id === actor.id)!;
    expect(f.room().pendingThreat).toBeUndefined();
    expect(after.inventory.coins).toBeGreaterThanOrEqual(before + 1);
    expect(after.inventory.visible.some(item => item?.instanceId === pistol.instanceId)).toBe(true);
    expect(after.inventory.visible.find(item => item?.instanceId === bullet.instanceId)?.quantity).toBe(bullet.quantity);
    expect(f.room().players.find(player => player.id === target.id)!.hp).toBe(target.hp);
    expect(f.errors).toEqual([]);
  });

  it('promotes a permanently dead player to a read-only spectator and supports results rematch', async () => {
    const f = await match(2);
    const actor = f.room().players[0]!;
    const target = f.room().players[1]!;
    const pistol = actor.inventory.visible.find(item => item?.itemId === 'pistol')!;
    const returnToActor = async () => {
      expect((await send(f.peer(actor.id), 'END_TURN')).ok).toBe(true);
      for (let steps = 0; steps < 12; steps += 1) {
        const state = f.room();
        if (state.status === 'RESULTS' || state.turn?.activeSeat === actor.seat) return;
        if (state.round!.phase === 'INTERMISSION') {
          const shopper = state.shop!.order[state.shop!.activeShopperIndex]!;
          expect((await send(f.peer(shopper), 'FINISH_SHOPPING')).ok).toBe(true);
        } else {
          const active = state.players.find(player => player.seat === state.turn!.activeSeat)!;
          expect((await send(f.peer(active.id), 'END_TURN')).ok).toBe(true);
        }
      }
      throw new Error('Did not reach the next actor turn');
    };
    expect((await send(f.peer(actor.id), 'USE_ITEM', { instanceId: pistol.instanceId, targetId: target.id })).ok).toBe(true);
    await returnToActor();
    expect((await send(f.peer(actor.id), 'USE_ITEM', { instanceId: pistol.instanceId, targetId: target.id, useQuickDraw: true })).ok).toBe(true);
    expect(f.room().players[1]!.life).toBe('DOWNED');
    expect((await req(f.peer(target.id), 'room:spectate')).error.code).toBe('SPECTATOR_FORBIDDEN');
    await returnToActor();
    expect(f.room().players[1]!.life).toBe('DEAD');
    expect(f.room().status).toBe('RESULTS');
    const spectator = (await ok(f.peer(target.id), 'room:spectate')).view;
    expect(spectator.players).toHaveLength(2);
    expect(spectator.capabilities).toEqual([]);
    expect(spectator.spectator).toBe(true);
    expect(spectator.viewerPlayerId).toBe(target.id);
    expect((await send(f.peer(target.id), 'END_TURN')).error.code).toBe('SPECTATOR_READ_ONLY');
    expect((await req(f.peer(target.id), 'chat:send', { idempotencyKey: 'dead-chat', text: 'no' })).error.code).toBe('SPECTATOR_READ_ONLY');
    const replacement = await f.connect();
    const restored = await ok(replacement, 'room:reconnect', { code: f.code, reconnectToken: f.admissions[1].reconnectToken });
    expect(restored.playerId).toBe(target.id);
    expect(restored.view.spectator).toBe(true);
    expect(restored.view.private).toBeUndefined();
    f.peers[1] = replacement;
    await ok(f.peer(actor.id), 'room:rematch', { idempotencyKey: 'real-rematch' });
    expect(f.room().status).toBe('LOBBY');
    expect(f.room().players.map(player => player.id)).toEqual([actor.id, target.id]);
    expect((await ok(f.peer(target.id), 'room:sync')).view.private.playerId).toBe(target.id);
    expect(f.errors).toEqual([]);
  });

  it('skips a disconnected active shopper without spending and restores their seat on reconnect', async () => {
    const f = await match(3);
    for (const socket of f.peers) expect((await send(socket, 'END_TURN')).ok).toBe(true);
    expect(f.room().round!.phase).toBe('INTERMISSION');
    const shopperId = f.room().shop!.order[f.room().shop!.activeShopperIndex]!;
    const index = f.room().players.findIndex(player => player.id === shopperId);
    const before = structuredClone(f.room().players[index]!.inventory);
    const observer = f.peers.find(socket => socket !== f.peer(shopperId))!;
    f.server.io.sockets.sockets.get(f.peer(shopperId).id!)!.disconnect(true);
    await ok(observer, 'room:sync');
    expect(f.room().shop?.order[f.room().shop!.activeShopperIndex]).not.toBe(shopperId);
    expect(f.room().players[index]!.inventory).toEqual(before);
    const replacement = await f.connect();
    const reconnected = await ok(replacement, 'room:reconnect', { code: f.code, reconnectToken: f.admissions[index].reconnectToken });
    expect(reconnected.playerId).toBe(shopperId);
    expect(reconnected.view.public.players[index].seat).toBe(index);
    expect(f.room().shop?.order[f.room().shop!.activeShopperIndex]).not.toBe(shopperId);
    expect(f.errors).toEqual([]);
  });

  it('skips an already disconnected shopper when the preceding shopper finishes', async () => {
    const f = await match(3);
    for (const socket of f.peers) expect((await send(socket, 'END_TURN')).ok).toBe(true);
    const first = f.room().shop!.order[0]!;
    const second = f.room().shop!.order[1]!;
    f.server.io.sockets.sockets.get(f.peer(second).id!)!.disconnect(true);
    await ok(f.peer(first), 'room:sync');
    expect((await send(f.peer(first), 'FINISH_SHOPPING')).ok).toBe(true);
    expect(f.room().shop?.order[f.room().shop!.activeShopperIndex]).not.toBe(second);
    expect(f.errors).toEqual([]);
  });

  it('skips timed-out turns and keeps private markets isolated through Intermission', async () => {
    const f = await match(2);
    f.clock.value = f.room().turn!.deadlineAt;
    await ok(f.peers[0]!, 'room:sync');
    expect(f.room().turn!.activeSeat).toBe(1);
    f.clock.value = f.room().turn!.deadlineAt;
    await ok(f.peers[0]!, 'room:sync');
    expect(f.room().round!.phase).toBe('INTERMISSION');
    for (const player of f.room().players) {
      const view = (await ok(f.peer(player.id), 'room:sync')).view;
      const other = f.room().players.find(candidate => candidate.id !== player.id)!;
      for (const offer of f.room().shop!.privateOffers[other.id]!) expect(JSON.stringify(view)).not.toContain(offer.id);
      expect(view.private.blackMarket.length).toBeGreaterThan(0);
    }
    expect(f.errors).toEqual([]);
  });
});
