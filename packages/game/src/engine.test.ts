import { describe, expect, it } from 'vitest';
import { ROLES } from '@the-table/content';
import {
  applyCommand, applyTimeout, assertRoomInvariants, assignCompatibleObjectives, canLeave,
  evaluateObjectives, getNextDeadline, objectiveCondition, projectAuthorizedRoom, projectPublicRoom,
  projectSpectatorRoom, ROLE_IDS, SeededRandom, setConnection, startMatch,
  type GameCommand, type ItemStack, type PlayerState, type RoleId, type RoomState,
} from './index.js';
import { acquire, stack, syncEquipment } from './inventory.js';
import { bankObjective } from './objectives.js';
import { damage, permanentlyDie } from './combat.js';

function lobby(count = 4, roles: readonly RoleId[] = ROLE_IDS): RoomState {
  return { id: 'room-test', code: 'ABC234', status: 'LOBBY', revision: 1, hostPlayerId: 'p0', createdAt: 0, updatedAt: 0,
    players: Array.from({ length: count }, (_, index) => ({
      id: `p${index}`, seat: index as PlayerState['seat'], name: `Player ${index}`, normalizedName: `player ${index}`,
      connection: 'CONNECTED', roleId: roles[index]!, ready: true, hp: 5, score: 0, life: 'ACTIVE',
      inventory: { visible: Array<null>(6).fill(null), pockets: [{ source: 'DEFAULT', protectedBySafe: false, item: null }], coins: 0 },
    })),
  };
}
function game(count = 4, seed = 77): RoomState {
  const room = startMatch(lobby(count), { seed, now: 1 });
  room.players.forEach((player, index) => { player.objective = { objectiveId: ['escapist', 'collector', 'tycoon', 'arsenal'][index]!, status: 'ACTIVE', progress: {}, rewardGranted: false }; });
  return room;
}
function actor(room: RoomState): PlayerState { return room.players.find((player) => player.seat === room.turn!.activeSeat)!; }
function command(room: RoomState, value: GameCommand, playerId = actor(room).id, elapsed = 1): RoomState { return applyCommand(room, playerId, value, room.updatedAt + elapsed); }
function advance(room: RoomState): RoomState {
  if (room.round!.phase === 'INTERMISSION') return applyCommand(room, room.shop!.order[room.shop!.activeShopperIndex]!, { type: 'FINISH_SHOPPING' }, room.updatedAt + 1);
  return actor(room).connection === 'DISCONNECTED' ? applyTimeout(room, room.turn!.deadlineAt) : command(room, { type: 'END_TURN' });
}
function until(room: RoomState, test: (room: RoomState) => boolean, maximum = 50): RoomState {
  for (let count = 0; !test(room); count += 1) { if (count >= maximum) throw new Error('Unreachable fixture state'); room = advance(room); }
  return room;
}
function give(room: RoomState, seat: number, itemId: string, quantity = 1): ItemStack {
  const item = stack(room, itemId, quantity);
  room.match!.artifactPool = room.match!.artifactPool.filter((id) => id !== itemId);
  if (itemId === 'passage-token') room.match!.passageTokenAvailable = false;
  acquire(room, room.players[seat]!, item, room.updatedAt);
  return item;
}
function objective(room: RoomState, seat: number, objectiveId: string, target?: number): void {
  const previous = room.players[seat]!.objective!.objectiveId;
  const duplicate = room.players.find((player) => player.seat !== seat && player.objective!.objectiveId === objectiveId);
  if (duplicate) duplicate.objective!.objectiveId = previous;
  room.players[seat]!.objective = { objectiveId, status: 'ACTIVE', progress: {}, rewardGranted: false, ...(target === undefined ? {} : { targetPlayerId: `p${target}` }) };
}

describe('initialization and assignment', () => {
  it.each(ROLE_IDS)('grants exactly the authoritative %s kit', (roleId) => {
    const roles = [roleId, ...ROLE_IDS.filter((role) => role !== roleId)];
    const input = lobby(2, roles);
    const room = startMatch(input, { seed: 10, now: 1 });
    const player = room.players[0]!;
    expect(player.inventory.visible.filter(Boolean).map((item) => item!.itemId)).toEqual(ROLES[roleId].startingItems);
    expect(player.inventory.coins).toBe(ROLES[roleId].startingCoins);
    expect(player.inventory.pockets).toHaveLength(roleId === 'smuggler' ? 2 : 1);
    expect(input.status).toBe('LOBBY');
    expect(startMatch(input, { seed: 10, now: 1 })).toEqual(room);
  });
  it('assigns compatible unique objectives for thousands of seeded lobbies', () => {
    for (const count of [2, 3, 4]) for (let seed = 1; seed <= 500; seed += 1) {
      const players = lobby(count).players;
      const assignment = assignCompatibleObjectives(players, new SeededRandom(seed));
      const states = Object.values(assignment);
      expect(new Set(states.map((state) => state.objectiveId)).size).toBe(count);
      expect(states.filter((state) => state.objectiveId === 'martyr').length).toBeLessThanOrEqual(1);
      expect(states.filter((state) => state.targetPlayerId).length).toBeLessThanOrEqual(count === 4 ? 2 : 1);
      for (const [playerId, state] of Object.entries(assignment)) {
        if (state.targetPlayerId) expect(state.targetPlayerId).not.toBe(playerId);
        if (['guardian', 'kingmaker'].includes(state.objectiveId)) expect(assignment[state.targetPlayerId!]!.objectiveId).not.toBe('martyr');
        if (state.objectiveId === 'kingmaker' && assignment[state.targetPlayerId!]!.objectiveId === 'executioner') expect(assignment[state.targetPlayerId!]!.targetPlayerId).not.toBe(playerId);
        if (count === 2) expect(['guardian', 'kingmaker', 'duelist', 'savior', 'graverobber', 'poisoner', 'extortionist']).not.toContain(state.objectiveId);
      }
    }
  });
  it('rejects unready, duplicate-role, one-player and invalid-seed starts atomically', () => {
    const input = lobby(); input.players[1]!.ready = false;
    expect(() => startMatch(input, { seed: 1, now: 1 })).toThrow();
    expect(input.status).toBe('LOBBY');
    expect(() => startMatch(lobby(1), { seed: 1, now: 1 })).toThrow();
    input.players[1]!.ready = true; input.players[1]!.roleId = input.players[0]!.roleId!;
    expect(() => startMatch(input, { seed: 1, now: 1 })).toThrow();
    expect(() => startMatch(lobby(), { seed: NaN, now: 1 })).toThrow();
  });
});

describe('normal turns and deadlines', () => {
  it('starts in fixed order, allows one primary, skips on timeout, and refreshes at Intermission', () => {
    let room = game();
    const original = structuredClone(room);
    room = command(room, { type: 'USE_ITEM', instanceId: room.players[0]!.inventory.visible[0]!.instanceId, targetId: 'p1' });
    expect(room.turn!.primaryUsed).toBe(true);
    expect(() => command(room, { type: 'USE_ITEM', instanceId: room.players[0]!.inventory.visible[0]!.instanceId, targetId: 'p1' })).toThrow();
    expect(original.players[1]!.hp).toBe(5);
    room = applyTimeout(room, room.turn!.deadlineAt);
    expect(room.turn!.activeSeat).toBe(1);
    room = until(room, (state) => state.round!.phase === 'INTERMISSION');
    expect(room.round!.number).toBe(1);
    expect(room.shop!.publicOffers).toHaveLength(4);
    expect(room.shop!.privateOffers.p2).toHaveLength(4);
    const oldOffers = room.shop!.publicOffers.map((offer) => offer.id);
    room = until(room, (state) => state.round!.number === 2);
    expect(room.turn!.activeSeat).toBe(0);
    expect(room.chests![0]!.availability).toBe('AVAILABLE');
    room = until(room, (state) => state.round!.phase === 'INTERMISSION');
    expect(room.shop!.publicOffers.map((offer) => offer.id).some((id) => oldOffers.includes(id))).toBe(false);
  });
  it('does not mutate or revise an early timeout and rejects late commands', () => {
    const room = game();
    expect(applyTimeout(room, room.turn!.deadlineAt - 1)).toBe(room);
    expect(() => applyCommand(room, 'p0', { type: 'END_TURN' }, room.turn!.deadlineAt)).toThrow(/deadline/);
    expect(() => applyCommand(room, 'p1', { type: 'END_TURN' }, 2)).toThrow(/turn/);
  });
  it('blocks Handcuffs only on the next turn, then removes them', () => {
    let room = game(); const cuffs = give(room, 0, 'handcuffs');
    room = command(room, { type: 'USE_ITEM', instanceId: cuffs.instanceId, targetId: 'p1' });
    room = advance(room);
    expect(() => command(room, { type: 'TRADE', targetId: 'p0', offeredItems: [], offeredCoins: 0, requestedItems: [], requestedCoins: 0 })).toThrow(/Handcuffs/);
    const medicine = room.players[1]!.inventory.visible.find((item) => item?.itemId === 'medicine')!;
    room.players[1]!.hp = 4;
    room = command(room, { type: 'USE_ITEM', instanceId: medicine.instanceId });
    room = advance(room);
    expect(room.players[1]!.statuses).toEqual([]);
  });
});

describe('Trade, Threat, and response locks', () => {
  it('pauses and restores the remaining turn time and defaults connected Trade to Accept', () => {
    let room = game();
    const offer = room.players[0]!.inventory.visible[1]!;
    const request = room.players[1]!.inventory.visible[1]!;
    room = command(room, { type: 'TRADE', targetId: 'p1', offeredItems: [offer.instanceId], offeredCoins: 1, requestedItems: [request.instanceId], requestedCoins: 2 }, 'p0', 10_000);
    expect(room.turn!.pausedRemainingMs).toBe(50_000);
    expect(getNextDeadline(room)).toBe(room.pendingTrade!.deadlineAt);
    expect(() => command(room, { type: 'END_TURN' })).toThrow(/pending/);
    const deadline = room.pendingTrade!.deadlineAt;
    room = applyTimeout(room, deadline);
    expect(room.players[0]!.inventory.visible.some((item) => item?.instanceId === request.instanceId)).toBe(true);
    expect(room.players[1]!.inventory.visible.some((item) => item?.instanceId === offer.instanceId)).toBe(true);
    expect(room.players[0]!.inventory.coins).toBe(3);
    expect(room.turn!.deadlineAt).toBe(deadline + 50_000);
    expect(room.match!.history.trades).toHaveLength(1);
    assertRoomInvariants(room);
  });
  it('cancels target disconnect without transferring, preserves seat, and rejects new targeting', () => {
    let room = game();
    room = command(room, { type: 'TRADE', targetId: 'p1', offeredItems: [], offeredCoins: 0, requestedItems: [], requestedCoins: 3 });
    room = setConnection(room, 'p1', 'DISCONNECTED', room.updatedAt + 1);
    expect(room.pendingTrade).toBeUndefined(); expect(room.players[0]!.inventory.coins).toBe(2);
    expect(room.match!.history.trades).toHaveLength(0);
    room = until(room, (state) => state.round!.number === 2);
    expect(() => command(room, { type: 'TRADE', targetId: 'p1', offeredItems: [], offeredCoins: 0, requestedItems: [], requestedCoins: 0 })).toThrow(/Disconnected/);
    room = setConnection(room, 'p1', 'CONNECTED', room.updatedAt + 1);
    expect(room.players[1]!.seat).toBe(1);
  });
  it('cannot select pocket assets, duplicate assets, or negative coins', () => {
    const room = game(); const secret = room.players[1]!.inventory.visible[0]!;
    room.players[1]!.inventory.visible[0] = null; room.players[1]!.inventory.pockets[0]!.item = secret;
    expect(() => command(room, { type: 'TRADE', targetId: 'p1', offeredItems: [], offeredCoins: 0, requestedItems: [secret.instanceId], requestedCoins: 0 })).toThrow();
    expect(() => command(room, { type: 'TRADE', targetId: 'p1', offeredItems: [], offeredCoins: -1, requestedItems: [], requestedCoins: 0 })).toThrow();
    const own = room.players[0]!.inventory.visible[0]!;
    expect(() => command(room, { type: 'TRADE', targetId: 'p1', offeredItems: [own.instanceId, own.instanceId], offeredCoins: 0, requestedItems: [], requestedCoins: 0 })).toThrow();
  });
  it('covered Comply consumes Cloth but preserves weapon and ammunition', () => {
    let room = game(); const cloth = give(room, 0, 'cloth'); const pistol = room.players[0]!.inventory.visible[0]!;
    room = command(room, { type: 'THREAT', targetId: 'p1', mode: 'COVERED', committedItemId: pistol.instanceId, clothItemId: cloth.instanceId, demandedItems: [], demandedCoins: 1 });
    const publicThreat = projectPublicRoom(room).pendingThreat!;
    expect(publicThreat.committedItemId).toBeUndefined(); expect(publicThreat.committedItemType).toBeUndefined();
    room = applyTimeout(room, room.pendingThreat!.deadlineAt);
    expect(room.players[1]!.hp).toBe(5);
    expect(room.players[0]!.inventory.visible.filter(Boolean).map((item) => item!.itemId)).toEqual(['pistol', 'bullet']);
    expect(room.events!.at(-1)!.publicText).toContain('Pistol');
  });
  it('nonadjacent covered Knife is a bluff and Open mode rejects it', () => {
    let room = game(); const knife = give(room, 0, 'knife'); const cloth = give(room, 0, 'cloth');
    const base = { type: 'THREAT' as const, targetId: 'p2', committedItemId: knife.instanceId, demandedItems: [], demandedCoins: 0 };
    expect(() => command(room, { ...base, mode: 'OPEN' })).toThrow(/valid weapon/);
    room = command(room, { ...base, mode: 'COVERED', clothItemId: cloth.instanceId });
    room = command(room, { type: 'RESPOND_THREAT', comply: false }, 'p2');
    expect(room.players[2]!.hp).toBe(5);
    expect(room.players[0]!.inventory.visible.some((item) => item?.instanceId === knife.instanceId)).toBe(true);
    expect(room.match!.history.threats[0]!.validWeapon).toBe(false);
  });
  it('Armor blocks a whole shot; Quick Draw spends no Bullet and is usable once', () => {
    let room = game(); const armor = give(room, 1, 'armor'); const pistol = room.players[0]!.inventory.visible[0]!;
    room = command(room, { type: 'USE_ITEM', instanceId: pistol.instanceId, targetId: 'p1', useQuickDraw: true });
    expect(room.players[1]!.hp).toBe(5); expect(room.players[1]!.inventory.visible.some((item) => item?.instanceId === armor.instanceId)).toBe(false);
    expect(room.players[0]!.inventory.visible[1]!.itemId).toBe('bullet');
    room = until(room, (state) => state.round!.number === 2);
    expect(() => command(room, { type: 'USE_ITEM', instanceId: pistol.instanceId, targetId: 'p1', useQuickDraw: true })).toThrow();
  });
});

describe('Downed windows', () => {
  it('1 Downs 4: preserves Intermission and kills immediately before 1 next acts', () => {
    let room = game(); room.players[3]!.hp = 3;
    room = command(room, { type: 'USE_ITEM', instanceId: room.players[0]!.inventory.visible[0]!.instanceId, targetId: 'p3' });
    expect(room.players[3]!.life).toBe('DOWNED');
    const lootable = room.players[3]!.inventory.visible[0]!;
    room = command(room, { type: 'LOOT_DOWNED', targetId: 'p3', instanceId: lootable.instanceId });
    expect(() => command(room, { type: 'LOOT_DOWNED', targetId: 'p3', instanceId: room.players[3]!.inventory.visible[1]!.instanceId })).toThrow();
    room = until(room, (state) => state.round!.phase === 'INTERMISSION');
    expect(room.players[3]!.life).toBe('DOWNED'); expect(room.shop!.order).not.toContain('p3');
    room = until(room, (state) => state.round!.number === 2);
    expect(room.players[3]!.life).toBe('DEAD'); expect(room.turn!.activeSeat).toBe(0);
    expect(room.players[3]!.inventory.visible.every((item) => item === null)).toBe(true);
  });
  it('3 Downs 4: gives 1 and 2 rescue opportunities in the next round', () => {
    let room = game(); const pistol = give(room, 2, 'pistol'); give(room, 2, 'bullet'); room.players[3]!.hp = 3;
    room = advance(advance(room));
    room = command(room, { type: 'USE_ITEM', instanceId: pistol.instanceId, targetId: 'p3' });
    room = until(room, (state) => state.round!.number === 2);
    expect(room.players[3]!.life).toBe('DOWNED');
    room = advance(room);
    const medicine = room.players[1]!.inventory.visible.find((item) => item?.itemId === 'medicine')!;
    room = command(room, { type: 'DOWNED_INTERACTION', targetId: 'p3', kind: 'REVIVE', instanceId: medicine.instanceId });
    expect(room.players[3]!.life).toBe('ACTIVE'); expect(room.players[3]!.hp).toBe(3);
    expect(room.turn!.primaryUsed).toBe(false); expect(room.turn!.downedInteractionUsed).toBe(true);
    room = advance(room); expect(room.turn!.activeSeat).toBe(2); expect(room.players[3]!.life).toBe('ACTIVE');
  });
  it('allows a Downed owner to self-revive and consumes their entire turn', () => {
    let room = game(); room.players[1]!.hp = 3;
    room = command(room, { type: 'USE_ITEM', instanceId: room.players[0]!.inventory.visible[0]!.instanceId, targetId: 'p1' });
    room = advance(room);
    const medicine = room.players[1]!.inventory.visible[0]!;
    room = command(room, { type: 'USE_ITEM', instanceId: medicine.instanceId });
    expect(room.players[1]!.hp).toBe(2); expect(room.turn!.activeSeat).toBe(2);
    expect(room.match!.history.downs[0]!.recovered).toBe(true);
  });
  it('pauses Poison while Downed, resumes only at next living turn after rescue', () => {
    let room = game(); const poison = give(room, 0, 'poison'); room.players[1]!.hp = 1;
    room = command(room, { type: 'USE_ITEM', instanceId: poison.instanceId, targetId: 'p1' });
    room = advance(room);
    expect(room.players[1]!.life).toBe('DOWNED'); expect(room.players[1]!.statuses![0]!.remainingTurns).toBe(2);
    const medicine = room.players[1]!.inventory.visible[0]!;
    room = command(room, { type: 'USE_ITEM', instanceId: medicine.instanceId });
    expect(room.players[1]!.hp).toBe(2); expect(room.players[1]!.statuses![0]!.remainingTurns).toBe(2);
    room = until(room, (state) => state.round!.number === 2 && state.turn?.activeSeat === 1);
    expect(room.players[1]!.hp).toBe(1); expect(room.players[1]!.statuses![0]!.remainingTurns).toBe(1);
  });
  it('retains rescue deadline when the original aggressor exits', () => {
    let room = game(); room.players[3]!.hp = 1;
    damage(room, room.players[1]!, room.players[3]!, 2, room.updatedAt, false);
    // Poison applied by seat 2 has a next opportunity in this same round, even if that source exits.
    bankObjective(room, room.players[1]!, room.updatedAt);
    room = advance(room);
    expect(room.players[3]!.life).toBe('DEAD'); expect(room.turn!.activeSeat).toBe(2);
  });
});

describe('objectives and score', () => {
  it('sustained readiness grants one reward and requires the next turn; staying defers exit', () => {
    let room = game(); objective(room, 0, 'tycoon'); room.round!.number = 2; room.players[0]!.inventory.coins = 12;
    evaluateObjectives(room, 5);
    expect(room.players[0]!.inventory.coins).toBe(15); expect(canLeave(room, room.players[0]!)).toBe(false);
    room.players[0]!.inventory.coins = 11; evaluateObjectives(room, 6); expect(room.players[0]!.objective!.status).toBe('ACTIVE');
    room.players[0]!.inventory.coins = 12; evaluateObjectives(room, 7); expect(room.players[0]!.inventory.coins).toBe(12);
    room = until(room, (state) => state.round!.number === 3);
    expect(canLeave(room, room.players[0]!)).toBe(true);
    room = command(room, { type: 'STAY' }); expect(canLeave(room, room.players[0]!)).toBe(false);
    room = until(room, (state) => state.round!.number === 4);
    room = command(room, { type: 'LEAVE_TABLE' }); expect(room.players[0]!.life).toBe('EXITED'); expect(room.players[0]!.score).toBe(100);
    expect(projectPublicRoom(room).players[0]!.revealedObjective!.objectiveId).toBe('tycoon');
  });
  it('supports two-player Merchant trades in different rounds, including as recipient', () => {
    const room = game(2); objective(room, 0, 'merchant'); room.round!.number = 2;
    room.match!.history.trades.push({ actorId: 'p0', targetId: 'p1', round: 1, sequence: 1 }, { actorId: 'p1', targetId: 'p0', round: 1, sequence: 2 });
    expect(objectiveCondition(room, room.players[0]!)).toBe(false);
    room.match!.history.trades[1]!.round = 2; evaluateObjectives(room, 3);
    expect(room.players[0]!.objective!.status).toBe('EXIT_READY');
    room.match!.history.trades = []; evaluateObjectives(room, 4);
    expect(room.players[0]!.objective!.status).toBe('EXIT_READY');
  });
  it('auto-banks two-player Survivor on forced end before round three', () => {
    let room = game(2); objective(room, 0, 'survivor'); objective(room, 1, 'martyr');
    room.players[1]!.hp = 3;
    room = command(room, { type: 'USE_ITEM', instanceId: room.players[0]!.inventory.visible[0]!.instanceId, targetId: 'p1' });
    room = until(room, (state) => state.status === 'RESULTS');
    expect(room.players[1]!.score).toBe(50); expect(room.players[0]!.score).toBe(100);
    expect(room.players[0]!.objective!.status).toBe('BANKED'); expect(getNextDeadline(room)).toBeUndefined();
  });
  it('resolves target contingencies, grants two coins, and scores eighty percent', () => {
    const room = game(); objective(room, 0, 'executioner', 1);
    room.match!.history.deaths.push({ playerId: 'p1', killerId: 'p2', at: 2 }); room.players[1]!.life = 'DEAD'; room.players[1]!.hp = 0;
    evaluateObjectives(room, 2); expect(room.players[0]!.objective!.contingencyTargetId).toBe('p2');
    room.match!.history.deaths.push({ playerId: 'p2', killerId: 'p0', at: 3 }); room.players[2]!.life = 'DEAD'; room.players[2]!.hp = 0;
    evaluateObjectives(room, 3); expect(room.players[0]!.inventory.coins).toBe(4);
    bankObjective(room, room.players[0]!, 4); expect(room.players[0]!.score).toBe(80);
  });
  it('checks Guardian at end of Round 4 and immediately credits an earlier successful target exit', () => {
    const room = game(); objective(room, 0, 'guardian', 1); room.round!.number = 4;
    evaluateObjectives(room, 2); expect(room.players[0]!.objective!.status).toBe('ACTIVE');
    evaluateObjectives(room, 3, true); expect(room.players[0]!.objective!.status).toBe('EXIT_READY');
    const earlier = game(); objective(earlier, 0, 'guardian', 1); bankObjective(earlier, earlier.players[1]!, 2);
    evaluateObjectives(earlier, 2); expect(earlier.players[0]!.objective!.status).toBe('EXIT_READY');
  });
  it('marks Martyr failed after another player is first to die and ready non-Martyr death scores zero', () => {
    const room = game(); objective(room, 0, 'martyr');
    damage(room, room.players[2]!, room.players[1]!, 5, 2, false); permanentlyDie(room, room.players[1]!, 3); evaluateObjectives(room, 3);
    expect(room.players[0]!.objective!.status).toBe('FAILED');
    room.players[3]!.objective!.status = 'EXIT_READY';
    damage(room, room.players[2]!, room.players[3]!, 5, 4, false); permanentlyDie(room, room.players[3]!, 5);
    expect(room.players[3]!.score).toBe(0); expect(room.players[3]!.objective!.status).toBe('FAILED');
    expect(projectPublicRoom(room).players[3]!.revealedObjective).toBeUndefined();
  });
});

describe('inventory, economy, privacy, and deterministic simulations', () => {
  it('losing Bag ejects its locked Pocket item and overflow defaults to discard in 15 seconds', () => {
    let room = game(); const player = room.players[2]!;
    const hidden = stack(room, 'poison'); player.inventory.pockets[1]!.item = hidden;
    for (const itemId of ['knife', 'medicine', 'antidote', 'key']) give(room, 2, itemId);
    const bag = player.inventory.visible.find((item) => item?.itemId === 'bag')!;
    room = command(room, { type: 'TRADE', targetId: 'p2', offeredItems: [room.players[0]!.inventory.visible[0]!.instanceId], offeredCoins: 0, requestedItems: [bag.instanceId], requestedCoins: 0 });
    room = command(room, { type: 'RESPOND_TRADE', accept: true }, 'p2');
    expect(room.players[2]!.inventory.pockets).toHaveLength(1);
    expect(room.overflows).toHaveLength(1); expect(room.overflows![0]!.incoming.instanceId).toBe(hidden.instanceId);
    expect(room.overflows![0]!.deadlineAt - room.updatedAt).toBe(15_000);
    room = applyTimeout(room, getNextDeadline(room)!);
    expect(room.overflows).toEqual([]); assertRoomInvariants(room);
  });
  it('does not move locked Pocket items and keeps visible equipment out', () => {
    let room = until(game(), (state) => state.round!.phase === 'INTERMISSION');
    room = until(room, (state) => state.shop?.order[state.shop.activeShopperIndex] === 'p2');
    const cloth = room.players[2]!.inventory.visible[0]!; const bag = room.players[2]!.inventory.visible[1]!;
    room = command(room, { type: 'POCKET', instanceId: cloth.instanceId, pocketIndex: 0 }, 'p2');
    expect(() => command(room, { type: 'POCKET', instanceId: bag.instanceId, pocketIndex: 1 }, 'p2')).toThrow();
    expect(() => command(room, { type: 'SELL', instanceId: cloth.instanceId }, 'p2')).toThrow();
  });
  it('preserves unopened chest contents and guarantees a Black Key opportunity by Round 3', () => {
    let room = until(game(), (state) => state.round!.number === 2);
    const contents = structuredClone(room.chests![0]!.loot);
    room = until(room, (state) => state.round!.number === 3 && state.round!.phase === 'INTERMISSION');
    expect(room.chests![0]!.loot).toEqual(contents); expect(room.match!.blackKeyObtainable).toBe(true);
    expect(room.chests![1]!.loot.some((entry) => entry.kind === 'ITEM' && entry.stack.itemId === 'passage-token')).toBe(true);
  });
  it('leaks no secret sentinels in public/other-owner views and gates spectator access', () => {
    const room = game();
    room.players[0]!.inventory.pockets[0]!.item = { instanceId: 'SECRET_POCKET', itemId: 'poison', quantity: 1 };
    room.players[0]!.objective!.progress = { sentinel: 'SECRET_OBJECTIVE' };
    room.chests![0]!.loot = [{ kind: 'ITEM', stack: { instanceId: 'SECRET_CHEST', itemId: 'knife', quantity: 1 } }];
    room.events!.push({ id: 'inspect', sequence: 2, kind: 'INSPECTED', at: 1, targetIds: [], publicText: 'Inspection', privatePayloads: { p0: 'SECRET_INSPECTION' } });
    const view = JSON.stringify(projectAuthorizedRoom(room, 'p1'));
    for (const sentinel of ['SECRET_POCKET', 'SECRET_OBJECTIVE', 'SECRET_CHEST', 'SECRET_INSPECTION', 'rngState', 'seed']) expect(view).not.toContain(sentinel);
    expect(() => projectSpectatorRoom(room, 'p1')).toThrow(); expect(() => projectSpectatorRoom(room, 'unknown')).toThrow();
    room.players[1]!.life = 'DEAD';
    const spectator = projectSpectatorRoom(room, 'p1');
    expect(spectator.capabilities).toEqual([]); expect(JSON.stringify(spectator)).toContain('SECRET_POCKET');
    expect(JSON.stringify(spectator)).toContain('SECRET_CHEST');
  });
  it('rejects duplicated instance ownership', () => {
    const room = game(); room.players[1]!.inventory.visible[2] = { ...room.players[0]!.inventory.visible[0]! };
    expect(() => assertRoomInvariants(room)).toThrow(/Duplicate item/);
  });
  it('replays seeded 2/3/4-player matches identically with invariant checks at every transition', () => {
    for (const count of [2, 3, 4]) for (let seed = 1; seed <= 20; seed += 1) {
      let a = startMatch(lobby(count), { seed, now: 1 }); let b = startMatch(lobby(count), { seed, now: 1 });
      for (let step = 0; step < 60 && a.status === 'PLAYING'; step += 1) {
        a = advance(a); b = advance(b);
        assertRoomInvariants(a); expect(a).toEqual(b);
      }
    }
  });
});

describe('all objective predicates and ordering', () => {
  it('checks Escapist, Collector, and Arsenal against actual visible and Pocket possession', () => {
    const room = game(); room.round!.number = 3;
    objective(room, 0, 'escapist'); give(room, 0, 'passage-token');
    expect(objectiveCondition(room, room.players[0]!)).toBe(true);
    objective(room, 0, 'collector'); give(room, 0, 'brass-idol'); give(room, 0, 'glass-eye');
    expect(objectiveCondition(room, room.players[0]!)).toBe(true);
    objective(room, 2, 'arsenal');
    give(room, 2, 'pistol'); give(room, 2, 'bullet'); give(room, 2, 'knife'); give(room, 2, 'armor');
    const bullet = room.players[2]!.inventory.visible.find((item) => item?.itemId === 'bullet')!;
    const index = room.players[2]!.inventory.visible.indexOf(bullet); room.players[2]!.inventory.visible[index] = null;
    room.players[2]!.inventory.pockets[0]!.item = bullet;
    expect(objectiveCondition(room, room.players[2]!)).toBe(true);
  });
  it('requires separate recovered Phoenix Downs and resolved Trade before Betrayer Down', () => {
    const room = game(); const history = room.match!.history;
    objective(room, 0, 'phoenix');
    history.downs.push({ actorId: 'p1', targetId: 'p0', eventId: 'd1', sequence: 1, recovered: true }, { actorId: 'p1', targetId: 'p0', eventId: 'd2', sequence: 2, recovered: false });
    expect(objectiveCondition(room, room.players[0]!)).toBe(false);
    history.downs[1]!.recovered = true; expect(objectiveCondition(room, room.players[0]!)).toBe(true);
    objective(room, 0, 'betrayer');
    history.trades.push({ actorId: 'p1', targetId: 'p0', round: 1, sequence: 4 });
    history.downs.push({ actorId: 'p0', targetId: 'p1', eventId: 'd3', sequence: 3, recovered: false });
    expect(objectiveCondition(room, room.players[0]!)).toBe(false);
    history.downs[2]!.sequence = 5; expect(objectiveCondition(room, room.players[0]!)).toBe(true);
  });
  it('requires two distinct opponents for Duelist, Savior, Graverobber, and Poisoner', () => {
    for (const objectiveId of ['duelist', 'savior', 'graverobber', 'poisoner']) {
      const room = game(); objective(room, 0, objectiveId); const history = room.match!.history;
      const records = objectiveId === 'duelist' ? history.downs : objectiveId === 'savior' ? history.revives : objectiveId === 'graverobber' ? history.loots : history.poisonTicks;
      const first = { actorId: 'p0', targetId: 'p1', eventId: 'd1', sequence: 1, recovered: true };
      const second = { actorId: 'p0', targetId: 'p1', eventId: 'd2', sequence: 2, recovered: true };
      records.push(first, second);
      expect(objectiveCondition(room, room.players[0]!)).toBe(false);
      second.targetId = 'p2'; expect(objectiveCondition(room, room.players[0]!)).toBe(true);
    }
  });
  it('credits Threat assets only on compliance and requires both covered-bluff outcomes', () => {
    const room = game(); objective(room, 0, 'extortionist');
    const history = room.match!.history;
    history.threats.push({ actorId: 'p0', targetId: 'p1', complied: true, covered: true, validWeapon: false, assetsReceived: true }, { actorId: 'p0', targetId: 'p2', complied: true, covered: true, validWeapon: true, assetsReceived: false });
    expect(objectiveCondition(room, room.players[0]!)).toBe(false);
    history.threats[1]!.assetsReceived = true; expect(objectiveCondition(room, room.players[0]!)).toBe(true);
    objective(room, 0, 'con-artist'); expect(objectiveCondition(room, room.players[0]!)).toBe(false);
    history.threats[1]!.complied = false; expect(objectiveCondition(room, room.players[0]!)).toBe(true);
  });
  it('requires successful Pickpocket plus loot, and both chest kinds', () => {
    const room = game(); objective(room, 0, 'hidden-hand');
    room.match!.history.pickpockets.push({ actorId: 'p0', targetId: 'p1' });
    expect(objectiveCondition(room, room.players[0]!)).toBe(false);
    room.match!.history.loots.push({ actorId: 'p0', targetId: 'p1', eventId: 'd1' });
    expect(objectiveCondition(room, room.players[0]!)).toBe(true);
    objective(room, 0, 'chest-raider');
    room.match!.history.chests.push({ actorId: 'p0', kind: 'STANDARD' });
    expect(objectiveCondition(room, room.players[0]!)).toBe(false);
    room.match!.history.chests.push({ actorId: 'p0', kind: 'BLACK' });
    expect(objectiveCondition(room, room.players[0]!)).toBe(true);
    evaluateObjectives(room, 2); expect(room.players[0]!.objective!.status).toBe('ACTIVE');
    room.round!.number = 3; evaluateObjectives(room, 3); expect(room.players[0]!.objective!.status).toBe('EXIT_READY');
  });
  it('credits Kingmaker only when the assigned player exits and fails Executioner when their target exits', () => {
    const room = game(); room.round!.number = 2; objective(room, 0, 'kingmaker', 1);
    room.players[1]!.objective!.status = 'EXIT_READY';
    expect(objectiveCondition(room, room.players[0]!)).toBe(false);
    bankObjective(room, room.players[1]!, 2); expect(objectiveCondition(room, room.players[0]!)).toBe(true);
    objective(room, 0, 'executioner', 1); evaluateObjectives(room, 2);
    expect(room.players[0]!.objective!.status).toBe('FAILED');
  });
  it('counts two resolved opponents for 3P/4P Survivor and keeps unlock round', () => {
    const room = game(); objective(room, 0, 'survivor');
    bankObjective(room, room.players[1]!, 2); expect(objectiveCondition(room, room.players[0]!)).toBe(false);
    room.players[2]!.life = 'DEAD'; room.players[2]!.hp = 0;
    evaluateObjectives(room, 3); expect(room.players[0]!.objective!.status).toBe('ACTIVE');
    room.round!.number = 3; evaluateObjectives(room, 4); expect(room.players[0]!.objective!.status).toBe('EXIT_READY');
  });
  it('same-tick banks rank by completion timestamp then seat, irrespective of invocation order', () => {
    const room = game();
    room.players[0]!.objective!.firstReadyAt = 4; room.players[1]!.objective!.firstReadyAt = 3; room.players[2]!.objective!.firstReadyAt = 3;
    bankObjective(room, room.players[2]!, 10); bankObjective(room, room.players[0]!, 10); bankObjective(room, room.players[1]!, 10);
    expect(room.match!.exits).toEqual(['p1', 'p2', 'p0']);
    expect(room.players.map((player) => player.score)).toEqual([45, 100, 70, 0]);
  });
  it('rounds 80% contingency scoring to the nearest integer', () => {
    const room = game(3); bankObjective(room, room.players[0]!, 2);
    room.players[1]!.objective!.contingency = true; bankObjective(room, room.players[1]!, 3);
    expect(room.players[1]!.score).toBe(52);
  });
});

describe('forced closure and production safety interpretations', () => {
  it('auto-banks all Exit-Ready players when no objective remains ACTIVE', () => {
    let room = game();
    room.players.forEach((player, index) => {
      // These historical objectives latch; no possession requirement can silently expire.
      player.objective = { objectiveId: ['merchant', 'phoenix', 'betrayer', 'con-artist'][index]!, status: 'EXIT_READY', progress: {}, rewardGranted: true, firstReadyAt: index === 0 ? 5 : 3, readyOnTurn: 99 };
    });
    room = command(room, { type: 'END_TURN' });
    expect(room.status).toBe('RESULTS');
    expect(room.match!.exits).toEqual(['p1', 'p2', 'p3', 'p0']);
    expect(room.players.map((player) => player.score)).toEqual([25, 100, 70, 45]);
    expect(room.players.every((player) => player.objective!.status === 'BANKED')).toBe(true);
  });
  it('preserves the waiting window while any other assigned objective remains ACTIVE', () => {
    let room = game(); objective(room, 0, 'merchant'); room.players[0]!.objective!.status = 'EXIT_READY'; room.players[0]!.objective!.readyOnTurn = 2; room.players[0]!.objective!.firstReadyAt = 1;
    room = command(room, { type: 'END_TURN' });
    expect(room.status).toBe('PLAYING'); expect(room.players[0]!.life).toBe('ACTIVE');
  });
  it('skips current and queued disconnected shoppers and restores their next-turn seat', () => {
    let room = until(game(), (state) => state.round!.phase === 'INTERMISSION');
    const first = room.shop!.order[0]!; const second = room.shop!.order[1]!;
    room = setConnection(room, second, 'DISCONNECTED', room.updatedAt + 1);
    room = setConnection(room, first, 'DISCONNECTED', room.updatedAt + 1);
    expect(room.shop!.activeShopperIndex).toBe(2);
    expect(getNextDeadline(room)).toBeUndefined();
    room = until(room, (state) => state.round!.number === 2);
    room = setConnection(room, first, 'CONNECTED', room.updatedAt + 1);
    expect(room.players.find((player) => player.id === first)!.seat).toBe(Number(first.slice(1)));
  });
});

describe('Downed support items', () => {
  it('allows one extra Antidote help interaction without consuming the normal Primary Action', () => {
    let room = game(); const poison = give(room, 0, 'poison');
    room.players[2]!.hp = 1;
    room = command(room, { type: 'USE_ITEM', instanceId: poison.instanceId, targetId: 'p2' });
    room = advance(advance(room)); // Poison ticks at seat 3 and Downs its owner.
    expect(room.players[2]!.life).toBe('DOWNED');
    const antidote = give(room, 3, 'antidote');
    room = advance(room);
    room = command(room, { type: 'DOWNED_INTERACTION', kind: 'HELP', targetId: 'p2', instanceId: antidote.instanceId });
    expect(room.players[2]!.life).toBe('DOWNED'); expect(room.players[2]!.statuses).toEqual([]);
    expect(room.turn!.primaryUsed).toBe(false); expect(room.turn!.downedInteractionUsed).toBe(true);
  });
});
