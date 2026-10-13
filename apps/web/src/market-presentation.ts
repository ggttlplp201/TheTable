import { ITEMS } from '@the-table/content';
import type { ItemStack, ShopOffer } from '@the-table/game';
import type { ItemModelId } from '@the-table/visual';
import type { RoomView } from './protocol';
import { hasCapability, ownItems, playerName } from './gameplay';

export type MarketView = 'PUBLIC' | 'BLACK' | 'SELL';
const definitions = Object.values(ITEMS);
export const marketModelId = (id: string): ItemModelId => id.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase()) as ItemModelId;
export function resaleValue(itemId: string, broker: boolean): number {
  const base = definitions.find(item => item.id === itemId)?.basePrice;
  if (base == null) return 0;
  const value = Math.max(1, Math.floor(base / 2));
  return broker ? Math.min(value + 1, base - 1) : value;
}
export function blackMarketUnlocked(room: RoomView): boolean {
  return room.public.round?.phase === 'INTERMISSION' && Boolean(room.public.shop?.privateUnlockedBy[room.private.playerId]);
}
export const BLACK_MARKET_LOCK_REASON = 'Your Black Market unlocks after you buy or pass on your Public Shop turn.';

export function marketPhaseState(room: RoomView, now = Date.now()) {
  const shop = room.public.shop, playerId = room.private.playerId;
  const player = room.public.players.find(player => player.id === playerId);
  const open = room.public.status === 'PLAYING' && room.public.round?.phase === 'INTERMISSION' && Boolean(shop);
  const finished = Boolean(room.private.intermission?.finished || shop?.finishedBy[playerId]);
  const ownOverflow = Boolean(room.private.overflows?.length || room.public.overflows?.some(choice => choice.playerId === playerId));
  const deadline = shop?.phase === 'PREP' ? shop.prepDeadlineAt : shop?.phase === 'PUBLIC' ? shop.publicDeadlineAt : shop?.privateDeadlineAt;
  const seconds = room.public.mode === 'tutorial' ? shop?.phase === 'GRACE' ? 15 : 10 : deadline === undefined ? undefined : Math.max(0, Math.ceil((deadline - now) / 1000));
  const expired = seconds === 0;
  const publicTurn = open && shop?.phase === 'PUBLIC' && shop.order[shop.activeShopperIndex] === playerId;
  const currentShopper = shop?.phase === 'PUBLIC' ? shop.order[shop.activeShopperIndex] : undefined;
  const unavailable = !open ? 'Intermission has ended.'
    : player?.life !== 'ACTIVE' ? 'Downed players cannot shop.'
    : player.connection !== 'CONNECTED' ? 'Reconnect to continue shopping.'
    : !shop?.order.includes(playerId) ? 'You are not eligible for this Intermission.'
    : finished ? 'You finished this Intermission.'
    : expired ? 'Time expired. Waiting for the next shopping state.'
    : ownOverflow ? 'Resolve your inventory overflow first.' : undefined;
  const title = !open ? 'INTERMISSION ENDED'
    : shop?.phase === 'PREP' ? 'PREPARE TO SHOP'
    : shop?.phase === 'GRACE' ? 'PRIVATE MARKET CLOSING'
    : publicTurn ? 'YOUR PUBLIC SHOP TURN'
    : `${playerName(room.public, currentShopper).toUpperCase()} IS SHOPPING`;
  const detail = !open ? 'Return to the table.'
    : finished ? 'You are finished. You can still chat while the others shop.'
    : shop?.phase === 'PREP' ? 'Everyone may sell old items, fill empty Pockets, and chat. Private markets are locked.'
    : shop?.phase === 'GRACE' ? 'Finish your private purchase and Pockets. Unfinished choices pass when time expires.'
    : publicTurn ? 'Buy 1 Public item or Pass. No choice → Pass.'
    : 'You may sell old items, manage empty Pockets, use your unlocked Black Market, and chat.';
  return { open, finished, ownOverflow, deadline, seconds, expired, publicTurn, currentShopper, unavailable, title, detail };
}

export function ledgerAvailable(room: RoomView): boolean {
  return ownItems(room).some(item => item.itemId === 'red-ledger') && room.private.abilities?.redLedgerRound !== room.public.round?.number;
}

export function resaleState(room: RoomView, item: ItemStack, now = Date.now()) {
  const player = room.public.players.find(player => player.id === room.private.playerId);
  const price = resaleValue(item.itemId, player?.roleId === 'broker') * item.quantity;
  const acquiredNow = Boolean(room.public.shop?.id && item.acquiredIntermissionId === room.public.shop.id);
  const reason = !price ? 'Artifacts and Passage Token cannot be sold.'
    : acquiredNow ? 'Acquired this Intermission. You may sell this item next Intermission.'
    : marketPhaseState(room, now).unavailable
    ?? (!hasCapability(room, 'SELL') ? 'Selling is currently unavailable.' : undefined);
  return { price, acquiredNow, reason, canSell: !reason };
}

export function finishIntermissionState(room: RoomView, now = Date.now()) {
  const state = marketPhaseState(room, now);
  const reason = state.unavailable ?? (!blackMarketUnlocked(room) ? 'Resolve your Public Shop choice before finishing.'
    : !hasCapability(room, 'FINISH_SHOPPING') ? 'Finishing is currently unavailable.' : undefined);
  return { canFinish: !reason, reason };
}

export function offerState(room: RoomView, market: 'PUBLIC' | 'BLACK', offer: ShopOffer, ledger = false, now = Date.now()) {
  const player = room.public.players.find(player => player.id === room.private.playerId);
  const offers = market === 'PUBLIC' ? room.public.shop?.publicOffers ?? [] : room.private.blackMarket ?? [];
  const purchased = market === 'PUBLIC' ? Boolean(room.public.shop?.publicPurchasedBy[room.private.playerId]) : Boolean(room.private.intermission?.privatePurchased);
  const price = Math.max(0, offer.price - (market === 'PUBLIC' && ledger && ledgerAvailable(room) ? 1 : 0));
  const skipped = market === 'PUBLIC' && room.public.shop?.publicSkippedBy?.[room.private.playerId];
  const locked = market === 'BLACK' && !blackMarketUnlocked(room);
  const phase = marketPhaseState(room, now);
  const reason = offer.purchasedBy ? 'This offer has already been bought.'
    : purchased ? 'You already purchased from this market this Intermission.'
    : skipped ? 'You passed the Public Shop this Intermission.'
    : locked ? BLACK_MARKET_LOCK_REASON
    : phase.unavailable ? phase.unavailable
    : market === 'PUBLIC' && !phase.publicTurn ? room.public.shop?.phase === 'PREP' ? 'Public purchasing begins after preparation.' : 'Wait for your Public Shop turn.'
    : !offers.some(current => current.id === offer.id) ? 'This offer is no longer available.'
    : !hasCapability(room, 'BUY') ? 'Purchasing is currently unavailable.'
    : (player?.coins ?? 0) < price ? `Costs ${price} Gold. You have ${player?.coins ?? 0}; you need ${price - (player?.coins ?? 0)} more.` : undefined;
  const label = offer.purchasedBy ? (offer.purchasedBy === player?.id ? '✓ BOUGHT' : 'SOLD OUT') : purchased ? 'PURCHASE USED' : skipped ? 'PUBLIC PASSED' : locked ? 'PUBLIC SHOP FIRST'
    : phase.finished ? 'INTERMISSION FINISHED' : phase.expired ? 'TIME EXPIRED' : !phase.open ? 'MARKET CLOSED'
    : market === 'PUBLIC' && !phase.publicTurn ? room.public.shop?.phase === 'PREP' ? 'PREPARING' : 'WAIT YOUR TURN'
    : phase.ownOverflow ? 'RESOLVE OVERFLOW' : !hasCapability(room, 'BUY') ? 'UNAVAILABLE' : (player?.coins ?? 0) < price ? 'GOLD SHORT' : `BUY · ${price} Gold`;
  return { price, label, reason, canBuy: !reason };
}
