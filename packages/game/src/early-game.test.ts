import { describe, expect, it } from 'vitest';
import { CHEST_DISTRIBUTIONS, GAME_CONSTANTS, ROLES, STARTING_BONUS_POOL } from '@the-table/content';
import {
  applyCommand, applyTimeout, assertRoomInvariants, getNextDeadline, ITEM_BY_ID,
  MATCH_OPENING_PRESENTATION_MS, projectAuthorizedRoom, projectPublicRoom, ROLE_IDS,
  setConnection, startMatch, type GameCommand, type ItemStack, type PlayerState, type RoomState,
} from './index.js';
import { refreshChests } from './economy.js';

function lobby(count = 4): RoomState {
  return { id: 'early-game', code: 'ABC234', status: 'LOBBY', revision: 1, hostPlayerId: 'p0', createdAt: 0, updatedAt: 0,
    players: Array.from({ length: count }, (_, seat) => ({
      id: `p${seat}`, seat: seat as PlayerState['seat'], name: `Player ${seat}`, normalizedName: `player ${seat}`,
      connection: 'CONNECTED', roleId: ROLE_IDS[seat]!, ready: true, hp: 5, score: 0, life: 'ACTIVE',
      inventory: { visible: Array<null>(6).fill(null), pockets: [{ source: 'DEFAULT', protectedBySafe: false, item: null }], coins: 0 },
    })),
  };
}
const possessions = (player: PlayerState): ItemStack[] => [...player.inventory.visible, ...player.inventory.pockets.map(pocket => pocket.item)].filter((item): item is ItemStack => item !== null);
function lock(room: RoomState, player: PlayerState, instanceId = player.inventory.visible.find(item => item && ITEM_BY_ID[item.itemId]!.pocketEligible)!.instanceId) {
  return applyCommand(room, player.id, { type: 'LOCK_SETUP', instanceId }, room.updatedAt + 1);
}
function complete(room: RoomState): RoomState {
  for (const player of room.players) if (!room.setup!.lockedPlayerIds.includes(player.id)) room = lock(room, player);
  return room;
}
function advance(room: RoomState): RoomState {
  if (room.shop) {
    if (room.shop.phase === 'PREP') return applyTimeout(room, room.shop.prepDeadlineAt);
    if (room.shop.phase === 'PUBLIC') return applyCommand(room, room.shop.order[room.shop.activeShopperIndex]!, { type: 'SKIP_PUBLIC_SHOP' }, room.updatedAt + 1);
    const unfinished = room.shop.order.find(id => !room.shop!.finishedBy[id])!;
    return applyCommand(room, unfinished, { type: 'FINISH_SHOPPING' }, room.updatedAt + 1);
  }
  const player = room.players.find(player => player.seat === room.turn!.activeSeat)!;
  return applyCommand(room, player.id, { type: 'END_TURN' }, room.updatedAt + 1);
}
function assertHidden(room: RoomState) {
  const publicView = projectPublicRoom(room);
  expect(publicView.players.every(player => player.visibleInventory.every(item => item === null) && player.pocketOccupancy.every(value => !value))).toBe(true);
  expect(publicView.setup).toEqual({ deadlineAt: room.setup!.deadlineAt, lockedPlayerIds: room.setup!.lockedPlayerIds });
  expect(publicView.turn).toBeUndefined();
  expect(publicView.shop).toBeUndefined();
  for (const owner of room.players) {
    const view = projectAuthorizedRoom(room, owner.id);
    for (const other of room.players.filter(player => player.id !== owner.id)) {
      for (const item of possessions(other)) expect(JSON.stringify(view)).not.toContain(JSON.stringify(item.instanceId));
    }
    expect(view.private.setup?.bonusItemInstanceId).toBe(owner.id === room.setup!.bonusPlayerId ? room.setup!.bonusItemInstanceId : undefined);
    expect(view.private.capabilities).toEqual(owner.connection === 'DISCONNECTED' ? [] : room.setup!.lockedPlayerIds.includes(owner.id) ? ['CHAT'] : ['CHAT', 'LOCK_SETUP']);
  }
}

describe('early-game balance and private setup', () => {
  it('allows only three or four connected, ready players with unique roles', () => {
    expect(GAME_CONSTANTS.minimumPlayers).toBe(3);
    expect(GAME_CONSTANTS.maximumPlayers).toBe(4);
    for (const count of [1, 2]) {
      const input = lobby(count);
      expect(() => startMatch(input, { seed: 1, now: 1 })).toThrow('three or four');
      expect(input.status).toBe('LOBBY');
    }
    for (const kind of ['disconnected', 'unready', 'missingRole', 'duplicateRole']) {
      const input = lobby();
      if (kind === 'disconnected') input.players[0]!.connection = 'DISCONNECTED';
      if (kind === 'unready') input.players[0]!.ready = false;
      if (kind === 'missingRole') delete input.players[0]!.roleId;
      if (kind === 'duplicateRole') input.players[0]!.roleId = input.players[1]!.roleId!;
      expect(() => startMatch(input, { seed: 1, now: 1 })).toThrow();
      expect(input.status).toBe('LOBBY');
    }
  });

  it.each([3, 4])('grants exactly one modest secret bonus across seeded %i-player starts', count => {
    const recipients = new Set<string>(); const selected = new Set<string>();
    expect(STARTING_BONUS_POOL).toEqual(['knife', 'poison', 'spyglass', 'handcuffs', 'medicine', 'key', 'cloth', 'bullet']);
    for (let seed = 1; seed <= 200; seed += 1) {
      const room = startMatch(lobby(count), { seed, now: 1 });
      const all = room.players.flatMap(possessions);
      expect(all).toHaveLength(count * 3 + 1);
      const owner = room.players.find(player => player.id === room.setup!.bonusPlayerId)!;
      const bonus = all.filter(item => item.instanceId === room.setup!.bonusItemInstanceId);
      expect(bonus).toHaveLength(1); expect(bonus[0]!.quantity).toBe(1);
      expect(STARTING_BONUS_POOL).toContain(bonus[0]!.itemId);
      expect(possessions(owner)).toContainEqual(bonus[0]);
      for (const player of room.players) {
        expect(player.inventory.visible.slice(0, 3).map(item => item!.itemId)).toEqual(ROLES[player.roleId!].startingItems);
        expect(player.inventory.coins).toBe(ROLES[player.roleId!].startingCoins);
        expect(player.inventory.pockets.every(pocket => pocket.item === null)).toBe(true);
      }
      recipients.add(owner.id); selected.add(bonus[0]!.itemId);
      assertHidden(room);
    }
    expect(recipients.size).toBe(count); expect(selected.size).toBe(8);
  });

  it.each([false, true])('reveals all inventories together; bonus recipient hides the bonus: %s', hideBonus => {
    let room = startMatch(lobby(), { seed: 99, now: 1 });
    const bonusId = room.setup!.bonusItemInstanceId;
    const ownerId = room.setup!.bonusPlayerId;
    const selected = new Map<string, string>();
    for (const player of [...room.players]) {
      assertHidden(room);
      const choice = hideBonus && player.id === ownerId ? bonusId : player.inventory.visible[0]!.instanceId;
      selected.set(player.id, choice);
      room = lock(room, player, choice);
      assertRoomInvariants(room);
    }
    expect(room.round).toMatchObject({ phase: 'TURN', number: 1 });
    expect(room.setup).toBeUndefined(); expect(room.shop).toBeUndefined();
    expect(room.turn!.activeSeat).toBe(0);
    expect(room.turn!.deadlineAt).toBe(room.updatedAt + GAME_CONSTANTS.normalTurnMs + MATCH_OPENING_PRESENTATION_MS);
    const view = projectPublicRoom(room);
    for (const player of room.players) {
      expect(player.inventory.pockets[0]!.item!.instanceId).toBe(selected.get(player.id));
      expect(JSON.stringify(view)).not.toContain(JSON.stringify(selected.get(player.id)));
      expect(view.players.find(other => other.id === player.id)!.visibleInventory).toEqual(player.inventory.visible);
      expect(player.inventory.pockets.slice(1).every(pocket => pocket.item === null)).toBe(true);
    }
    expect(JSON.stringify(view).includes(bonusId)).toBe(!hideBonus);
    expect(room.events!.filter(event => event.kind === 'MATCH_STARTED')).toHaveLength(1);
  });

  it('rejects foreign items, visible equipment, repeated choices, extra pockets, and game actions during setup atomically', () => {
    let room = startMatch(lobby(), { seed: 10, now: 1 });
    const original = structuredClone(room);
    expect(() => lock(room, room.players[0]!, room.players[1]!.inventory.visible[0]!.instanceId)).toThrow();
    expect(() => lock(room, room.players[2]!, room.players[2]!.inventory.visible[1]!.instanceId)).toThrow(/remain visible/);
    for (const action of [{ type: 'END_TURN' }, { type: 'FINISH_SHOPPING' }, { type: 'POCKET', instanceId: room.players[0]!.inventory.visible[0]!.instanceId, pocketIndex: 0 }] as GameCommand[]) {
      expect(() => applyCommand(room, 'p0', action, 2)).toThrow(/starting Pocket/);
    }
    expect(room).toEqual(original);
    room = lock(room, room.players[2]!);
    expect(room.players[2]!.inventory.pockets[1]!.item).toBeNull();
    expect(() => lock(room, room.players[2]!)).toThrow(/already locked/);
    const view = projectAuthorizedRoom(room, 'p2');
    view.private.setup!.items[0]!.itemId = 'pistol';
    expect(room.players[2]!.inventory.visible.some(item => item?.itemId === 'pistol')).toBe(false);
    assertHidden(room);
  });

  it('keeps locked choices on reconnect and completes all remaining choices atomically at the setup deadline', () => {
    let room = startMatch(lobby(), { seed: 10, now: 1 });
    const deadline = getNextDeadline(room)!;
    expect(deadline).toBe(1 + GAME_CONSTANTS.setupChoiceMs);
    room = lock(room, room.players[0]!, room.players[0]!.inventory.visible[2]!.instanceId);
    const pocketed = room.players[0]!.inventory.pockets[0]!.item;
    room = setConnection(room, 'p0', 'DISCONNECTED', 3);
    room = setConnection(room, 'p0', 'CONNECTED', 4);
    expect(projectAuthorizedRoom(room, 'p0').private.setup!.locked).toBe(true);
    room = setConnection(room, 'p1', 'DISCONNECTED', 5);
    assertHidden(room);
    expect(applyTimeout(room, deadline - 1)).toBe(room);
    expect(() => applyCommand(room, 'p2', { type: 'LOCK_SETUP', instanceId: room.players[2]!.inventory.visible[0]!.instanceId }, deadline)).toThrow(/deadline/);
    room = applyTimeout(room, deadline);
    expect(room.round!.number).toBe(1); expect(room.setup).toBeUndefined();
    expect(room.players.every(player => player.inventory.pockets[0]!.item)).toBe(true);
    expect(room.players[0]!.inventory.pockets[0]!.item).toEqual(pocketed);
    expect(room.players[1]!.inventory.pockets[0]!.item!.itemId).toBe('medicine');
    expect(applyTimeout(room, deadline)).toBe(room);
    assertRoomInvariants(room);
  });

  it('starts the Standard Chest in Round 1, then the first shop, Round 2, second shop, and Black Chest in Round 3', () => {
    let room = complete(startMatch(lobby(), { seed: 77, now: 1 }));
    const openingLoot = structuredClone(room.chests![0]!.loot);
    const phases: string[] = [`${room.round!.number}:${room.round!.phase}`];
    expect(room.chests!.map(chest => chest.availability)).toEqual(['AVAILABLE', 'HIDDEN']);
    for (let step = 0; room.round!.number < 3 && step < 40; step += 1) {
      room = advance(room);
      const phase = `${room.round!.number}:${room.round!.phase}`;
      if (phases.at(-1) !== phase) phases.push(phase);
      expect(room.chests![0]!.loot).toEqual(openingLoot);
    }
    expect(phases).toEqual(['1:TURN', '1:INTERMISSION', '2:TURN', '2:INTERMISSION', '3:TURN']);
    expect(room.chests![1]!.availability).toBe('AVAILABLE');
  });

  it.each([1, 2])('preserves opening loot until opened in Round %i and refills normally the next round', openingRound => {
    let room = complete(startMatch(lobby(), { seed: 77, now: 1 }));
    const original = structuredClone(room.chests![0]!.loot);
    for (let step = 0; !(room.round!.number === openingRound && room.turn?.activeSeat === 3) && step < 20; step += 1) room = advance(room);
    expect(room.chests![0]!.loot).toEqual(original);
    const key = possessions(room.players[3]!).find(item => item.itemId === 'key')!;
    room = applyCommand(room, 'p3', { type: 'USE_ITEM', instanceId: key.instanceId }, room.updatedAt + 1);
    expect(room.chests![0]).toMatchObject({ availability: 'OPENED', refreshRound: openingRound + 1, loot: [] });
    expect(possessions(room.players[3]!).some(item => item.instanceId === key.instanceId)).toBe(false);
    for (let step = 0; room.round!.number === openingRound && step < 10; step += 1) room = advance(room);
    expect(room.round!.number).toBe(openingRound + 1);
    expect(room.chests![0]!.availability).toBe('AVAILABLE');
    expect(room.chests![0]!.loot).toHaveLength(2);
    for (const entry of room.chests![0]!.loot) {
      if (entry.kind === 'ITEM') expect(ITEM_BY_ID[entry.stack.itemId]!.rarity).not.toBe('COMMON');
      else expect(entry.amount).toBeGreaterThanOrEqual(3);
    }
    assertRoomInvariants(room);
  });

  it('uses exact opening weights, excludes premium loot, and refreshes opened chests with the normal table', () => {
    expect(CHEST_DISTRIBUTIONS.openingStandard).toEqual({ slotA: { commonItem: 60, uncommonItem: 40 }, slotB: { coins2: 50, commonItem: 35, uncommonItem: 15 } });
    const aCounts = { COMMON: 0, UNCOMMON: 0 }; const bCounts = { COINS: 0, COMMON: 0, UNCOMMON: 0 };
    let premiumRefreshes = 0;
    for (let seed = 1; seed <= 600; seed += 1) {
      const room = complete(startMatch(lobby(3), { seed, now: 1 }));
      const chest = room.chests![0]!;
      const [a, b] = chest.loot;
      expect(a!.kind).toBe('ITEM');
      for (const loot of chest.loot) if (loot.kind === 'ITEM') expect(['COMMON', 'UNCOMMON']).toContain(ITEM_BY_ID[loot.stack.itemId]!.rarity); else expect(loot.amount).toBe(2);
      if (a?.kind === 'ITEM') aCounts[ITEM_BY_ID[a.stack.itemId]!.rarity as keyof typeof aCounts] += 1;
      bCounts[b!.kind === 'COINS' ? 'COINS' : ITEM_BY_ID[b!.stack.itemId]!.rarity as 'COMMON' | 'UNCOMMON'] += 1;
      expect(room.match!.artifactPool).toHaveLength(3); expect(room.match!.blackKeyObtainable).toBe(false);
      // Simulate opening at Round 1 or later: the next-round refresh is always normal.
      room.round!.number = seed % 2 ? 2 : 4;
      chest.availability = 'OPENED'; chest.loot = []; chest.refreshRound = room.round!.number;
      refreshChests(room, room.updatedAt);
      if (chest.loot.some(loot => loot.kind === 'COINS' ? loot.amount >= 3 : !['COMMON', 'UNCOMMON'].includes(ITEM_BY_ID[loot.stack.itemId]!.rarity))) premiumRefreshes += 1;
      expect(chest.availability).toBe('AVAILABLE');
      expect(chest.refreshRound).toBeUndefined();
    }
    // Broad deterministic sampling catches accidental use of the normal table or a missing weighted branch.
    expect(aCounts.COMMON / 600).toBeGreaterThan(.5); expect(aCounts.COMMON / 600).toBeLessThan(.7);
    expect(bCounts.COINS / 600).toBeGreaterThan(.4); expect(bCounts.COINS / 600).toBeLessThan(.6);
    expect(bCounts.COMMON / 600).toBeGreaterThan(.25); expect(bCounts.COMMON / 600).toBeLessThan(.45);
    expect(bCounts.UNCOMMON / 600).toBeGreaterThan(.08); expect(bCounts.UNCOMMON / 600).toBeLessThan(.22);
    expect(premiumRefreshes).toBeGreaterThan(300);
  });
});
