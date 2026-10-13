import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';

// Presentation-only projections; no server rooms or user preview state are changed.
const browser = await chromium.launch({ headless: true });
const errors = [];
try {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 1280, height: 720 }]) {
    const page = await browser.newPage({ viewport });
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(process.env.E2E_WEB_URL ?? 'http://127.0.0.1:5178');
    await page.evaluate(async () => {
      const ReactModule = await import('/node_modules/.vite/deps/react.js');
      const React = ReactModule.default ?? ReactModule;
      const dom = await import('/node_modules/.vite/deps/react-dom_client.js');
      const { createRoot } = dom.default ?? dom;
      const { MarketFocus } = await import('/src/MarketFocus.tsx');
      const { ownerRoom } = await import('/src/test-fixtures.ts');
      const container = document.createElement('main');
      container.style.cssText = 'position:fixed;inset:0';
      document.getElementById('root').replaceWith(container);
      const root = createRoot(container);
      const room = ownerRoom();
      room.public.round.phase = 'INTERMISSION'; delete room.public.turn;
      room.public.players.push(...['Ledger', 'Velvet'].map((name, index) => ({ ...structuredClone(room.public.players[1]), id: `p${index + 3}`, seat: index + 2, name })));
      room.public.players[0].roleId = 'smuggler';
      room.public.players[0].visibleInventory = [
        { instanceId: 'old-knife', itemId: 'knife', quantity: 1 },
        { instanceId: 'new-poison', itemId: 'poison', quantity: 1, acquiredIntermissionId: 'v14-preview-shop' },
        { instanceId: 'idol', itemId: 'brass-idol', quantity: 1 },
        { instanceId: 'ledger', itemId: 'red-ledger', quantity: 1 }, null, null,
      ];
      room.public.shop = {
        id: 'v14-preview-shop', phase: 'PREP', prepDeadlineAt: Date.now() + 15_000,
        publicDeadlineAt: Date.now() + 15_000, privateDeadlineAt: Date.now() + 20_000,
        publicOffers: ['medicine', 'knife', 'bullet', 'key'].map((itemId, index) => ({ id: `public-${index}`, itemId, price: index + 2 })),
        order: ['p1', 'p2', 'p3', 'p4'], activeShopperIndex: 0, publicPurchasedBy: {}, publicSkippedBy: {}, privateUnlockedBy: {}, finishedBy: {},
      };
      room.private.blackMarket = ['black-key', 'safe', 'poison', 'lockpick'].map((itemId, index) => ({ id: `private-${index}`, itemId, price: index + 5 }));
      room.private.capabilities = ['BUY', 'SELL', 'POCKET', 'SKIP_PUBLIC_SHOP', 'FINISH_SHOPPING', 'REROLL_MARKET'];
      room.private.intermission = { privatePurchased: false, finished: false };
      room.private.abilities = { quickDrawUsed: false };
      window.marketRoom = room; window.marketCommands = []; window.marketView = 'PUBLIC';
      window.drawMarket = () => root.render(React.createElement(MarketFocus, {
        room: structuredClone(room), initialView: window.marketView, busy: false, onClose() {},
        async send(command) {
          window.marketCommands.push(command);
          if (command.type === 'SKIP_PUBLIC_SHOP') {
            room.public.shop.publicSkippedBy.p1 = true; room.public.shop.privateUnlockedBy.p1 = true;
            room.public.shop.activeShopperIndex = 1;
          }
          if (command.type === 'REROLL_MARKET') {
            room.private.abilities.brassIdolRound = room.public.round.number;
            const offer = room.private.blackMarket.find(offer => offer.id === command.offerId);
            offer.id = 'rerolled-offer'; offer.itemId = 'crowbar'; offer.price = 7;
          }
          if (command.type === 'FINISH_SHOPPING') { room.private.intermission.finished = true; room.public.shop.finishedBy.p1 = true; }
          window.drawMarket(); return true;
        },
      }));
      window.drawMarket();
    });
    await page.locator('.market-canvas canvas').waitFor();
    await page.getByText('PREPARE TO SHOP', { exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Buy Medicine', exact: true }).isDisabled(), true);
    assert.equal(await page.getByRole('button', { name: 'Finish Intermission', exact: true }).isDisabled(), true);
    await page.screenshot({ path: `/tmp/v14-market-prep-${viewport.width}.png` });

    await page.evaluate(() => { window.marketRoom.public.shop.phase = 'PUBLIC'; window.marketRoom.public.shop.publicDeadlineAt = Date.now() + 15_000; window.drawMarket(); });
    await page.getByRole('button', { name: 'Pass Public Shop', exact: true }).click();
    await page.getByRole('dialog', { name: 'Your private Black Market', exact: true }).waitFor();
    await page.getByText('BRUNO IS SHOPPING', { exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Buy Black Key', exact: true }).isDisabled(), false);
    await page.getByRole('button', { name: 'Reroll Black Key with Brass Idol', exact: true }).click();
    await page.getByText('BRASS IDOL — USED THIS INTERMISSION', { exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Reroll Crowbar with Brass Idol', exact: true }).isDisabled(), true);
    await page.screenshot({ path: `/tmp/v14-market-private-idol-${viewport.width}.png` });

    await page.getByRole('button', { name: 'Sell items', exact: true }).click();
    await page.getByRole('button', { name: /Poison SELL NEXT INTERMISSION/ }).click();
    await page.getByText('Acquired this Intermission. You may sell this item next Intermission.', { exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'SELL FOR 2¢', exact: true }).isDisabled(), true);
    await page.locator('.market-canvas canvas').waitFor();
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await page.screenshot({ path: `/tmp/v14-market-resale-${viewport.width}.png` });
    await page.getByRole('button', { name: /Knife 2¢ RESALE/ }).click();
    await page.getByRole('button', { name: 'SELL FOR 2¢', exact: true }).click();
    assert.equal(await page.evaluate(() => window.marketCommands.at(-1).type), 'SELL');

    await page.evaluate(() => {
      window.marketRoom.public.overflows = [{ id: 'own-overflow', playerId: 'p1', deadlineAt: Date.now() + 15_000 }]; window.drawMarket();
    });
    assert.equal(await page.getByRole('button', { name: 'Finish Intermission', exact: true }).isDisabled(), true);
    await page.screenshot({ path: `/tmp/v14-market-overflow-${viewport.width}.png` });
    await page.evaluate(() => {
      window.marketRoom.public.overflows[0].playerId = 'p2'; window.marketRoom.public.shop.phase = 'GRACE'; window.marketRoom.public.shop.privateDeadlineAt = Date.now() + 20_000; window.drawMarket();
    });
    await page.getByText('PRIVATE MARKET CLOSING', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Finish Intermission', exact: true }).click();
    assert.equal(await page.getByRole('button', { name: 'Intermission finished', exact: true }).isDisabled(), true);
    await page.screenshot({ path: `/tmp/v14-market-finished-${viewport.width}.png` });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.close();
  }
  assert.deepEqual(errors, []);
  console.log('V14 market smoke passed at 1440×900 and 1280×720: prep, Public pass, concurrent private market, clickable/spent Idol, per-item resale, own/other overflow, grace and Finish. Zero browser errors.');
} finally {
  await browser.close();
}
