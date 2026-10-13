import { describe, expect, it } from 'vitest';
import { io, type Socket } from 'socket.io-client';
import { BrowserClock, createBrowserHarness, LIFECYCLE_SEED } from './browser-harness.js';

async function connect(url: string): Promise<Socket> {
  const socket = io(url, { transports: ['websocket'], reconnection: false, forceNew: true });
  await new Promise<void>((resolve, reject) => {
    socket.once('connect', resolve);
    socket.once('connect_error', reject);
  });
  return socket;
}
async function request(socket: Socket, event: string, input: unknown = {}) {
  const reply = await socket.timeout(3000).emitWithAck(event, input);
  expect(reply.ok, JSON.stringify(reply)).toBe(true);
  return reply.data;
}

describe('browser-only deterministic server harness', () => {
  it('uses the documented seed with ordinary role kits and no injected gameplay state', async () => {
    const harness = createBrowserHarness();
    const { game, clock } = harness;
    const host = game.create('Host');
    game.join(host.room.code, 'Victim');
    game.join(host.room.code, 'Witness');
    const roles = ['enforcer', 'smuggler', 'locksmith'];
    game.read(host.room.code)!.players.forEach((person, index) => {
      game.command(host.room.code, person.id, { type: 'CLAIM_ROLE', payload: { roleId: roles[index] } }, clock.now());
      game.command(host.room.code, person.id, { type: 'READY', payload: { ready: true } }, clock.now());
    });
    game.command(host.room.code, host.playerId, { type: 'START_MATCH', payload: {} }, clock.now());
    const room = game.read(host.room.code)!;
    expect(room.match!.seed).toBe(LIFECYCLE_SEED);
    expect(room.players.map(person => person.objective!.objectiveId)).toEqual(['executioner', 'collector', 'tycoon']);
    expect(room.players[0]!.objective!.targetPlayerId).toBe(room.players[1]!.id);
    expect(room.players.map(person => person.hp)).toEqual([5, 5, 5]);
    await harness.server.close();
  });

  it('runs scheduled server publication exactly at a deadline without a sync/command wake-up', async () => {
    const harness = createBrowserHarness();
    const sockets: Socket[] = [];
    try {
      const url = await harness.server.listen();
      const host = await connect(url); sockets.push(host);
      const guest = await connect(url); sockets.push(guest);
      const admission = await request(host, 'room:create', { name: 'Host' });
      const code = admission.view.public.code as string;
      await request(guest, 'room:join', { code, name: 'Guest' });
      const witness = await connect(url); sockets.push(witness);
      await request(witness, 'room:join', { code, name: 'Witness' });
      for (const [index, socket] of sockets.entries()) {
        await request(socket, 'lobby:claim-role', { roleId: ['enforcer', 'smuggler', 'locksmith'][index], idempotencyKey: `role-${index}` });
        await request(socket, 'lobby:ready', { ready: true, idempotencyKey: `ready-${index}` });
      }
      await request(host, 'match:start', { idempotencyKey: 'start' });
      const room = () => harness.game.read(code)!;
      // Setup also publishes atomically from its scheduled deadline.
      const setupDeadline = room().setup!.deadlineAt;
      await harness.clock.advanceTo(setupDeadline - 1);
      expect(room().round!.phase).toBe('SETUP');
      await harness.clock.advanceTo(setupDeadline);
      expect(room().round!.phase).toBe('TURN');
      expect(room().players.every(player => player.inventory.pockets[0]!.item)).toBe(true);
      const deadline = room().turn!.deadlineAt;
      const revision = room().revision;
      const published = new Promise<any>(resolve => host.on('room:view', view => {
        if (view.public.revision === revision + 1) resolve(view);
      }));
      await harness.clock.advanceTo(deadline - 1);
      expect(room().revision).toBe(revision);
      await harness.clock.advanceTo(deadline);
      const view = await published;
      expect(view.public.turn.activeSeat).toBe(1);
      expect(room().revision).toBe(revision + 1);
      await harness.clock.advanceTo(deadline);
      expect(room().revision).toBe(revision + 1);
      // Every shopping boundary is scheduled by the server, with no client wake-up.
      await harness.clock.advanceTo(room().turn!.deadlineAt);
      await harness.clock.advanceTo(room().turn!.deadlineAt);
      expect(room().shop!.phase).toBe('PREP');
      const prepDeadline = room().shop!.prepDeadlineAt;
      await harness.clock.advanceTo(prepDeadline - 1);
      expect(room().shop!.phase).toBe('PREP');
      await harness.clock.advanceTo(prepDeadline);
      expect(room().shop!.phase).toBe('PUBLIC');
      const order = [...room().shop!.order];
      for (const playerId of order) {
        expect(room().shop!.order[room().shop!.activeShopperIndex]).toBe(playerId);
        await harness.clock.advanceTo(room().shop!.publicDeadlineAt!);
        expect(room().shop!.publicSkippedBy![playerId]).toBe(true);
        expect(room().shop!.privateUnlockedBy[playerId]).toBe(true);
      }
      expect(room().shop!.phase).toBe('GRACE');
      await harness.clock.advanceTo(room().shop!.privateDeadlineAt!);
      expect(room().round).toMatchObject({ number: 2, phase: 'TURN' });
      expect(room().shop).toBeUndefined();
      expect(room().events!.filter(event => event.kind === 'PUBLIC_SHOP_PASSED')).toHaveLength(3);
      expect(harness.errors).toEqual([]);
    } finally {
      sockets.forEach(socket => socket.disconnect());
      await harness.server.close();
      expect(harness.clock.pendingCount).toBe(0);
    }
  });

  it('drains rescheduled callbacks in deadline order, cancels tasks, and rejects clock reversal', async () => {
    const clock = new BrowserClock();
    const start = clock.now();
    const calls: number[] = [];
    const cancelled = clock.setTimeout(() => calls.push(-1), 1);
    clock.clearTimeout(cancelled);
    clock.setTimeout(() => {
      calls.push(clock.now() - start);
      clock.setTimeout(() => calls.push(clock.now() - start), 5);
    }, 10);
    clock.setTimeout(() => calls.push(clock.now() - start), 20);
    await clock.advanceTo(start + 30);
    expect(calls).toEqual([10, 15, 20]);
    expect(clock.pendingCount).toBe(0);
    await expect(clock.advanceTo(start)).rejects.toThrow('monotonic');
    await expect(clock.advanceTo(Infinity)).rejects.toThrow('finite');
  });
});
