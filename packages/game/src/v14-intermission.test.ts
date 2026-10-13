import { describe, expect, it } from 'vitest';
import { initiateThreat, initiateTrade, resolveThreat, resolveTrade } from './actions.js';
import { RULES } from './content.js';
import { beginIntermission } from './economy.js';
import { applyCommand, applyTimeout, getNextDeadline, setConnection, startMatch } from './engine.js';
import { advanceIntermission, canManageIntermission, canUsePrivateMarket, finishIntermissionPlayer, isPublicShopper, resolvePublicDecision } from './intermission.js';
import { acquire, isResaleEligible, removeItem, stack, syncEquipment } from './inventory.js';
import { projectAuthorizedRoom, projectPublicRoom } from './room.js';
import { ROLE_IDS, type GameCommand, type PlayerState, type RoomState } from './types.js';

function intermission(): RoomState {
  const lobby: RoomState = {
    id: 'v14-intermission', code: 'ABC234', status: 'LOBBY', revision: 1, hostPlayerId: 'p0', createdAt: 0, updatedAt: 0,
    players: Array.from({ length: 4 }, (_, seat) => ({
      id: `p${seat}`, seat: seat as PlayerState['seat'], name: `Player ${seat}`, normalizedName: `player ${seat}`,
      connection: 'CONNECTED', roleId: ROLE_IDS[seat]!, ready: true, hp: 5, score: 0, life: 'ACTIVE',
      inventory: { visible: Array<null>(6).fill(null), pockets: [{ source: 'DEFAULT', protectedBySafe: false, item: null }], coins: 0 },
    })),
  };
  let room = startMatch(lobby, { seed: 812, now: 1 });
  room = applyTimeout(room, room.setup!.deadlineAt);
  const objectives = ['arsenal', 'collector', 'phoenix', 'poisoner'];
  for (const [index, player] of room.players.entries()) {
    player.objective = { objectiveId: objectives[index]!, status: 'ACTIVE', progress: {}, rewardGranted: false };
    player.inventory = { visible: [stack(room, 'knife'), stack(room, 'bullet', 2), stack(room, 'cloth'), null, null, null], coins: 20, pockets: [{ source: 'DEFAULT', protectedBySafe: false, item: null }] };
    player.safeAssignments = {};
  }
  room.updatedAt += 1;
  beginIntermission(room, room.updatedAt);
  return room;
}
function command(room: RoomState, playerId: string, action: GameCommand): RoomState {
  return applyCommand(room, playerId, action, room.updatedAt + 1);
}
function openPublic(room: RoomState): RoomState {
  return applyTimeout(room, room.shop!.prepDeadlineAt);
}
function currentShopper(room: RoomState): string {
  return room.shop!.order[room.shop!.activeShopperIndex]!;
}
function normalTurn(): RoomState {
  const room = intermission();
  delete room.shop;
  room.round!.phase = 'TURN';
  room.turn = { activeSeat: 0, serial: ++room.match!.turnSerial, startedAt: room.updatedAt, deadlineAt: room.updatedAt + RULES.turnMs, primaryUsed: false, downedInteractionUsed: false, exitDeclined: false, startedDowned: false };
  return room;
}

describe('v14 Intermission pipeline', () => {
  it('allows simultaneous preparation while all private markets and Public buying remain locked', () => {
    let room = intermission();
    expect(getNextDeadline(room)).toBe(room.shop!.prepDeadlineAt);
    expect(room.shop!.prepDeadlineAt - room.updatedAt).toBe(RULES.intermissionPrepMs);
    for (const player of room.players) {
      expect(canManageIntermission(room, player)).toBe(true);
      expect(canUsePrivateMarket(room, player)).toBe(false);
      expect(isPublicShopper(room, player)).toBe(false);
      expect(projectAuthorizedRoom(room, player.id).private.blackMarket).toBeUndefined();
      expect(() => command(room, player.id, { type: 'FINISH_SHOPPING' })).toThrow();
      expect(() => command(room, player.id, { type: 'BUY', market: 'PUBLIC', offerId: room.shop!.publicOffers[0]!.id })).toThrow();
      room = command(room, player.id, { type: 'SELL', instanceId: player.inventory.visible[0]!.instanceId });
      room = command(room, player.id, { type: 'POCKET', instanceId: player.inventory.visible[2]!.instanceId, pocketIndex: 0 });
    }
    expect(room.shop!.activeShopperIndex).toBe(0);
    expect(room.players.every(player => player.inventory.pockets[0]!.item?.itemId === 'cloth')).toBe(true);
  });

  it('unlocks the first private market and advances Public immediately, allowing both buyers concurrently', () => {
    let room = openPublic(intermission());
    const first = currentShopper(room);
    const second = room.shop!.order[1]!;
    room = command(room, first, { type: 'SKIP_PUBLIC_SHOP' });
    expect(currentShopper(room)).toBe(second);
    expect(room.shop!.publicDeadlineAt).toBe(room.updatedAt + RULES.publicShopDecisionMs);
    expect(room.shop!.privateUnlockedBy[first]).toBe(true);
    const firstView = projectAuthorizedRoom(room, first);
    expect(firstView.private.blackMarket).toEqual(room.shop!.privateOffers[first]);
    expect(projectAuthorizedRoom(room, second).private.blackMarket).toBeUndefined();
    expect(projectPublicRoom(room).shop).not.toHaveProperty('privateOffers');
    expect(projectPublicRoom(room).shop).not.toHaveProperty('privatePurchasedBy');
    expect(() => command(room, second, { type: 'BUY', market: 'BLACK', offerId: room.shop!.privateOffers[second]![0]!.id })).toThrow();
    room = command(room, first, { type: 'BUY', market: 'BLACK', offerId: room.shop!.privateOffers[first]![0]!.id });
    expect(room.shop!.privatePurchasedBy[first]).toBe(true);
    expect(() => command(room, first, { type: 'BUY', market: 'BLACK', offerId: room.shop!.privateOffers[first]![1]!.id })).toThrow();
    room = command(room, second, { type: 'BUY', market: 'PUBLIC', offerId: room.shop!.publicOffers[0]!.id });
    expect(room.shop!.activeShopperIndex).toBe(2);
    expect(room.shop!.privateUnlockedBy[second]).toBe(true);
    expect(() => command(room, first, { type: 'BUY', market: 'PUBLIC', offerId: room.shop!.publicOffers[0]!.id })).toThrow();
  });

  it('allows old-item resale after buying and locks all current-Intermission acquisitions', () => {
    let room = openPublic(intermission());
    const first = currentShopper(room);
    const oldKnife = room.players.find(player => player.id === first)!.inventory.visible[0]!;
    const publicOffer = room.shop!.publicOffers[0]!;
    room = command(room, first, { type: 'BUY', market: 'PUBLIC', offerId: publicOffer.id });
    let owner = room.players.find(player => player.id === first)!;
    const purchased = owner.inventory.visible.find(item => item?.acquiredIntermissionId === room.shop!.id)!;
    expect(purchased).toBeDefined();
    expect(() => command(room, first, { type: 'SELL', instanceId: purchased.instanceId })).toThrow(/Intermission|acquired/i);
    room = command(room, first, { type: 'SELL', instanceId: oldKnife.instanceId });
    owner = room.players.find(player => player.id === first)!;
    expect(owner.inventory.visible.some(item => item?.instanceId === oldKnife.instanceId)).toBe(false);
    if (purchased.itemId !== 'bag' && purchased.itemId !== 'safe' && purchased.itemId !== 'armor') {
      room = command(room, first, { type: 'POCKET', instanceId: purchased.instanceId, pocketIndex: 0 });
      expect(room.players.find(player => player.id === first)!.inventory.pockets[0]!.item?.instanceId).toBe(purchased.instanceId);
    }
  });

  it('automatically passes Public deadlines and finishes the private grace deadline', () => {
    let room = openPublic(intermission());
    expect(room.shop!.publicDeadlineAt).toBe(room.updatedAt + RULES.publicShopDecisionMs);
    const order = [...room.shop!.order];
    for (const playerId of order) {
      expect(currentShopper(room)).toBe(playerId);
      const deadline = room.shop!.publicDeadlineAt!;
      expect(applyTimeout(room, deadline - 1)).toBe(room);
      room = applyTimeout(room, deadline);
      expect(room.shop!.publicSkippedBy![playerId]).toBe(true);
      expect(room.shop!.privateUnlockedBy[playerId]).toBe(true);
    }
    expect(room.shop!.phase).toBe('GRACE');
    expect(room.shop!.privateDeadlineAt).toBe(room.updatedAt + RULES.privateMarketGraceMs);
    const graceDeadline = getNextDeadline(room)!;
    expect(applyTimeout(room, graceDeadline - 1)).toBe(room);
    room = applyTimeout(room, graceDeadline);
    expect(room.round!.phase).toBe('TURN');
    expect(room.round!.number).toBe(2);
    expect(room.shop).toBeUndefined();
    expect(room.events!.filter(event => event.kind === 'PUBLIC_SHOP_PASSED')).toHaveLength(4);
    expect(room.events!.filter(event => event.kind === 'INTERMISSION_PLAYER_FINISHED')).toHaveLength(4);
  });

  it('lets resolved players finish independently and begins the next round as soon as everyone finishes', () => {
    let room = openPublic(intermission());
    const order = [...room.shop!.order];
    for (const [index, playerId] of order.entries()) {
      room = command(room, playerId, { type: 'SKIP_PUBLIC_SHOP' });
      room = command(room, playerId, { type: 'FINISH_SHOPPING' });
      if (index < order.length - 1) {
        expect(room.shop!.finishedBy[playerId]).toBe(true);
        expect(room.shop!.activeShopperIndex).toBe(index + 1);
        expect(() => command(room, playerId, { type: 'SELL', instanceId: room.players.find(player => player.id === playerId)!.inventory.visible[0]!.instanceId })).toThrow();
      }
    }
    expect(room.round!.phase).toBe('TURN');
    expect(room.round!.number).toBe(2);
  });

  it('makes disconnects pass and finish without granting another opportunity after reconnection', () => {
    let room = intermission();
    const first = room.shop!.order[0]!;
    room = setConnection(room, first, 'DISCONNECTED', room.updatedAt + 1);
    expect(room.shop!.publicSkippedBy![first]).toBe(true);
    expect(room.shop!.finishedBy[first]).toBe(true);
    room = setConnection(room, first, 'CONNECTED', room.updatedAt + 1);
    room = openPublic(room);
    expect(room.shop!.activeShopperIndex).toBe(1);
    expect(canManageIntermission(room, room.players.find(player => player.id === first)!)).toBe(false);
    const second = currentShopper(room);
    room = command(room, second, { type: 'SKIP_PUBLIC_SHOP' });
    room = setConnection(room, second, 'DISCONNECTED', room.updatedAt + 1);
    expect(room.shop!.finishedBy[second]).toBe(true);
    expect(room.shop!.activeShopperIndex).toBe(2);
    expect(room.events!.filter(event => event.kind === 'PUBLIC_SHOP_PASSED' && event.actorId === first)).toHaveLength(1);
  });

  it('does not let one player\'s inventory overflow block other Public shoppers or grace completion', () => {
    let room = openPublic(intermission());
    const first = currentShopper(room);
    const owner = room.players.find(player => player.id === first)!;
    owner.inventory.visible = Array.from({ length: 6 }, () => stack(room, 'knife'));
    room.shop!.publicOffers[0]!.itemId = 'medicine';
    room = command(room, first, { type: 'BUY', market: 'PUBLIC', offerId: room.shop!.publicOffers[0]!.id });
    expect(room.overflows).toHaveLength(1);
    expect(room.shop!.activeShopperIndex).toBe(1);
    while (room.shop!.phase === 'PUBLIC') room = command(room, currentShopper(room), { type: 'SKIP_PUBLIC_SHOP' });
    expect(room.shop!.phase).toBe('GRACE');
    room = applyTimeout(room, room.shop!.privateDeadlineAt!);
    expect(room.overflows).toHaveLength(0);
    expect(room.round!.phase).toBe('TURN');
  });

  it('closes even a late private purchase overflow at grace expiry and keeps the existing inventory', () => {
    let room = openPublic(intermission());
    const first = currentShopper(room);
    while (room.shop!.phase === 'PUBLIC') room = command(room, currentShopper(room), { type: 'SKIP_PUBLIC_SHOP' });
    const owner = room.players.find(player => player.id === first)!;
    owner.inventory.visible = Array.from({ length: 6 }, () => stack(room, 'knife'));
    const originalIds = owner.inventory.visible.map(item => item!.instanceId);
    const offer = room.shop!.privateOffers[first]![0]!;
    offer.itemId = 'medicine';
    const graceDeadline = room.shop!.privateDeadlineAt!;
    room = applyCommand(room, first, { type: 'BUY', market: 'BLACK', offerId: offer.id }, graceDeadline - 1);
    expect(room.overflows![0]!.deadlineAt).toBeGreaterThan(graceDeadline);
    expect(getNextDeadline(room)).toBe(graceDeadline);
    room = applyTimeout(room, graceDeadline);
    expect(room.overflows).toHaveLength(0);
    expect(room.round!.phase).toBe('TURN');
    expect(room.players.find(player => player.id === first)!.inventory.visible.map(item => item!.instanceId)).toEqual(originalIds);
  });

  it('skips a newly ineligible shopper without letting Downed players shop', () => {
    const room = intermission();
    const first = currentShopper(room);
    const player = room.players.find(player => player.id === first)!;
    player.life = 'DOWNED';
    expect(canManageIntermission(room, player)).toBe(false);
    expect(advanceIntermission(room, room.shop!.prepDeadlineAt)).toBe(false);
    expect(room.shop!.finishedBy[first]).toBe(true);
    expect(room.shop!.publicSkippedBy![first]).toBe(true);
    expect(room.shop!.activeShopperIndex).toBe(1);
  });
});

describe('v14 acquisition provenance', () => {
  it('marks all acquisition paths and conservatively locks mixed Bullet stacks until the next Intermission', () => {
    const room = intermission();
    const owner = room.players[0]!;
    const bullets = owner.inventory.visible[1]!;
    expect(isResaleEligible(room, bullets)).toBe(true);
    acquire(room, owner, stack(room, 'bullet'), room.updatedAt);
    expect(bullets.quantity).toBe(3);
    expect(bullets.acquiredIntermissionId).toBe(room.shop!.id);
    expect(isResaleEligible(room, bullets)).toBe(false);
    const acquired = stack(room, 'medicine');
    acquire(room, owner, acquired, room.updatedAt);
    expect(isResaleEligible(room, acquired)).toBe(false);
    const previousId = room.shop!.id;
    room.round!.number += 1;
    beginIntermission(room, room.updatedAt + 1);
    expect(room.shop!.id).not.toBe(previousId);
    expect(isResaleEligible(room, acquired)).toBe(true);
    expect(isResaleEligible(room, bullets)).toBe(true);
    expect(isResaleEligible(room, stack(room, 'brass-idol'))).toBe(false);
    expect(isResaleEligible(room, stack(room, 'passage-token'))).toBe(false);
  });

  it('preserves acquisition age when losing Bag ejects an already-owned Pocket item', () => {
    const room = intermission();
    const owner = room.players[0]!;
    const bag = stack(room, 'bag');
    owner.inventory.visible[3] = bag;
    syncEquipment(room, owner, room.updatedAt);
    const oldItem = stack(room, 'medicine');
    owner.inventory.pockets[1]!.item = oldItem;
    removeItem(owner, bag.instanceId);
    syncEquipment(room, owner, room.updatedAt);
    expect(owner.inventory.visible).toContain(oldItem);
    expect(isResaleEligible(room, oldItem)).toBe(true);
  });

  it('stamps overflow acquisitions and clears all disconnected players without stalling Prep', () => {
    const room = intermission();
    const owner = room.players[0]!;
    owner.inventory.visible = Array.from({ length: 6 }, () => stack(room, 'knife'));
    const incoming = stack(room, 'medicine');
    acquire(room, owner, incoming, room.updatedAt);
    expect(room.overflows![0]!.incoming.acquiredIntermissionId).toBe(room.shop!.id);
    for (const player of room.players) player.connection = 'DISCONNECTED';
    expect(advanceIntermission(room, room.updatedAt)).toBe(true);
    expect(room.overflows).toHaveLength(0);
    expect(Object.keys(room.shop!.finishedBy)).toHaveLength(4);
  });

  it('private completion cannot run before Public resolution and never advances another public choice', () => {
    const room = intermission();
    const first = room.shop!.order[0]!;
    expect(() => finishIntermissionPlayer(room, first, room.updatedAt)).toThrow(/Public Shop/);
    expect(advanceIntermission(room, room.shop!.prepDeadlineAt)).toBe(false);
    resolvePublicDecision(room, first, room.shop!.prepDeadlineAt + 1);
    const nextDeadline = room.shop!.publicDeadlineAt;
    finishIntermissionPlayer(room, first, room.shop!.prepDeadlineAt + 2);
    expect(room.shop!.activeShopperIndex).toBe(1);
    expect(room.shop!.publicDeadlineAt).toBe(nextDeadline);
  });
});

describe('v14 response resolution provenance', () => {
  it('never transfers Trade assets at timeout even when the caller supplied Accept, and releases locks', () => {
    const room = normalTurn();
    const [actor, target] = room.players;
    const before = room.players.map(player => structuredClone(player.inventory));
    initiateTrade(room, actor!, { type: 'TRADE', targetId: target!.id, offeredItems: [actor!.inventory.visible[0]!.instanceId], requestedItems: [target!.inventory.visible[0]!.instanceId], offeredCoins: 3, requestedCoins: 7 }, room.updatedAt);
    const deadline = room.pendingTrade!.deadlineAt;
    resolveTrade(room, true, deadline, false, true);
    expect(room.players.map(player => player.inventory)).toEqual(before);
    expect(room.pendingTrade).toBeUndefined();
    expect(room.turn!.pausedRemainingMs).toBeUndefined();
    expect(room.turn!.pendingInteractionId).toBeUndefined();
    expect(room.match!.history.trades).toHaveLength(0);
    expect(room.events!.at(-1)).toMatchObject({ kind: 'TRADE_EXPIRED_DECLINED', publicText: 'Trade expired — declined.', presentation: { resolution: 'TIMEOUT' } });
  });

  it.each([true, false])('records an explicit Trade response as manual (Accept: %s)', accept => {
    const room = normalTurn();
    const [actor, target] = room.players;
    initiateTrade(room, actor!, { type: 'TRADE', targetId: target!.id, offeredItems: [], requestedItems: [], offeredCoins: 3, requestedCoins: 0 }, room.updatedAt);
    resolveTrade(room, accept, room.updatedAt + 1);
    expect(actor!.inventory.coins).toBe(accept ? 17 : 20);
    expect(target!.inventory.coins).toBe(accept ? 23 : 20);
    expect(room.match!.history.trades).toHaveLength(accept ? 1 : 0);
    expect(room.events!.at(-1)).toMatchObject({ kind: accept ? 'TRADE_ACCEPTED' : 'TRADE_DECLINED', presentation: { resolution: 'MANUAL' } });
  });

  it('preserves disconnect cancellation separately from a Trade timeout', () => {
    const room = normalTurn();
    const [actor, target] = room.players;
    initiateTrade(room, actor!, { type: 'TRADE', targetId: target!.id, offeredItems: [], requestedItems: [], offeredCoins: 3, requestedCoins: 0 }, room.updatedAt);
    resolveTrade(room, true, room.updatedAt + 1, true, true);
    expect(actor!.inventory.coins).toBe(20);
    expect(target!.inventory.coins).toBe(20);
    expect(room.events!.at(-1)).toMatchObject({ kind: 'TRADE_CANCELLED', presentation: { resolution: 'DISCONNECT' } });
  });

  it.each(['timeout', 'comply', 'refuse'] as const)('records %s Threat resolution while preserving covered reveal and weapon consumption', response => {
    const room = normalTurn();
    const [actor, target] = room.players;
    const knife = actor!.inventory.visible[0]!;
    initiateThreat(room, actor!, { type: 'THREAT', targetId: target!.id, mode: 'COVERED', committedItemId: knife.instanceId, clothItemId: actor!.inventory.visible[2]!.instanceId, demandedItems: [], demandedCoins: 2 }, room.updatedAt);
    // Timeout compliance is authoritative even if a stale caller supplies Refuse.
    resolveThreat(room, response === 'comply', room.updatedAt + RULES.responseMs, false, response === 'timeout');
    const complied = response !== 'refuse';
    expect(actor!.inventory.coins).toBe(complied ? 22 : 20);
    expect(target!.inventory.coins).toBe(complied ? 18 : 20);
    expect(target!.hp).toBe(complied ? 5 : 3);
    expect(actor!.inventory.visible.some(item => item?.instanceId === knife.instanceId)).toBe(complied);
    expect(room.match!.history.threats.at(-1)).toMatchObject({ complied, covered: true, validWeapon: true, assetsReceived: complied, resolution: response === 'timeout' ? 'TIMEOUT' : 'MANUAL' });
    expect(room.events!.at(-1)).toMatchObject({ kind: complied ? 'THREAT_COMPLIED' : 'THREAT_REFUSED', presentation: { itemId: 'knife', resolution: response === 'timeout' ? 'TIMEOUT' : 'MANUAL' } });
    expect(room.events!.at(-1)!.publicText).toContain('The covered item was Knife.');
  });
});
