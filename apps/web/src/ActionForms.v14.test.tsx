import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { InventoryForm, Markets, pocketDestinationMode, ThreatForm, TurnActions, UseItemForm } from './ActionForms';
import { ownerRoom } from './test-fixtures';

describe('v14 action forms', () => {
  it('maps one empty Pocket to immediate placement and multiple Pockets to explicit choice', () => {
    expect(pocketDestinationMode([])).toEqual({ kind: 'UNAVAILABLE' });
    expect(pocketDestinationMode([1])).toEqual({ kind: 'IMMEDIATE', pocketIndex: 1 });
    expect(pocketDestinationMode([0, 1])).toEqual({ kind: 'CHOOSE' });

    const room = ownerRoom();
    room.private.pockets = [
      { item: null, protectedBySafe: false, source: 'DEFAULT' },
      { item: null, protectedBySafe: false, source: 'BAG' },
    ];
    room.public.players[0]!.pocketOccupancy = [false, false];
    room.private.capabilities = ['POCKET'];
    const html = renderToStaticMarkup(<InventoryForm room={room} send={vi.fn(async () => true)} busy={false} />);
    expect(html).toContain('PLACE IN POCKET');
    expect(html).toContain('POCKET 2 · BAG');
  });

  it('disables stale Primary Action submission while retaining the draft surface', () => {
    const room = ownerRoom();
    room.private.capabilities = ['CHAT'];
    const use = renderToStaticMarkup(<UseItemForm room={room} send={vi.fn(async () => true)} busy={false} />);
    expect(use).toContain('Turn ended. Draft saved.');
    expect(use).toContain('TURN ENDED');
    expect(use).toContain('aria-label="Pistol"');

    const threat = renderToStaticMarkup(<ThreatForm room={room} send={vi.fn(async () => true)} busy={false} />);
    expect(threat).toContain('Turn ended. Draft saved.');
    expect(threat).toContain('aria-label="Make Threat" disabled=""');
  });

  it('renders authoritative spent states for Quick Draw and Glass Eye', () => {
    const room = ownerRoom();
    room.private.abilities = { quickDrawUsed: true, glassEyeRound: room.public.round!.number };
    room.public.players[0]!.visibleInventory[2] = { instanceId: 'eye', itemId: 'glass-eye', quantity: 1 };
    const html = renderToStaticMarkup(<UseItemForm room={room} send={vi.fn(async () => true)} busy={false} preferredItemId="p1-pistol" />);
    expect(html).toContain('QUICK DRAW — USED');
    expect(html).toContain('GLASS EYE — USED THIS ROUND');
    expect(html).not.toContain('value="eye"');
  });

  it('disables Stimulant when the selected target is already at the temporary-HP cap', () => {
    const room = ownerRoom();
    room.public.players[0]!.visibleInventory[2] = { instanceId: 'stim', itemId: 'stimulant', quantity: 1 };
    room.public.players[0]!.temporaryHp = 2;
    const html = renderToStaticMarkup(<UseItemForm room={room} send={vi.fn(async () => true)} busy={false} preferredItemId="stim" />);
    expect(html).toContain('Stimulant would provide no HP or Temporary HP');
    expect(html).toContain('disabled=""');
  });

  it('keeps old items sellable and explains the same-Intermission resale embargo', () => {
    const room = ownerRoom();
    room.public.round = { number: 2, phase: 'INTERMISSION', seatsOwedTurn: [] };
    room.public.shop = {
      id: 'shop-2', phase: 'PUBLIC', prepDeadlineAt: Date.now() - 1, publicDeadlineAt: Date.now() + 15_000,
      privateUnlockedBy: { p1: true }, finishedBy: {}, publicOffers: [], order: ['p1', 'p2'], activeShopperIndex: 0,
      publicPurchasedBy: { p1: true }, publicSkippedBy: {},
    };
    room.private.capabilities = ['SELL', 'POCKET', 'ASSIGN_SAFE', 'BUY_BLACK', 'FINISH_SHOPPING'];
    room.private.intermission = { privatePurchased: false, finished: false };
    room.public.players[0]!.visibleInventory[0] = { instanceId: 'old-knife', itemId: 'knife', quantity: 1 };
    room.public.players[0]!.visibleInventory[1] = { instanceId: 'new-cloth', itemId: 'cloth', quantity: 1, acquiredIntermissionId: 'shop-2' };
    const html = renderToStaticMarkup(<Markets room={room} send={vi.fn(async () => true)} busy={false} />);
    expect(html).toContain('value="old-knife"');
    expect(html).not.toContain('value="new-cloth"');
    expect(html).toContain('Acquired this Intermission. You may sell this item next Intermission.');
  });

  it('shows spent market artifacts and failed-contract Concede availability', () => {
    const room = ownerRoom();
    room.public.round = { number: 2, phase: 'INTERMISSION', seatsOwedTurn: [] };
    room.public.shop = {
      id: 'shop-2', phase: 'GRACE', prepDeadlineAt: Date.now() - 20_000, privateDeadlineAt: Date.now() + 20_000,
      privateUnlockedBy: { p1: true }, finishedBy: {}, publicOffers: [], order: ['p1', 'p2'], activeShopperIndex: 2,
      publicPurchasedBy: { p1: true }, publicSkippedBy: {},
    };
    room.private.blackMarket = [{ id: 'offer', itemId: 'medicine', price: 5 }];
    room.private.capabilities = ['SELL', 'POCKET', 'ASSIGN_SAFE', 'BUY_BLACK', 'FINISH_SHOPPING'];
    room.private.intermission = { privatePurchased: false, finished: false };
    room.private.abilities = { quickDrawUsed: false, brassIdolRound: 2, redLedgerRound: 2 };
    room.public.players[0]!.visibleInventory[2] = { instanceId: 'idol', itemId: 'brass-idol', quantity: 1 };
    room.public.players[0]!.visibleInventory[3] = { instanceId: 'ledger', itemId: 'red-ledger', quantity: 1 };
    const markets = renderToStaticMarkup(<Markets room={room} send={vi.fn(async () => true)} busy={false} />);
    expect(markets).toContain('BRASS IDOL — USED THIS INTERMISSION');
    expect(markets).toContain('RED LEDGER — USED THIS INTERMISSION');

    room.public.round = { number: 3, phase: 'TURN', seatsOwedTurn: [1] };
    room.private.objective!.status = 'FAILED';
    room.private.objective!.failureReason = 'No path remains.';
    room.private.capabilities = ['CONCEDE', 'END_TURN'];
    const actions = renderToStaticMarkup(<TurnActions room={room} send={vi.fn(async () => true)} busy={false} />);
    expect(actions).toContain('Concede for 0 points');
    expect(actions).not.toContain('Concede available on your normal turn');
  });
});
