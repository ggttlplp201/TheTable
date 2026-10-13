import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const output = new URL('../../../audit/screenshots/', import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1344, height: 756 }, reducedMotion: 'reduce' });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto(process.env.E2E_WEB_URL ?? 'http://localhost:5173');
  await page.evaluate(async () => {
    const React = (await import('/node_modules/.vite/deps/react.js')).default;
    const dom = await import('/node_modules/.vite/deps/react-dom_client.js');
    const { MarketFocus } = await import('/src/MarketFocus.tsx');
    const { MatchView } = await import('/src/MatchView.tsx');
    const { ownerRoom } = await import('/src/test-fixtures.ts');
    const mount = document.createElement('div'); document.getElementById('root').replaceWith(mount);
    const root = (dom.default ?? dom).createRoot(mount);
    const room = ownerRoom(); room.public.round.phase = 'INTERMISSION'; delete room.public.turn;
    room.public.players[0].roleId = 'smuggler'; room.public.players[0].coins = 5;
    room.public.players[0].visibleInventory = ['knife', 'cloth', 'bullet', 'brass-idol', 'red-ledger', 'passage-token'].map(itemId => ({ itemId, instanceId: `owned-${itemId}`, quantity: 1 }));
    room.public.shop = { id: 'market-fidelity-intermission', phase: 'PUBLIC', prepDeadlineAt: Date.now() - 1, publicDeadlineAt: Date.now() + 15000, privateUnlockedBy: {}, finishedBy: {}, publicOffers: [{ id: 'pistol', itemId: 'pistol', price: 7 }, { id: 'medicine', itemId: 'medicine', price: 4 }, { id: 'armor', itemId: 'armor', price: 5 }, { id: 'antidote', itemId: 'antidote', price: 3, purchasedBy: 'p2' }], order: ['p1', 'p2'], activeShopperIndex: 0, publicPurchasedBy: {}, publicSkippedBy: {} };
    room.private.intermission = { privatePurchased: false, finished: false };
    const blackOffers = [{ id: 'pickpocket', itemId: 'pickpocket', price: 5 }, { id: 'safe', itemId: 'safe', price: 5 }, { id: 'handcuffs', itemId: 'handcuffs', price: 6 }, { id: 'black-key', itemId: 'black-key', price: 8 }];
    window.marketCommands = [];
    window.captureMarket = view => {
      const resolved = view !== 'PUBLIC';
      room.public.shop.publicDeadlineAt = Date.now() + 15000;
      room.public.shop.publicSkippedBy = resolved ? { p1: true } : {};
      room.public.shop.privateUnlockedBy = resolved ? { p1: true } : {};
      room.public.shop.activeShopperIndex = resolved ? 1 : 0;
      room.private.capabilities = ['CHAT', 'BUY', 'SELL', 'POCKET', 'ASSIGN_SAFE', ...(resolved ? ['BUY_BLACK', 'REROLL_MARKET', 'FINISH_SHOPPING'] : ['BUY_PUBLIC', 'SKIP_PUBLIC_SHOP'])];
      if (resolved) room.private.blackMarket = blackOffers; else delete room.private.blackMarket;
      root.render(React.createElement(MarketFocus, { key: view, room, initialView: view, busy: false, onClose: () => window.marketClosed = true, send: async command => { window.marketCommands.push(command); return true; } }));
    };
    window.captureMarketOverflow = () => {
      const next = structuredClone(room);
      next.private.capabilities = ['OVERFLOW_CHOICE'];
      next.private.overflows = [{ id: 'market-overflow', playerId: 'p1', incoming: { itemId: 'armor', instanceId: 'new-armor', quantity: 1 }, deadlineAt: Date.now() + 15000 }];
      const client = { command: async command => { window.marketCommands.push(command); return { ok: true, data: { revision: 8 } }; } };
      root.render(React.createElement('main', { className: 'app-shell' }, React.createElement(MatchView, { key: 'market-overflow', room: next, client, connected: true, viewerId: 'p1', voice: { enabled: false, iceServers: [], relayConfigured: false }, onView: () => {} })));
    };
  });
  for (const [view, filename] of [['PUBLIC', 'shop-desktop'], ['BLACK', 'black-market-desktop'], ['SELL', 'sell-back-desktop']]) {
    await page.evaluate(view => window.captureMarket(view), view);
    await page.locator('.market-canvas canvas').waitFor(); await page.waitForTimeout(800);
    assert.equal(await page.locator('.market-render-error').count(), 0);
    await page.mouse.move(2, 2);
    await page.screenshot({ path: fileURLToPath(new URL(`${filename}.png`, output)) });
    if (view === 'PUBLIC') {
      assert.equal(await page.getByRole('button', { name: 'Buy Pistol', exact: true }).isDisabled(), true);
      assert.equal(await page.getByRole('button', { name: 'Buy Antidote', exact: true }).isDisabled(), true);
      assert.equal(await page.getByRole('button', { name: 'Buy Black Key', exact: true }).count(), 0);
      await page.getByLabel('RED LEDGER', { exact: false }).check();
      await page.getByRole('button', { name: 'Buy Medicine', exact: true }).click();
      assert.deepEqual(await page.evaluate(() => window.marketCommands.at(-1)), { type: 'BUY', market: 'PUBLIC', offerId: 'medicine', useRedLedger: true });
    }
    if (view === 'BLACK') {
      await page.getByRole('button', { name: 'Buy Safe', exact: true }).click();
      assert.deepEqual(await page.evaluate(() => window.marketCommands.at(-1)), { type: 'BUY', market: 'BLACK', offerId: 'safe' });
      const reroll = page.getByRole('button', { name: 'Reroll Black Key with Brass Idol', exact: true });
      await page.locator('.market-stock-tag').filter({ has: reroll }).hover();
      await reroll.click();
      assert.deepEqual(await page.evaluate(() => window.marketCommands.at(-1)), { type: 'REROLL_MARKET', offerId: 'black-key' });
    }
    if (view === 'SELL') {
      await page.getByRole('button', { name: 'SELL FOR 2¢', exact: true }).click();
      assert.deepEqual(await page.evaluate(() => window.marketCommands.at(-1)), { type: 'SELL', instanceId: 'owned-knife' });
      await page.locator('.market-footer').hover();
      await page.getByRole('button', { name: 'Finish Intermission', exact: true }).click();
      assert.deepEqual(await page.evaluate(() => window.marketCommands.at(-1)), { type: 'FINISH_SHOPPING' });
    }
  }
  // Match the reference board's native content dimensions for direct visual review.
  await page.setViewportSize({ width: 880, height: 495 });
  for (const [view, filename] of [['PUBLIC', 'shop'], ['BLACK', 'black-market'], ['SELL', 'sell-back']]) {
    await page.evaluate(view => window.captureMarket(view), view);
    await page.locator('.market-canvas canvas').waitFor(); await page.waitForTimeout(500);
    await page.mouse.move(2, 2);
    await page.screenshot({ path: fileURLToPath(new URL(`${filename}-reference-scale.png`, output)) });
  }
  await page.setViewportSize({ width: 1344, height: 756 });
  await page.evaluate(() => window.captureMarketOverflow());
  await page.locator('.market-canvas canvas').waitFor();
  await page.getByRole('button', { name: 'Discard incoming Armor', exact: true }).click();
  assert.equal(await page.evaluate(() => window.marketCommands.at(-1).type), 'OVERFLOW_CHOICE');
  assert.deepEqual(errors, []);
  console.log('Three live production economy views captured. Buy, private offer isolation, Red Ledger, reroll, sell, and finish-shopping commands verified.');
} finally { await browser.close(); }
