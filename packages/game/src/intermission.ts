import { RULES } from './content.js';
import { event, playerById, requireRule } from './internal.js';
import { resolveOverflow } from './inventory.js';
import type { PlayerState, RoomState } from './types.js';

export function canManageIntermission(room: RoomState, player: PlayerState): boolean {
  return room.status === 'PLAYING' && room.round?.phase === 'INTERMISSION'
    && Boolean(room.shop?.order.includes(player.id)) && !room.shop?.finishedBy[player.id]
    && player.life === 'ACTIVE' && player.connection === 'CONNECTED';
}

export function isPublicShopper(room: RoomState, player: PlayerState): boolean {
  return canManageIntermission(room, player) && room.shop!.phase === 'PUBLIC'
    && room.shop!.order[room.shop!.activeShopperIndex] === player.id;
}

export function canUsePrivateMarket(room: RoomState, player: PlayerState): boolean {
  return canManageIntermission(room, player) && Boolean(room.shop!.privateUnlockedBy[player.id]);
}

function unlockPrivateMarket(room: RoomState, playerId: string, now: number): void {
  const shop = room.shop!;
  if (shop.privateUnlockedBy[playerId]) return;
  shop.privateUnlockedBy[playerId] = true;
  event(room, now, 'BLACK_MARKET_UNLOCKED', `${playerById(room, playerId).name}'s private market is now open.`, playerId);
}

/** A public purchase has already marked publicPurchasedBy; every other resolution is Pass. */
export function resolvePublicDecision(room: RoomState, playerId: string, now: number, automatic = false): void {
  const shop = room.shop!;
  requireRule(shop?.phase === 'PUBLIC' && shop.order[shop.activeShopperIndex] === playerId, 'NOT_YOUR_TURN', 'Wait for your Public Shop decision.');
  if (!shop.publicPurchasedBy[playerId] && !shop.publicSkippedBy?.[playerId]) {
    (shop.publicSkippedBy ??= {})[playerId] = true;
    event(room, now, 'PUBLIC_SHOP_PASSED', `${playerById(room, playerId).name} ${automatic ? 'automatically passed' : 'passed'} the Public Shop.`, playerId);
  }
  unlockPrivateMarket(room, playerId, now);
  shop.activeShopperIndex += 1;
  delete shop.publicDeadlineAt;
  advanceIntermission(room, now);
}

export function finishIntermissionPlayer(room: RoomState, playerId: string, now: number, automatic = false): void {
  const shop = room.shop!;
  const player = playerById(room, playerId);
  if (!automatic) {
    requireRule(canUsePrivateMarket(room, player), 'NOT_ELIGIBLE', 'Resolve your Public Shop decision before finishing Intermission.');
    requireRule(!room.overflows?.some(choice => choice.playerId === playerId), 'LOCKED', 'Resolve your inventory overflow before finishing.');
  }
  if (shop.finishedBy[playerId]) return;
  if (automatic) {
    for (const choice of [...(room.overflows ?? [])]) if (choice.playerId === playerId) resolveOverflow(room, choice.id, now);
  }
  shop.finishedBy[playerId] = true;
  event(room, now, 'INTERMISSION_PLAYER_FINISHED', `${player.name} finished Intermission.`, playerId);
}

/**
 * Process authoritative Intermission boundaries without owning the normal-turn loop.
 * Returns true exactly when the caller may start the next round. Private choices
 * and one player's overflow never hold up the next Public decision.
 */
export function advanceIntermission(room: RoomState, now: number): boolean {
  if (room.status !== 'PLAYING' || room.round?.phase !== 'INTERMISSION' || !room.shop) return false;
  const shop = room.shop;
  for (const playerId of shop.order) {
    const player = playerById(room, playerId);
    if (player.life === 'ACTIVE' && player.connection === 'CONNECTED') continue;
    if (!shop.publicPurchasedBy[playerId] && !shop.publicSkippedBy?.[playerId]) {
      (shop.publicSkippedBy ??= {})[playerId] = true;
      event(room, now, 'PUBLIC_SHOP_PASSED', `${player.name} automatically passed the Public Shop.`, playerId);
    }
    finishIntermissionPlayer(room, playerId, now, true);
  }
  if (shop.order.every(playerId => shop.finishedBy[playerId])) return true;

  if (shop.phase === 'PREP') {
    if (now < shop.prepDeadlineAt) return false;
    shop.phase = 'PUBLIC';
  }
  if (shop.phase === 'PUBLIC') {
    while (shop.activeShopperIndex < shop.order.length) {
      const playerId = shop.order[shop.activeShopperIndex]!;
      if (shop.finishedBy[playerId] || shop.publicPurchasedBy[playerId] || shop.publicSkippedBy?.[playerId]) {
        if (!shop.finishedBy[playerId]) unlockPrivateMarket(room, playerId, now);
        shop.activeShopperIndex += 1;
        delete shop.publicDeadlineAt;
        continue;
      }
      if (shop.publicDeadlineAt === undefined) {
        shop.publicDeadlineAt = now + RULES.publicShopDecisionMs;
        event(room, now, 'PUBLIC_SHOP_TURN_STARTED', `${playerById(room, playerId).name}'s Public Shop decision begins.`, playerId);
      } else if (now >= shop.publicDeadlineAt) {
        (shop.publicSkippedBy ??= {})[playerId] = true;
        event(room, now, 'PUBLIC_SHOP_PASSED', `${playerById(room, playerId).name} automatically passed the Public Shop.`, playerId);
        unlockPrivateMarket(room, playerId, now);
        shop.activeShopperIndex += 1;
        delete shop.publicDeadlineAt;
        continue;
      }
      return false;
    }
    shop.phase = 'GRACE';
    shop.privateDeadlineAt = now + RULES.privateMarketGraceMs;
  }
  if (shop.phase === 'GRACE' && now >= shop.privateDeadlineAt!) {
    for (const playerId of shop.order) finishIntermissionPlayer(room, playerId, now, true);
    return true;
  }
  return shop.order.every(playerId => shop.finishedBy[playerId]);
}
