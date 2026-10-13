import { afterEach, describe, expect, it } from 'vitest';
import { io, type Socket } from 'socket.io-client';
import { applyCommand, MATCH_OPENING_PRESENTATION_MS, RoomStore, type RoleId } from '@the-table/game';
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
async function match(count = 3, leaveInSetup = false, seed = 42, start = true) {
  const clock = new EngineClock();
  const store = new RoomStore({ now: clock.now, issueSessions: false });
  const game = new RoomStoreAdapter(store, () => seed);
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
  if (start) await ok(peers[0]!, 'match:start', { idempotencyKey: 'start' });
  const room = () => store.rooms.get(code)!;
  if (start && !leaveInSetup) for (const [index, player] of room().players.entries()) {
    expect((await send(peers[index]!, 'LOCK_SETUP', { instanceId: player.inventory.visible[2]!.instanceId })).ok).toBe(true);
  }
  const peer = (playerId: string) => peers[room().players.findIndex(player => player.id === playerId)]!;
  return { server, store, game, clock, peers, admissions, code, room, peer, connect, errors };
}
async function advanceShopping(f: Awaited<ReturnType<typeof match>>) {
  const shop = f.room().shop!;
  if (shop.phase === 'PREP') {
    f.clock.value = shop.prepDeadlineAt;
    await ok(f.peers.find(peer => peer.connected)!, 'room:sync');
  } else {
    const playerId = shop.phase === 'PUBLIC' ? shop.order[shop.activeShopperIndex]! : shop.order.find(id => !shop.finishedBy[id])!;
    const reply = await send(f.peer(playerId), shop.phase === 'PUBLIC' ? 'SKIP_PUBLIC_SHOP' : 'FINISH_SHOPPING');
    expect(reply.ok, JSON.stringify(reply)).toBe(true);
  }
}

async function advanceToWildcardRound(f: Awaited<ReturnType<typeof match>>) {
  for (let step = 0; step < 50; step += 1) {
    const room = f.room();
    if (room.round?.number === 3 && room.round.phase === 'TURN') return;
    if (room.round?.phase === 'INTERMISSION') await advanceShopping(f);
    else {
      const actor = room.players.find(player => player.seat === room.turn?.activeSeat)!;
      expect((await send(f.peer(f.room().players.find(player => player.seat === f.room().turn!.activeSeat)!.id), 'END_TURN')).ok).toBe(true);
    }
  }
  throw new Error('Did not reach Wildcard unlock.');
}

describe('Socket.IO with the authoritative game engine', () => {
  it('publishes one anonymous Task reward while keeping assignments and cancellations private', async () => {
    const f = await match();
    const [actor, target, observer] = f.room().players;
    for (const [index, player] of f.room().players.entries()) player.objective = { objectiveId: ['collector', 'phoenix', 'escapist'][index]!, status: 'ACTIVE', progress: {}, rewardGranted: false };
    f.room().sideJobsByPlayer![actor!.id] = {
      round: 1, reward: 2, completed: false, opportunityTaken: false, replacementUsed: false,
      jobs: ['trade', 'receive-coins'].map(id => ({ id: id as 'trade' | 'receive-coins', status: 'ACTIVE', progress: 0, prerequisites: [] })),
    };
    const publicFrames: any[] = [];
    f.peer(observer!.id).on('room:public', frame => publicFrames.push(frame));
    const startingGold = actor!.inventory.coins;
    const proposal = await send(f.peer(actor!.id), 'TRADE', {
      targetId: target!.id, offeredItems: [], requestedItems: [], offeredCoins: 0, requestedCoins: 2,
    });
    expect(proposal.ok, JSON.stringify(proposal)).toBe(true);
    const receipt = await send(f.peer(target!.id), 'RESPOND_TRADE', { accept: true }, 'task-trade-accept');
    expect(receipt.ok).toBe(true);
    expect(await send(f.peer(target!.id), 'RESPOND_TRADE', { accept: true }, 'task-trade-accept')).toEqual(receipt);
    const ownerView = (await ok(f.peer(actor!.id), 'room:sync')).view;
    expect(ownerView.private.tasks.jobs.map((job: any) => job.status)).toEqual(['COMPLETED', 'CANCELLED']);
    expect(ownerView.public.players.find((player: any) => player.id === actor!.id).coins).toBe(startingGold + 4);
    const strangerView = (await ok(f.peer(observer!.id), 'room:sync')).view;
    expect(strangerView.private.tasks).toEqual(f.room().sideJobsByPlayer![observer!.id]);
    for (const frame of [strangerView.public, ...publicFrames]) {
      expect(frame).not.toHaveProperty('sideJobsByPlayer');
      const taskEvents = frame.events.filter((event: any) => event.kind.startsWith('TASK'));
      expect(taskEvents.every((event: any) => event.kind === 'TASK_COMPLETED')).toBe(true);
      for (const event of taskEvents) {
        expect(event).not.toHaveProperty('privatePayloads');
        expect(event).not.toHaveProperty('taskId');
        expect(event.publicText).not.toMatch(/RECEIVE 2|TRADE/);
      }
    }
    expect(f.room().events!.filter(event => event.kind === 'TASK_COMPLETED' && event.actorId === actor!.id)).toHaveLength(1);
    expect(f.errors).toEqual([]);
  });

  it('offers Phoenix a private affordable Medicine opportunity after the first Round income', async () => {
    const f = await match();
    const phoenix = f.room().players[0]!;
    phoenix.objective = { objectiveId: 'phoenix', status: 'ACTIVE', progress: {}, rewardGranted: false };
    const initialGold = phoenix.inventory.coins;
    expect([...phoenix.inventory.visible, ...phoenix.inventory.pockets.map(pocket => pocket.item)].some(item => item?.itemId === 'medicine')).toBe(false);
    for (const socket of f.peers) expect((await send(socket, 'PASS_TURN')).ok).toBe(true);
    expect(f.room().players[0]!.inventory.coins).toBe(initialGold + 2);
    const medicine = f.room().shop!.privateOffers[phoenix.id]!.find(offer => offer.itemId === 'medicine');
    expect(medicine).toMatchObject({ itemId: 'medicine', price: 4 });
    expect(f.room().players[0]!.inventory.coins).toBeGreaterThanOrEqual(4);
    await advanceShopping(f);
    expect(f.room().shop!.publicDeadlineAt).toBe(f.clock.now() + 30_000);
    while (!f.room().shop!.privateUnlockedBy[phoenix.id]) {
      const current = f.room().shop!.order[f.room().shop!.activeShopperIndex]!;
      expect((await send(f.peer(current), 'SKIP_PUBLIC_SHOP')).ok).toBe(true);
    }
    const owner = (await ok(f.peer(phoenix.id), 'room:sync')).view;
    expect(owner.private.blackMarket).toContainEqual(medicine);
    const observer = (await ok(f.peers[1]!, 'room:sync')).view;
    expect(JSON.stringify(observer)).not.toContain(medicine!.id);
    expect(JSON.stringify(owner.public)).not.toContain(medicine!.id);
    expect((await send(f.peer(phoenix.id), 'BUY', { market: 'BLACK', offerId: medicine!.id })).ok).toBe(true);
    expect(f.room().players[0]!.inventory.coins).toBe(initialGold + 2 - 4);
    expect(f.room().players[0]!.inventory.visible.some(item => item?.itemId === 'medicine')).toBe(true);
    expect(f.errors).toEqual([]);
  });

  it.each([4, 5])('replicates Stimulant at %i HP publicly and awards HEAL only for normal HP restored', async hp => {
    const f = await match();
    const [actor, target, observer] = f.room().players;
    for (const [index, player] of f.room().players.entries()) player.objective = { objectiveId: ['collector', 'phoenix', 'escapist'][index]!, status: 'ACTIVE', progress: {}, rewardGranted: false };
    target!.hp = hp;
    const slot = actor!.inventory.visible.findIndex(item => item === null);
    actor!.inventory.visible[slot] = { instanceId: 'socket-stimulant', itemId: 'stimulant', quantity: 1 };
    f.room().sideJobsByPlayer![actor!.id] = {
      round: 1, reward: 2, completed: false, opportunityTaken: false, replacementUsed: false,
      jobs: [{ id: 'heal', status: 'ACTIVE', progress: 0, prerequisites: [] }, { id: 'trade', status: 'ACTIVE', progress: 0, prerequisites: [] }],
    };
    const initialGold = actor!.inventory.coins;
    const use = await send(f.peer(actor!.id), 'USE_ITEM', { instanceId: 'socket-stimulant', targetId: target!.id }, 'use-stimulant-once');
    expect(use.ok, JSON.stringify(use)).toBe(true);
    expect(await send(f.peer(actor!.id), 'USE_ITEM', { instanceId: 'socket-stimulant', targetId: target!.id }, 'use-stimulant-once')).toEqual(use);
    for (const player of [actor!, target!, observer!]) {
      const view = (await ok(f.peer(player.id), 'room:sync')).view;
      expect(view.public.players.find((entry: any) => entry.id === target!.id)).toMatchObject({ hp: 5, temporaryHp: hp === 4 ? 1 : 2 });
    }
    const owner = (await ok(f.peer(actor!.id), 'room:sync')).view;
    expect(owner.private.tasks.completed).toBe(hp === 4);
    expect(f.room().players[0]!.inventory.coins).toBe(initialGold + (hp === 4 ? 2 : 0));
    expect(f.room().players[0]!.inventory.visible.some(item => item?.instanceId === 'socket-stimulant')).toBe(false);
    expect(f.room().turn!.activeSeat).toBe(target!.seat);
    expect(f.errors).toEqual([]);
  });

  it('requires a real Trade for Tycoon and keeps that credit after Gold drops below the threshold', async () => {
    const f = await match();
    f.room().round!.number = 2;
    const [actor, target] = f.room().players;
    actor!.objective = { objectiveId: 'tycoon', status: 'ACTIVE', progress: {}, rewardGranted: false };
    actor!.inventory.coins = 16;
    for (const [index, player] of f.room().players.slice(1).entries()) player.objective = { objectiveId: ['phoenix', 'collector'][index]!, status: 'ACTIVE', progress: {}, rewardGranted: false };
    for (const tasks of Object.values(f.room().sideJobsByPlayer!)) tasks.completed = true;
    const emptyTrade = await send(f.peer(actor!.id), 'TRADE', { targetId: target!.id, offeredItems: [], requestedItems: [], offeredCoins: 0, requestedCoins: 0 });
    expect(emptyTrade.ok, JSON.stringify(emptyTrade)).toBe(true);
    expect((await send(f.peer(target!.id), 'RESPOND_TRADE', { accept: true })).ok).toBe(true);
    expect(f.room().players[0]!.objective).toMatchObject({ status: 'ACTIVE', progress: { coins: 16, successfulTrades: 0 } });

    expect((await send(f.peer(target!.id), 'TRADE', { targetId: actor!.id, offeredItems: [], requestedItems: [], offeredCoins: 0, requestedCoins: 1 })).ok).toBe(true);
    expect((await send(f.peer(actor!.id), 'RESPOND_TRADE', { accept: true })).ok).toBe(true);
    expect(f.room().players[0]!.objective).toMatchObject({ status: 'EXIT_READY', rewardGranted: true, progress: { successfulTrades: 1 } });
    const third = f.room().players[2]!;
    expect((await send(f.peer(third.id), 'TRADE', { targetId: actor!.id, offeredItems: [], requestedItems: [], offeredCoins: 0, requestedCoins: 8 })).ok).toBe(true);
    expect((await send(f.peer(actor!.id), 'RESPOND_TRADE', { accept: true })).ok).toBe(true);
    const owner = (await ok(f.peer(actor!.id), 'room:sync')).view;
    expect(owner.private.objective).toMatchObject({ status: 'ACTIVE', rewardGranted: true });
    expect(owner.private.objective.progress.successfulTrades).toBeGreaterThanOrEqual(1);
    expect(owner.private.objective.progress.coins).toBeLessThan(15);
    expect(f.room().events!.filter(event => event.kind === 'OBJECTIVE_READY' && event.actorId === actor!.id)).toHaveLength(1);
    expect(f.errors).toEqual([]);
  });

  it('pays Round Income before shopping and unlocks one authoritative draw in Round 3', async () => {
    const f = await match();
    const initialCoins = f.room().players.map(player => player.inventory.coins);
    expect((await send(f.peers[0]!, 'DRAW_WILDCARD')).ok).toBe(false);
    await advanceToWildcardRound(f);
    expect(f.room().players.map(player => player.inventory.coins)).toEqual(initialCoins.map(value => value + 4));
    expect(f.room().events!.filter(event => event.kind === 'ROUND_INCOME_GRANTED')).toHaveLength(2);
    expect(f.room().events!.filter(event => event.kind === 'WILDCARD_DECK_UNLOCKED')).toHaveLength(1);
    const events = f.room().events!;
    for (const prep of events.filter(event => event.kind === 'INTERMISSION_PREP_STARTED')) {
      expect(events.find(event => event.kind === 'ROUND_INCOME_GRANTED' && event.round === prep.round)!.sequence).toBeLessThan(prep.sequence);
    }
    const view = (await ok(f.peers[0]!, 'room:sync')).view;
    expect(view.public.wildcard).toMatchObject({ unlocked: true, remaining: 10 });
    expect(view.private.capabilities).toContain('DRAW_WILDCARD');
    expect(f.errors).toEqual([]);
  });

  it('keeps draw and burn identity private across real socket broadcasts, sync, and duplicate delivery', async () => {
    const f = await match(); await advanceToWildcardRound(f);
    const actor = f.room().players[0]!, other = f.room().players[1]!;
    const frames: any[] = [];
    f.peer(other.id).on('room:view', view => frames.push(view));
    const drawn = await send(f.peer(actor.id), 'DRAW_WILDCARD', {}, 'draw-once');
    expect(drawn.ok).toBe(true);
    const cardId = f.room().pendingPrivateWildcardByPlayer![actor.id]!.cardId;
    const deckSize = f.room().wildcardDeck!.length;
    expect(await send(f.peer(actor.id), 'DRAW_WILDCARD', {}, 'draw-once')).toEqual(drawn);
    expect(f.room().wildcardDeck).toHaveLength(deckSize);
    expect(f.room().turn!.primaryUsed).toBe(true);
    expect((await send(f.peer(actor.id), 'END_TURN')).error.code).toBe('LOCKED');
    const owner = (await ok(f.peer(actor.id), 'room:sync')).view;
    expect(owner.private.pendingWildcard).toEqual({ cardId, phase: 'DRAWN' });
    const observer = (await ok(f.peer(other.id), 'room:sync')).view;
    expect(observer.private.pendingWildcard).toBeUndefined();
    expect(JSON.stringify(observer)).not.toContain(JSON.stringify(cardId));
    expect(JSON.stringify(observer)).not.toContain('wildcardDeck');
    expect((await send(f.peer(other.id), 'USE_WILDCARD')).ok).toBe(false);
    expect((await send(f.peer(actor.id), 'BURN_WILDCARD')).ok).toBe(true);
    const burned = (await ok(f.peer(other.id), 'room:sync')).view;
    expect(burned.public.wildcard.discard).toEqual([{ playerId: actor.id, burned: true }]);
    expect(burned.public.wildcard.drawUsedByPlayer[actor.id]).toBe(true);
    expect(burned.public.wildcard.drawUsedByPlayer[other.id]).not.toBe(true);
    expect(JSON.stringify([burned, ...frames])).not.toContain(JSON.stringify(cardId));
    expect((await send(f.peer(actor.id), 'DRAW_WILDCARD')).ok).toBe(false);
    expect(f.errors).toEqual([]);
  });

  it('requires public Use before a legal target, resolves once, and never accepts a client-chosen card', async () => {
    const f = await match(); await advanceToWildcardRound(f);
    const [actor, target] = f.room().players;
    f.room().wildcardDeck = ['seize', ...f.room().wildcardDeck!.filter(id => id !== 'seize')];
    const chosen = target!.inventory.visible.find(item => item)!;
    expect((await send(f.peer(actor!.id), 'DRAW_WILDCARD', { cardId: 'seize' })).ok).toBe(false);
    expect((await send(f.peer(actor!.id), 'DRAW_WILDCARD')).ok).toBe(true);
    const targetPayload = { targetId: target!.id, instanceId: chosen.instanceId };
    expect((await send(f.peer(actor!.id), 'RESOLVE_WILDCARD', targetPayload)).ok).toBe(false);
    expect((await send(f.peer(actor!.id), 'USE_WILDCARD')).ok).toBe(true);
    expect((await ok(f.peer(target!.id), 'room:sync')).view.public.wildcard.pending).toEqual({ playerId: actor!.id, cardId: 'seize' });
    expect((await send(f.peer(actor!.id), 'BURN_WILDCARD')).ok).toBe(false);
    expect((await send(f.peer(actor!.id), 'RESOLVE_WILDCARD', { targetId: target!.id, instanceId: target!.inventory.pockets[0]!.item!.instanceId })).ok).toBe(false);
    const result = await send(f.peer(actor!.id), 'RESOLVE_WILDCARD', targetPayload, 'resolve-once');
    expect(result.ok).toBe(true);
    expect(await send(f.peer(actor!.id), 'RESOLVE_WILDCARD', targetPayload, 'resolve-once')).toEqual(result);
    const nextActor = f.room().players.find(player => player.id === actor!.id)!;
    expect(nextActor.inventory.visible.some(item => item?.instanceId === chosen.instanceId)).toBe(true);
    expect(f.room().players.find(player => player.id === target!.id)!.inventory.visible.some(item => item?.instanceId === chosen.instanceId)).toBe(false);
    expect(f.room().events!.filter(event => event.kind === 'WILDCARD_RESOLVED')).toHaveLength(1);
    expect(f.errors).toEqual([]);
  });

  it('starts normally after host migration and refilling the open physical seat', async () => {
    const f = await match(3, true, 42, false);
    const formerHostId = f.admissions[0].playerId;

    expect(await ok(f.peers[0]!, 'lobby:leave')).toEqual({ left: true });
    expect(f.room().players.map(player => player.seat)).toEqual([1, 2]);
    expect(f.room().players.some(player => player.id === formerHostId)).toBe(false);

    const replacement = await f.connect();
    const admitted = await ok(replacement, 'room:join', { code: f.code, name: 'Replacement' });
    expect(admitted.view.public.players.find((player: any) => player.id === admitted.playerId).seat).toBe(0);
    await ok(replacement, 'lobby:claim-role', { idempotencyKey: 'replacement-role', roleId: 'enforcer' });
    await ok(replacement, 'lobby:ready', { idempotencyKey: 'replacement-ready', ready: true });

    expect(f.room().players.map(player => player.seat)).toEqual([0, 1, 2]);
    expect(f.room().hostPlayerId).toBe(f.admissions[1].playerId);
    expect((await req(f.peers[1]!, 'match:start', { idempotencyKey: 'migrated-host-start' })).ok).toBe(true);
    expect(f.room().status).toBe('PLAYING');
    expect(f.room().match?.fixedSeats).toEqual([0, 1, 2]);
    expect(f.errors).toEqual([]);
  });

  it('rejects a two-player start at the server boundary', async () => {
    const f = await match(2, true, 42, false);
    const reply = await req(f.peers[0]!, 'match:start', { idempotencyKey: 'two-player-start' });
    expect(reply.ok).toBe(false);
    expect(reply.error.message).toContain('three or four');
    expect(f.room().status).toBe('LOBBY');
    expect(f.room().match).toBeUndefined();
  });

  it.each([3, 4])('publishes private setup and one simultaneous inventory reveal to %i sockets', async count => {
    const f = await match(count, true);
    const initial = structuredClone(f.room());
    const bonusId = initial.setup!.bonusItemInstanceId;
    const bonusOwnerId = initial.setup!.bonusPlayerId;
    const frames: any[][] = f.peers.map(() => []);
    f.peers.forEach((socket, index) => socket.on('room:view', view => frames[index]!.push(view)));
    const chosen: string[] = [];
    for (const [index, player] of initial.players.entries()) {
      for (const observer of initial.players) {
        const view = (await ok(f.peer(observer.id), 'room:sync')).view;
        expect(view.public.round.phase).toBe('SETUP');
        expect(view.public.turn).toBeUndefined(); expect(view.public.shop).toBeUndefined();
        expect(view.private.blackMarket).toBeUndefined();
        expect(view.public.players.every((person: any) => person.visibleInventory.every((item: any) => item === null))).toBe(true);
        expect(view.private.setup.bonusItemInstanceId).toBe(observer.id === bonusOwnerId ? bonusId : undefined);
        for (const other of initial.players.filter(other => other.id !== observer.id)) {
          for (const item of other.inventory.visible.filter(item => item)) expect(JSON.stringify(view)).not.toContain(JSON.stringify(item!.instanceId));
        }
      }
      const itemId = player.id === bonusOwnerId ? bonusId : player.inventory.visible[2]!.instanceId;
      chosen.push(itemId);
      const receipt = `setup-lock-${index}`;
      const first = await send(f.peer(player.id), 'LOCK_SETUP', { instanceId: itemId }, receipt);
      expect(first.ok, JSON.stringify(first)).toBe(true);
      expect(await send(f.peer(player.id), 'LOCK_SETUP', { instanceId: itemId }, receipt)).toEqual(first);
      if (index < count - 1) expect((await send(f.peer(player.id), 'LOCK_SETUP', { instanceId: itemId })).error.message).toContain('already locked');
    }
    expect(f.room().round).toMatchObject({ number: 1, phase: 'TURN' });
    for (const [index, socket] of f.peers.entries()) {
      const final = (await ok(socket, 'room:sync')).view;
      expect(final.public.setup).toBeUndefined();
      expect(final.private.pockets[0].item.instanceId).toBe(chosen[index]);
      expect(final.public.chests.map((chest: any) => chest.availability)).toEqual(['AVAILABLE', 'HIDDEN']);
      for (const hiddenId of chosen) expect(JSON.stringify(final.public)).not.toContain(JSON.stringify(hiddenId));
      for (const frame of frames[index]!) {
        if (frame.public.round?.phase === 'SETUP') expect(frame.public.players.every((person: any) => person.visibleInventory.every((item: any) => item === null))).toBe(true);
        if (frame.public.round?.phase === 'TURN') expect(frame.public.players.every((person: any) => person.visibleInventory.filter(Boolean).length >= 2)).toBe(true);
      }
    }
    expect(f.errors).toEqual([]);
  });

  it.each([3, 4])('starts a %i-player match with owner-only objectives and server deadlines', async count => {
    const f = await match(count);
    const room = f.room();
    expect(room.status).toBe('PLAYING');
    expect(room.turn!.deadlineAt).toBe(f.clock.now() + MATCH_OPENING_PRESENTATION_MS + 60_000);
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

  it('locks a proposed trade and applies timeout decline exactly once', async () => {
    const f = await match();
    const actor = f.room().players.find(player => player.seat === f.room().turn!.activeSeat)!;
    const target = f.room().players.find(player => player.id !== actor.id)!;
    const requested = target.inventory.visible.find(item => item)!;
    const trade = { targetId: target.id, offeredItems: [], offeredCoins: 0, requestedItems: [requested.instanceId], requestedCoins: 0 };
    const initial = await send(f.peer(actor.id), 'TRADE', trade, 'trade-once');
    expect(initial.ok).toBe(true);
    expect(f.room().pendingTrade!.deadlineAt).toBe(f.clock.now() + 30_000);
    expect(f.room().turn!.pausedRemainingMs).toBeDefined();
    expect((await send(f.peer(actor.id), 'END_TURN')).error.code).toBe('LOCKED');
    f.clock.value += 30_000;
    const late = await send(f.peer(target.id), 'RESPOND_TRADE', { accept: false });
    expect(late.ok).toBe(false);
    expect(f.room().pendingTrade).toBeUndefined();
    expect(f.room().players.find(player => player.id === actor.id)!.inventory.visible.some(item => item?.instanceId === requested.instanceId)).toBe(false);
    expect(f.room().players.find(player => player.id === target.id)!.inventory.visible.some(item => item?.instanceId === requested.instanceId)).toBe(true);
    expect(await send(f.peer(actor.id), 'TRADE', trade, 'trade-once')).toEqual(initial);
    const all = f.room().players.flatMap(player => player.inventory.visible.filter(item => item?.instanceId === requested.instanceId));
    expect(all).toHaveLength(1);
    expect(f.room().match!.history.trades).toHaveLength(0);
    expect(f.room().events!.filter(event => event.kind === 'TRADE_EXPIRED_DECLINED')).toHaveLength(1);
    expect(f.room().events!.filter(event => event.presentation?.resolution).at(-1)?.presentation?.resolution).toBe('TIMEOUT');
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
    expect(f.room().turn!.activeSeat).toBe(target.seat);
    expect((await send(replacement, 'PASS_TURN')).ok).toBe(true);
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
    expect(f.room().pendingThreat!.deadlineAt).toBe(f.clock.now() + 30_000);
    f.clock.value += 30_001;
    await ok(f.peer(actor.id), 'room:sync');
    const after = f.room().players.find(player => player.id === actor.id)!;
    expect(f.room().pendingThreat).toBeUndefined();
    expect(after.inventory.coins).toBeGreaterThanOrEqual(before + 1);
    expect(after.inventory.visible.some(item => item?.instanceId === pistol.instanceId)).toBe(true);
    expect(after.inventory.visible.find(item => item?.instanceId === bullet.instanceId)?.quantity).toBe(bullet.quantity);
    expect(f.room().players.find(player => player.id === target.id)!.hp).toBe(target.hp);
    expect(f.room().match!.history.threats.at(-1)?.resolution).toBe('TIMEOUT');
    expect(f.room().events!.filter(event => event.presentation?.resolution).at(-1)?.presentation?.resolution).toBe('TIMEOUT');
    expect(f.errors).toEqual([]);
  });

  it('promotes a permanently dead player to a read-only spectator and supports results rematch', async () => {
    const f = await match(3, false, 5424);
    const actor = f.room().players[0]!;
    const target = f.room().players[1]!;
    const pistol = actor.inventory.visible.find(item => item?.itemId === 'pistol')!;
    const returnToActor = async () => {
      if (f.room().turn?.activeSeat === actor.seat) expect((await send(f.peer(actor.id), 'END_TURN')).ok).toBe(true);
      for (let steps = 0; steps < 12; steps += 1) {
        const state = f.room();
        if (state.status === 'RESULTS' || state.turn?.activeSeat === actor.seat) return;
        if (state.round!.phase === 'INTERMISSION') {
          await advanceShopping(f);
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
    expect(f.room().status).toBe('PLAYING');
    const spectator = (await ok(f.peer(target.id), 'room:spectate')).view;
    expect(spectator.players).toHaveLength(3);
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
    const state = f.room();
    expect((await send(f.peer(actor.id), 'LEAVE_TABLE')).ok).toBe(true);
    expect(f.room().status).toBe('RESULTS');
    await ok(f.peer(actor.id), 'room:rematch', { idempotencyKey: 'real-rematch' });
    expect(f.room().status).toBe('LOBBY');
    expect(f.room().players.map(player => player.id)).toEqual([actor.id, target.id, state.players[2]!.id]);
    expect((await ok(f.peer(target.id), 'room:sync')).view.private.playerId).toBe(target.id);
    expect(f.errors).toEqual([]);
  });

  it('skips a disconnected active shopper without spending and restores their seat on reconnect', async () => {
    const f = await match(3);
    for (const socket of f.peers) expect((await send(socket, 'END_TURN')).ok).toBe(true);
    expect(f.room().round!.phase).toBe('INTERMISSION');
    await advanceShopping(f);
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

  it('skips an already disconnected shopper when the preceding Public decision resolves', async () => {
    const f = await match(3);
    for (const socket of f.peers) expect((await send(socket, 'END_TURN')).ok).toBe(true);
    await advanceShopping(f);
    const first = f.room().shop!.order[0]!;
    const second = f.room().shop!.order[1]!;
    f.server.io.sockets.sockets.get(f.peer(second).id!)!.disconnect(true);
    await ok(f.peer(first), 'room:sync');
    expect((await send(f.peer(first), 'SKIP_PUBLIC_SHOP')).ok).toBe(true);
    expect((await send(f.peer(first), 'FINISH_SHOPPING')).ok).toBe(true);
    expect(f.room().shop?.order[f.room().shop!.activeShopperIndex]).not.toBe(second);
    expect(f.errors).toEqual([]);
  });

  it('skips timed-out turns and keeps private markets isolated through Intermission', async () => {
    const f = await match(3);
    f.clock.value = f.room().turn!.deadlineAt;
    await ok(f.peers[0]!, 'room:sync');
    expect(f.room().turn!.activeSeat).toBe(1);
    f.clock.value = f.room().turn!.deadlineAt;
    await ok(f.peers[0]!, 'room:sync');
    expect(f.room().turn!.activeSeat).toBe(2);
    f.clock.value = f.room().turn!.deadlineAt;
    await ok(f.peers[0]!, 'room:sync');
    expect(f.room().round!.phase).toBe('INTERMISSION');
    await advanceShopping(f);
    for (const playerId of [...f.room().shop!.order]) {
      const locked = (await ok(f.peer(playerId), 'room:sync')).view;
      expect(locked.private.blackMarket).toBeUndefined();
      const offerId = f.room().shop!.privateOffers[playerId]![0]!.id;
      const rejected = await send(f.peer(playerId), 'BUY', { market: 'BLACK', offerId });
      expect(rejected.ok).toBe(false);
      if (!rejected.ok) expect(rejected.error.message).toContain('Resolve your Public Shop decision');
      expect((await send(f.peer(playerId), 'SKIP_PUBLIC_SHOP')).ok).toBe(true);
      const view = (await ok(f.peer(playerId), 'room:sync')).view;
      const other = f.room().players.find(candidate => candidate.id !== playerId)!;
      for (const offer of f.room().shop!.privateOffers[other.id]!) expect(JSON.stringify(view)).not.toContain(offer.id);
      expect(view.private.blackMarket.length).toBeGreaterThan(0);
      expect((await send(f.peer(playerId), 'FINISH_SHOPPING')).ok).toBe(true);
    }
    expect(f.errors).toEqual([]);
  });

  it('permits Downed global/private chat while preserving rescue state and rejecting Primary Actions', async () => {
    const f = await match(4);
    const actor = f.room().players[0]!;
    const target = f.room().players[1]!;
    const rescuer = f.room().players[2]!;
    const observer = f.room().players[3]!;
    target.hp = 3;
    const pistol = actor.inventory.visible.find(item => item?.itemId === 'pistol')!;
    expect((await send(f.peer(actor.id), 'USE_ITEM', { instanceId: pistol.instanceId, targetId: target.id })).ok).toBe(true);
    const rescue = structuredClone(f.room().players[1]!.downed);
    await ok(f.peer(target.id), 'chat:send', { idempotencyKey: 'downed-global', text: 'I need Medicine.' });
    await ok(f.peer(target.id), 'chat:send', { idempotencyKey: 'downed-private', text: 'PRIVATE-RESCUE-PROMISE', toPlayerId: rescuer.id });
    await ok(f.peer(rescuer.id), 'chat:send', { idempotencyKey: 'rescue-reply', text: 'PRIVATE-RESCUE-REPLY', toPlayerId: target.id });
    const downedView = (await ok(f.peer(target.id), 'room:sync')).view;
    const observerView = (await ok(f.peer(observer.id), 'room:sync')).view;
    expect(downedView.private.capabilities).toContain('CHAT');
    expect(downedView.public.turn.activeSeat).toBe(actor.seat);
    expect(downedView.public.players[1].life).toBe('DOWNED');
    expect(JSON.stringify(downedView.messages)).toContain('PRIVATE-RESCUE-REPLY');
    expect(JSON.stringify(observerView.messages)).toContain('I need Medicine.');
    expect(JSON.stringify(observerView)).not.toContain('PRIVATE-RESCUE');
    expect(f.room().players[1]!.downed).toEqual(rescue);
    expect((await send(f.peer(target.id), 'TRADE', { targetId: rescuer.id, offeredItems: [], requestedItems: [], offeredCoins: 0, requestedCoins: 0 })).ok).toBe(false);
    expect((await req(f.peer(target.id), 'room:spectate')).error.code).toBe('SPECTATOR_FORBIDDEN');
    expect(f.errors).toEqual([]);
  });

  it('binds Concede to its authorized owner, preserves secrecy and replays its single resolution deterministically', async () => {
    const f = await match(4);
    const actor = f.room().players[0]!;
    actor.objective = { objectiveId: 'executioner', status: 'FAILED', progress: {}, rewardGranted: false, failureReason: 'PRIVATE-FAILED-CONTRACT', targetPlayerId: f.room().players[1]!.id };
    f.room().players.slice(1).forEach((player, index) => {
      player.objective = { objectiveId: ['collector', 'arsenal', 'phoenix'][index]!, status: 'ACTIVE', progress: {}, rewardGranted: false };
    });
    expect((await send(f.peers[1]!, 'CONCEDE')).error.code).toBe('NOT_YOUR_TURN');
    expect((await send(f.peers[1]!, 'CONCEDE', { actorId: actor.id })).ok).toBe(false);
    const before = structuredClone(f.room());
    const expectedReplay = applyCommand(before, actor.id, { type: 'CONCEDE' }, f.clock.now());
    const response = await send(f.peers[0]!, 'CONCEDE', {}, 'concede-once');
    expect(response.ok, JSON.stringify(response)).toBe(true);
    expect(f.room()).toEqual(expectedReplay);
    expect(await send(f.peers[0]!, 'CONCEDE', {}, 'concede-once')).toEqual(response);
    expect(f.room().events!.filter(event => event.kind === 'PLAYER_CONCEDED')).toHaveLength(1);
    expect(f.room().players[0]).toMatchObject({ life: 'DEAD', conceded: true, score: 0 });
    expect(f.room().players[0]!.inventory.visible.every(item => item === null)).toBe(true);
    const living = (await ok(f.peers[1]!, 'room:sync')).view;
    expect(living.public.players[0].revealedObjective).toBeUndefined();
    expect(JSON.stringify(living)).not.toContain('PRIVATE-FAILED-CONTRACT');
    expect(JSON.stringify(living)).not.toContain('executioner');
    const spectator = (await ok(f.peers[0]!, 'room:sync')).view;
    expect(spectator.spectator).toBe(true);
    expect(spectator.capabilities).toEqual([]);
    expect(JSON.stringify(spectator)).toContain('PRIVATE-FAILED-CONTRACT');
    expect((await req(f.peers[0]!, 'chat:send', { idempotencyKey: 'conceded-chat', text: 'No longer legal' })).error.code).toBe('SPECTATOR_READ_ONLY');
    expect(f.errors).toEqual([]);
  });

  it('permits concurrent private and Public buyers while retaining private offers and server turn authority', async () => {
    const f = await match(4);
    for (const socket of f.peers) expect((await send(socket, 'END_TURN')).ok).toBe(true);
    await advanceShopping(f);
    const [first, second, third] = f.room().shop!.order;
    f.room().players.forEach(player => { player.inventory.coins = 20; });
    expect((await send(f.peer(first!), 'SKIP_PUBLIC_SHOP')).ok).toBe(true);
    expect(f.room().shop!.order[f.room().shop!.activeShopperIndex]).toBe(second);
    const blackOffer = f.room().shop!.privateOffers[first!]![0]!;
    const publicOffer = f.room().shop!.publicOffers[0]!;
    const results = await Promise.all([
      send(f.peer(first!), 'BUY', { market: 'BLACK', offerId: blackOffer.id }),
      send(f.peer(second!), 'BUY', { market: 'PUBLIC', offerId: publicOffer.id }),
    ]);
    expect(results.every(reply => reply.ok)).toBe(true);
    expect(f.room().shop!.privatePurchasedBy[first!]).toBe(true);
    expect(f.room().shop!.publicPurchasedBy[second!]).toBe(true);
    expect(f.room().shop!.order[f.room().shop!.activeShopperIndex]).toBe(third);
    expect((await send(f.peer(first!), 'BUY', { market: 'PUBLIC', offerId: f.room().shop!.publicOffers[0]!.id })).ok).toBe(false);
    const other = (await ok(f.peer(third!), 'room:sync')).view;
    expect(other.private.blackMarket).toBeUndefined();
    expect(JSON.stringify(other)).not.toContain(blackOffer.id);
    expect(other.public.shop.privatePurchasedBy).toBeUndefined();
    expect(f.errors).toEqual([]);
  });
});
