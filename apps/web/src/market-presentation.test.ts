import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { MarketFocus } from './MarketFocus';
import { blackMarketUnlocked, finishIntermissionState, marketModelId, marketPhaseState, offerState, resaleState, resaleValue } from './market-presentation';
import { ownerRoom } from './test-fixtures';

function shoppingRoom(phase: 'PREP' | 'PUBLIC' | 'GRACE' = 'PUBLIC') {
  const room = ownerRoom();
  room.public.round!.phase = 'INTERMISSION'; delete room.public.turn;
  room.public.shop = { id: 'shop-2', phase, prepDeadlineAt: Date.now() + 15_000, publicDeadlineAt: Date.now() + 15_000, privateDeadlineAt: Date.now() + 20_000,
    publicOffers: [{ id: 'offer', itemId: 'pistol', price: 9 }], order: ['p1', 'p2'], activeShopperIndex: 0,
    publicPurchasedBy: {}, publicSkippedBy: {}, privateUnlockedBy: {}, finishedBy: {} };
  room.private.capabilities = ['BUY', 'SELL', 'POCKET', 'SKIP_PUBLIC_SHOP', 'FINISH_SHOPPING', 'REROLL_MARKET'];
  room.private.intermission = { privatePurchased: false, finished: false };
  room.private.abilities = { quickDrawUsed: false };
  return room;
}
function markup(room: ReturnType<typeof shoppingRoom>, initialView: 'PUBLIC' | 'BLACK' | 'SELL' = 'PUBLIC') {
  return renderToStaticMarkup(createElement(MarketFocus, { room, send: async () => true, busy: false, onClose: () => {}, initialView }));
}

describe('authoritative market presentation', () => {
  it('uses canonical resale with the Broker cap and excludes Artifacts and quest items', () => {
    expect(resaleValue('knife', false)).toBe(2);
    expect(resaleValue('knife', true)).toBe(3);
    expect(resaleValue('bullet', true)).toBe(1);
    expect(resaleValue('passage-token', true)).toBe(0);
    expect(resaleValue('brass-idol', false)).toBe(0);
    expect(marketModelId('black-key')).toBe('blackKey');
  });
  it('gates Buy on capabilities, authoritative purchase state, and funds', () => {
    const room = shoppingRoom(), offer = room.public.shop!.publicOffers[0]!;
    room.private.capabilities = [];
    expect(offerState(room, 'PUBLIC', offer).label).toBe('UNAVAILABLE');
    room.private.capabilities = ['BUY'];
    expect(offerState(room, 'PUBLIC', offer)).toMatchObject({ canBuy: false, label: 'GOLD SHORT', price: 9 });
    room.public.players[0]!.visibleInventory[2] = { instanceId: 'ledger', itemId: 'red-ledger', quantity: 1 };
    expect(offerState(room, 'PUBLIC', offer, true)).toMatchObject({ canBuy: true, price: 8 });
    expect(offerState(room, 'BLACK', offer, true)).toMatchObject({ canBuy: false, price: 9 });
    room.public.shop!.publicPurchasedBy = { p1: true };
    expect(offerState(room, 'PUBLIC', offer, true).canBuy).toBe(false);
    room.public.shop!.publicPurchasedBy = {};
    room.public.shop!.publicSkippedBy = { p1: true };
    expect(offerState(room, 'PUBLIC', offer).reason).toContain('passed the Public Shop');
    expect(offerState(room, 'PUBLIC', { ...offer, purchasedBy: 'p2' }).label).toBe('SOLD OUT');
  });
  it('keeps Black offers out of the public shelf DOM, and preserves the fourth authorized offer', () => {
    const room = shoppingRoom();
    room.private.blackMarket = [{ id: 'private', itemId: 'black-key', price: 8 }, { id: 'b2', itemId: 'safe', price: 5 }, { id: 'b3', itemId: 'poison', price: 5 }, { id: 'b4', itemId: 'lockpick', price: 6 }];
    const props = { room, send: async () => true, busy: false, onClose: () => {} };
    const publicMarkup = renderToStaticMarkup(createElement(MarketFocus, props));
    expect(publicMarkup).not.toContain('Buy Black Key');
    const lockedMarkup = renderToStaticMarkup(createElement(MarketFocus, { ...props, initialView: 'BLACK' }));
    expect(lockedMarkup).not.toContain('Buy Black Key');
    expect(lockedMarkup).toContain('Your Black Market unlocks after you buy or pass');
    room.public.shop!.privateUnlockedBy.p1 = true;
    room.public.shop!.publicSkippedBy = { p1: true };
    const blackMarkup = renderToStaticMarkup(createElement(MarketFocus, { ...props, initialView: 'BLACK' }));
    expect(blackMarkup).toContain('Buy Black Key');
    expect(blackMarkup).toContain('Buy Lockpick');
    expect(blackMarkup).toContain('SMUGGLER');
  });
  it('quotes resale for the complete selected ammunition stack', () => {
    const room = shoppingRoom();
    room.public.players[0]!.visibleInventory = [{ itemId: 'bullet', instanceId: 'three-bullets', quantity: 3 }];
    room.private.capabilities = ['SELL'];
    const markup = renderToStaticMarkup(createElement(MarketFocus, { room, send: async () => true, busy: false, onClose: () => {}, initialView: 'SELL' }));
    expect(markup).toContain('SELL FOR <span class="coin-amount" aria-label="3 Gold"');
    expect(markup).toContain('3</span> RESALE');
  });

  it('shows preparation, exact phase deadlines, and persistent Public order', () => {
    const room = shoppingRoom('PREP');
    const deadline = room.public.shop!.prepDeadlineAt;
    expect(marketPhaseState(room, deadline - 12_000)).toMatchObject({ title: 'PREPARE TO SHOP', seconds: 12, publicTurn: false });
    expect(offerState(room, 'PUBLIC', room.public.shop!.publicOffers[0]!).label).toBe('PREPARING');
    const html = markup(room);
    expect(html).toContain('Public order:'); expect(html).toContain('Ada'); expect(html).toContain('Bruno');
    expect(html).toContain('Everyone may sell old items');
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*aria-label="Buy Pistol"/);
    expect(finishIntermissionState(room).canFinish).toBe(false);
  });

  it('unlocks private shopping during another Public turn using the authoritative unlock flag', () => {
    const room = shoppingRoom();
    const offer = { id: 'private', itemId: 'knife', price: 5 };
    room.private.blackMarket = [offer]; room.public.shop!.activeShopperIndex = 1;
    room.public.shop!.publicSkippedBy = { p1: true };
    expect(blackMarketUnlocked(room)).toBe(false);
    room.public.shop!.privateUnlockedBy.p1 = true;
    expect(offerState(room, 'BLACK', offer).canBuy).toBe(true);
    expect(finishIntermissionState(room).canFinish).toBe(true);
    expect(markup(room, 'BLACK')).toContain('BRUNO IS SHOPPING');
    expect(markup(room, 'BLACK')).toContain('PUBLIC SHOP RESOLVED · PRIVATE MARKET UNLOCKED');
    room.private.intermission!.privatePurchased = true;
    expect(offerState(room, 'BLACK', offer).label).toBe('PURCHASE USED');
  });

  it('uses the private grace deadline, disables expired controls, and retains inspection', () => {
    const room = shoppingRoom('GRACE');
    room.public.shop!.privateUnlockedBy.p1 = true;
    const offer = { id: 'private', itemId: 'knife', price: 5 }; room.private.blackMarket = [offer];
    const deadline = room.public.shop!.privateDeadlineAt!;
    expect(marketPhaseState(room, deadline - 18_000)).toMatchObject({ title: 'PRIVATE MARKET CLOSING', seconds: 18 });
    expect(offerState(room, 'BLACK', offer, false, deadline)).toMatchObject({ canBuy: false, label: 'TIME EXPIRED' });
    expect(finishIntermissionState(room, deadline).canFinish).toBe(false);
    room.public.shop!.privateDeadlineAt = Date.now() - 1;
    const html = markup(room, 'BLACK');
    expect(html).toContain('PRIVATE MARKET CLOSING'); expect(html).toContain('TIME EXPIRED');
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*aria-label="Buy Knife"/);
    expect(html).toContain('Step back');
  });

  it('allows all-player selling during prep and after buying, with per-item acquisition embargo', () => {
    const room = shoppingRoom('PREP');
    room.public.shop!.activeShopperIndex = 1;
    const oldItem = room.public.players[0]!.visibleInventory[0]!;
    expect(resaleState(room, oldItem).canSell).toBe(true);
    room.public.shop!.phase = 'PUBLIC'; room.public.shop!.publicPurchasedBy.p1 = true;
    expect(resaleState(room, oldItem).canSell).toBe(true);
    const newItem = { ...oldItem, instanceId: 'new-pistol', acquiredIntermissionId: room.public.shop!.id };
    expect(resaleState(room, newItem)).toMatchObject({ canSell: false, acquiredNow: true });
    room.public.players[0]!.visibleInventory = [newItem];
    const html = markup(room, 'SELL');
    expect(html).toContain('SELL NEXT INTERMISSION'); expect(html).toContain('Acquired this Intermission.');
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>SELL FOR/);
    room.public.shop!.id = 'shop-3';
    expect(resaleState(room, newItem).canSell).toBe(true);
  });

  it('blocks only the owner overflow and disallows Finish before Public resolution', () => {
    const room = shoppingRoom();
    expect(finishIntermissionState(room).reason).toContain('Resolve your Public Shop choice');
    room.public.shop!.privateUnlockedBy.p1 = true;
    room.public.overflows = [{ id: 'overflow', playerId: 'p2', deadlineAt: Date.now() + 15_000 }];
    expect(finishIntermissionState(room).canFinish).toBe(true);
    expect(resaleState(room, room.public.players[0]!.visibleInventory[0]!).canSell).toBe(true);
    room.public.overflows[0]!.playerId = 'p1';
    expect(finishIntermissionState(room).reason).toContain('your inventory overflow');
    expect(markup(room)).toMatch(/<button[^>]*class="market-finish"[^>]*disabled=""/);
  });

  it('retains real reroll buttons after Brass Idol is spent and exposes its usage state', () => {
    const room = shoppingRoom(); room.public.shop!.privateUnlockedBy.p1 = true;
    room.private.blackMarket = [{ id: 'private', itemId: 'knife', price: 5 }];
    room.public.players[0]!.visibleInventory[2] = { instanceId: 'idol', itemId: 'brass-idol', quantity: 1 };
    expect(markup(room, 'BLACK')).toContain('Reroll Knife with Brass Idol');
    expect(markup(room, 'BLACK')).not.toMatch(/class="market-reroll"[^>]*disabled/);
    room.private.abilities!.brassIdolRound = room.public.round!.number;
    const html = markup(room, 'BLACK');
    expect(html).toContain('BRASS IDOL — USED THIS INTERMISSION');
    expect(html).toMatch(/class="market-reroll"[^>]*disabled=""/);
  });

  it('uses Red Ledger only when owned and unspent and keeps spent state visible', () => {
    const room = shoppingRoom(), offer = room.public.shop!.publicOffers[0]!;
    expect(offerState(room, 'PUBLIC', offer, true).price).toBe(9);
    room.public.players[0]!.visibleInventory[2] = { instanceId: 'ledger', itemId: 'red-ledger', quantity: 1 };
    expect(offerState(room, 'PUBLIC', offer, true).price).toBe(8);
    room.private.abilities!.redLedgerRound = room.public.round!.number;
    expect(offerState(room, 'PUBLIC', offer, true).price).toBe(9);
    expect(markup(room)).toContain('RED LEDGER — USED THIS INTERMISSION');
    expect(markup(room)).toMatch(/<input[^>]*disabled=""/);
  });

  it('closes every purchase, reroll, sale and Finish after the owner finishes or phase changes', () => {
    const room = shoppingRoom(); room.public.shop!.privateUnlockedBy.p1 = true;
    const item = room.public.players[0]!.visibleInventory[0]!;
    const offer = { id: 'private', itemId: 'knife', price: 5 }; room.private.blackMarket = [offer];
    room.private.intermission!.finished = true;
    expect(offerState(room, 'BLACK', offer).canBuy).toBe(false);
    expect(resaleState(room, item).canSell).toBe(false); expect(finishIntermissionState(room).canFinish).toBe(false);
    expect(markup(room)).toContain('Intermission finished');
    room.private.intermission!.finished = false;
    room.public.round!.phase = 'TURN';
    expect(offerState(room, 'PUBLIC', room.public.shop!.publicOffers[0]!).label).toBe('MARKET CLOSED');
    expect(resaleState(room, item).canSell).toBe(false); expect(blackMarketUnlocked(room)).toBe(false);
  });
});
