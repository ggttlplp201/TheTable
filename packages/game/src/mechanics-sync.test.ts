import { describe, expect, it } from 'vitest';
import { applyCommand, applyTimeout, evaluateObjectives, getNextDeadline, projectAuthorizedRoom, projectPublicRoom, startMatch, type GameCommand, type PlayerState, type RoomState } from './index.js';
import { stack } from './inventory.js';
import { damage } from './combat.js';
import { beginIntermission } from './economy.js';

function game(seed = 77): RoomState {
  let room = startMatch({ id: 'mechanics-sync', code: 'ABC234', revision: 1, status: 'LOBBY', hostPlayerId: 'p0', createdAt: 0, updatedAt: 0,
    players: ['enforcer', 'medic', 'locksmith', 'broker'].map((roleId, seat) => ({ id: `p${seat}`, seat, name: `Player ${seat}`, normalizedName: `player ${seat}`, connection: 'CONNECTED', roleId, ready: true, hp: 5, score: 0, life: 'ACTIVE', inventory: { visible: Array(6).fill(null), pockets: [{ source: 'DEFAULT', protectedBySafe: false, item: null }], coins: 2 } })) as PlayerState[] }, { seed, now: 1 });
  room = applyTimeout(room, room.setup!.deadlineAt);
  room.players.forEach((player, index) => {
    player.objective = { objectiveId: ['tycoon', 'escapist', 'collector', 'arsenal'][index]!, status: 'ACTIVE', progress: {}, rewardGranted: false };
    player.inventory = { visible: Array(6).fill(null), pockets: [{ source: 'DEFAULT', protectedBySafe: false, item: null }], coins: 3 };
  });
  room.round!.number = 2;
  room.sideJobsByPlayer = {};
  return room;
}
const send = (room: RoomState, actor: string, command: GameCommand) => applyCommand(room, actor, command, room.updatedAt + 1);
function give(room: RoomState, playerIndex: number, itemId: string): string {
  const item = stack(room, itemId);
  const player = room.players[playerIndex]!;
  player.inventory.visible[player.inventory.visible.findIndex(value => !value)] = item;
  return item.instanceId;
}
function until(room: RoomState, condition: (room: RoomState) => boolean): RoomState {
  for (let steps = 0; !condition(room); steps++) {
    if (steps >= 40) throw new Error('Fixture did not reach the required state.');
    room = room.turn ? send(room, room.players.find(player => player.seat === room.turn!.activeSeat)!.id, { type: 'PASS_TURN' }) : applyTimeout(room, getNextDeadline(room)!);
  }
  return room;
}

describe('ZIP-priority objective mechanics', () => {
  it('requires a successful Trade as well as 15 Gold, retaining Trade credit while Gold and exit readiness change', () => {
    let room = game(); room.players[0]!.inventory.coins = 15;
    evaluateObjectives(room, room.updatedAt);
    expect(projectAuthorizedRoom(room, 'p0').private.objective).toMatchObject({ status: 'ACTIVE', progress: { coins: 15, required: 15, successfulTrades: 0, requiredTrades: 1 } });
    room = send(room, 'p0', { type: 'TRADE', targetId: 'p1', offeredItems: [], offeredCoins: 0, requestedItems: [], requestedCoins: 1 });
    room = send(room, 'p1', { type: 'RESPOND_TRADE', accept: true });
    expect(room.players[0]!.objective).toMatchObject({ status: 'EXIT_READY', readyOnTurn: 2, rewardGranted: true, progress: { successfulTrades: 1 } });
    expect(room.players[0]!.inventory.coins).toBe(19);
    room.players[0]!.inventory.coins = 14;
    evaluateObjectives(room, room.updatedAt);
    expect(room.players[0]!.objective).toMatchObject({ status: 'ACTIVE', progress: { successfulTrades: 1 } });
    room.players[0]!.inventory.coins = 15;
    evaluateObjectives(room, room.updatedAt);
    expect(room.players[0]!.objective).toMatchObject({ status: 'EXIT_READY', readyOnTurn: 2, progress: { successfulTrades: 1 } });
    expect(room.players[0]!.inventory.coins).toBe(15);
    expect(room.events!.filter(event => event.kind === 'OBJECTIVE_READY')).toHaveLength(2);
  });
  it.each(['decline', 'timeout', 'zero-transfer'])('does not give Tycoon Trade credit for %s', result => {
    let room = game(); room.players[0]!.inventory.coins = 15;
    room = send(room, 'p0', { type: 'TRADE', targetId: 'p1', offeredItems: [], offeredCoins: 0, requestedItems: [], requestedCoins: result === 'zero-transfer' ? 0 : 1 });
    room = result === 'timeout' ? applyTimeout(room, room.pendingTrade!.deadlineAt) : send(room, 'p1', { type: 'RESPOND_TRADE', accept: result !== 'decline' });
    expect(room.players[0]!.objective).toMatchObject({ status: 'ACTIVE', rewardGranted: false, progress: { successfulTrades: 0 } });
  });
  it('counts a successful item Trade for the recipient, but never substitutes Trade credit for 15 Gold', () => {
    let room = game();
    room.players[0]!.objective!.objectiveId = 'phoenix';
    room.players[1]!.objective!.objectiveId = 'tycoon';
    const knife = give(room, 0, 'knife');
    room = send(room, 'p0', { type: 'TRADE', targetId: 'p1', offeredItems: [knife], offeredCoins: 0, requestedItems: [], requestedCoins: 0 });
    room = send(room, 'p1', { type: 'RESPOND_TRADE', accept: true });
    expect(room.players[1]!.objective).toMatchObject({ status: 'ACTIVE', progress: { coins: 3, successfulTrades: 1 } });
  });
  it('guarantees Phoenix one private first-market Medicine opportunity at 4 Gold and never repeats the discount', () => {
    let room = game(); room.round!.number = 1; room.players[0]!.objective!.objectiveId = 'phoenix';
    room = until(room, state => state.round?.phase === 'INTERMISSION');
    expect(room.players[0]!.inventory.coins).toBe(5);
    const medicine = room.shop!.privateOffers.p0!.filter(offer => offer.itemId === 'medicine');
    expect(medicine).toHaveLength(1); expect(medicine[0]!.price).toBe(4);
    expect(projectPublicRoom(room).shop).not.toHaveProperty('privateOffers');
    expect(projectAuthorizedRoom(room, 'p1').private.blackMarket).toBeUndefined();
    expect(projectAuthorizedRoom(room, 'p0').private.blackMarket).toBeUndefined();
    room = until(room, state => Boolean(state.shop?.privateUnlockedBy.p0));
    expect(projectAuthorizedRoom(room, 'p0').private.blackMarket).toContainEqual(medicine[0]);
    expect(JSON.stringify(projectAuthorizedRoom(room, 'p1'))).not.toContain(medicine[0]!.id);
    room = until(room, state => state.round?.number === 2 && state.round.phase === 'INTERMISSION');
    expect(room.shop!.privateOffers.p0!.filter(offer => offer.itemId === 'medicine').every(offer => offer.price === 5)).toBe(true);
  });
  it.each(['visible', 'pocket'])('does not force or discount Medicine when Phoenix already owns it in a %s slot', location => {
    let room = game(); room.players[0]!.objective!.objectiveId = 'phoenix';
    give(room, 0, 'medicine');
    if (location === 'pocket') { room.players[0]!.inventory.pockets[0]!.item = room.players[0]!.inventory.visible[0]!; room.players[0]!.inventory.visible[0] = null; }
    room = until(room, state => state.round?.phase === 'INTERMISSION');
    expect(room.players[0]!.phoenixMedicineOfferSeen).toBe(true);
    expect(room.shop!.privateOffers.p0!.filter(offer => offer.itemId === 'medicine').every(offer => offer.price === 5)).toBe(true);
    room.players[0]!.inventory.visible.fill(null); room.players[0]!.inventory.pockets[0]!.item = null;
    room = until(room, state => state.round?.number === 3 && state.round.phase === 'INTERMISSION');
    expect(room.shop!.privateOffers.p0!.filter(offer => offer.itemId === 'medicine').every(offer => offer.price === 5)).toBe(true);
  });
});

describe('Stimulant and public Temporary HP', () => {
  it('is available from Public support, private Black Markets and normal Uncommon Chest loot', () => {
    const publicItems = new Set<string>(), privateItems = new Set<string>(), chestItems = new Set<string>();
    for (let seed = 1; seed <= 100; seed++) {
      const room = game(seed * 7919);
      room.chests!.forEach(chest => chest.loot.forEach(loot => { if (loot.kind === 'ITEM') chestItems.add(loot.stack.itemId); }));
      beginIntermission(room, room.updatedAt);
      room.shop!.publicOffers.forEach(offer => publicItems.add(offer.itemId));
      Object.values(room.shop!.privateOffers).flat().forEach(offer => privateItems.add(offer.itemId));
    }
    expect(publicItems.has('stimulant')).toBe(true);
    expect(privateItems.has('stimulant')).toBe(true);
    expect(chestItems.has('stimulant')).toBe(true);
  });
  it('heals another living player, converts surplus into public Temporary HP, and consumes its item and Primary Action', () => {
    let room = game(); room.players[1]!.hp = 4;
    const stimulant = give(room, 0, 'stimulant');
    room = send(room, 'p0', { type: 'USE_ITEM', instanceId: stimulant, targetId: 'p1' });
    expect(room.players[1]).toMatchObject({ hp: 5, temporaryHp: 1 });
    expect(projectPublicRoom(room).players[1]).toMatchObject({ hp: 5, temporaryHp: 1 });
    expect(room.players[0]!.inventory.visible.some(item => item?.instanceId === stimulant)).toBe(false);
    expect(room.turn!.activeSeat).toBe(1);
    expect(room.events!.filter(event => event.kind === 'STIMULANT_USED')).toHaveLength(1);
    expect(room.events!.find(event => event.kind === 'STIMULANT_USED')!.presentation).toMatchObject({ itemId: 'stimulant', hpChanges: [{ playerId: 'p1', amount: 1 }], temporaryHpChanges: [{ playerId: 'p1', amount: 1 }] });
    expect(room.events!.some(event => event.kind === 'HEALED')).toBe(false);
  });
  it.each([
    { hp: 2, temporaryHp: 0, expectedHp: 4, expectedTemporaryHp: 0 },
    { hp: 4, temporaryHp: 0, expectedHp: 5, expectedTemporaryHp: 1 },
    { hp: 5, temporaryHp: 0, expectedHp: 5, expectedTemporaryHp: 2 },
    { hp: 5, temporaryHp: 1, expectedHp: 5, expectedTemporaryHp: 2 },
  ])('restores two points subject to the normal and Temporary HP caps: $hp +$temporaryHp', ({ hp, temporaryHp, expectedHp, expectedTemporaryHp }) => {
    let room = game(); Object.assign(room.players[0]!, { hp, temporaryHp });
    const stimulant = give(room, 0, 'stimulant');
    room.players[0]!.inventory.pockets[0]!.item = room.players[0]!.inventory.visible[0]!; room.players[0]!.inventory.visible[0] = null;
    room = send(room, 'p0', { type: 'USE_ITEM', instanceId: stimulant });
    expect(room.players[0]).toMatchObject({ hp: expectedHp, temporaryHp: expectedTemporaryHp });
    expect(room.players[0]!.inventory.pockets[0]!.item).toBeNull();
  });
  it('rejects zero-benefit Stimulant use atomically', () => {
    const room = game(); room.players[1]!.temporaryHp = 2;
    const stimulant = give(room, 0, 'stimulant'); const before = structuredClone(room);
    expect(() => send(room, 'p0', { type: 'USE_ITEM', instanceId: stimulant, targetId: 'p1' })).toThrow(/no effect/i);
    expect(room).toEqual(before);
  });
  it.each(['knife', 'pistol'])('absorbs %s damage with Armor before Temporary HP before normal HP', weapon => {
    for (const armored of [false, true]) {
      let room = game(); const stimulant = give(room, 0, 'stimulant');
      if (armored) give(room, 0, 'armor');
      const weaponId = give(room, 1, weapon); if (weapon === 'pistol') give(room, 1, 'bullet');
      room = send(room, 'p0', { type: 'USE_ITEM', instanceId: stimulant });
      room = send(room, 'p1', { type: 'USE_ITEM', instanceId: weaponId, targetId: 'p0' });
      expect(room.players[0]).toMatchObject({ hp: armored || weapon === 'knife' ? 5 : 4, temporaryHp: armored ? 2 : 0 });
      expect(room.players[0]!.inventory.visible.some(item => item?.itemId === 'armor')).toBe(false);
      if (!armored) expect(room.events!.find(event => event.kind === 'DAMAGE')!.presentation).toMatchObject({ hpChanges: [{ playerId: 'p0', amount: weapon === 'knife' ? 0 : -1 }], temporaryHpChanges: [{ playerId: 'p0', amount: -2 }] });
      else expect(room.events!.filter(event => event.kind === 'ARMOR_BLOCKED')).toHaveLength(1);
    }
  });
  it('retains Temporary HP through Round end and absorbs Poison before normal HP while leaving Armor intact', () => {
    let room = game(); const stimulant = give(room, 0, 'stimulant'); give(room, 0, 'armor'); const poison = give(room, 1, 'poison');
    room = send(room, 'p0', { type: 'USE_ITEM', instanceId: stimulant });
    room = send(room, 'p1', { type: 'USE_ITEM', instanceId: poison, targetId: 'p0' });
    room = until(room, state => state.round?.phase === 'INTERMISSION');
    expect(room.players[0]).toMatchObject({ hp: 5, temporaryHp: 2 });
    for (const [round, hp, temporaryHp] of [[3, 5, 1], [4, 5, 0], [5, 4, 0]]) {
      room = until(room, state => state.round?.number === round && state.round?.phase === 'TURN');
      expect(room.players[0]).toMatchObject({ hp, temporaryHp });
    }
    expect(room.players[0]!.inventory.visible.some(item => item?.itemId === 'armor')).toBe(true);
    expect(room.events!.filter(event => event.kind === 'POISON_DAMAGE').map(event => event.presentation!.temporaryHpChanges![0]!.amount)).toEqual([-1, -1, 0]);
  });
  it('Medicine restores only normal HP and preserves existing Temporary HP', () => {
    let room = game(); room.players[0]!.hp = 4; room.players[0]!.temporaryHp = 1;
    const medicine = give(room, 0, 'medicine');
    room = send(room, 'p0', { type: 'USE_ITEM', instanceId: medicine });
    expect(room.players[0]).toMatchObject({ hp: 5, temporaryHp: 1 });
    expect(room.events!.find(event => event.kind === 'HEALED')!.presentation).toMatchObject({ hpChanges: [{ playerId: 'p0', amount: 1 }] });
  });
  it('rejects Stimulant for Downed targets and users, and revival returns with zero Temporary HP', () => {
    let room = game(); const stimulant = give(room, 0, 'stimulant'); const medicine = give(room, 0, 'medicine');
    room.players[1]!.temporaryHp = 2;
    damage(room, room.players[2]!, room.players[1]!, 7, room.updatedAt, true);
    expect(room.players[1]).toMatchObject({ life: 'DOWNED', hp: 0, temporaryHp: 0 });
    expect(() => send(room, 'p0', { type: 'USE_ITEM', instanceId: stimulant, targetId: 'p1' })).toThrow(/non-Downed|cannot revive/i);
    const downedUser = structuredClone(room);
    damage(downedUser, downedUser.players[3]!, downedUser.players[0]!, 5, room.updatedAt, true);
    expect(() => send(downedUser, 'p0', { type: 'USE_ITEM', instanceId: stimulant })).toThrow(/only self-revive with Medicine/i);
    room = send(room, 'p0', { type: 'USE_ITEM', instanceId: medicine, targetId: 'p1' });
    expect(room.players[1]).toMatchObject({ life: 'ACTIVE', hp: 2, temporaryHp: 0 });
  });
  it.each([{ hp: 4, targetId: 'p1', completed: true }, { hp: 5, targetId: 'p1', completed: false }, { hp: 4, targetId: 'p0', completed: false }])('awards HEAL only for normal HP restored to another living player: $hp HP, $targetId', ({ hp, targetId, completed }) => {
    let room = game(); room.players.find(player => player.id === targetId)!.hp = hp;
    const stimulant = give(room, 0, 'stimulant');
    room.sideJobsByPlayer!.p0 = { round: room.round!.number, reward: 2, jobs: [{ id: 'heal', status: 'ACTIVE', progress: 0, prerequisites: [] }, { id: 'trade', status: 'ACTIVE', progress: 0, prerequisites: [] }], completed: false, replacementUsed: false, opportunityTaken: true };
    room = send(room, 'p0', { type: 'USE_ITEM', instanceId: stimulant, targetId });
    expect(room.sideJobsByPlayer!.p0!.completed).toBe(completed);
    expect(room.players[0]!.inventory.coins).toBe(completed ? 5 : 3);
  });
});
