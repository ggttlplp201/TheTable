import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';

// Run against Vite: UI component coverage only. Multiplayer end-to-end lives in qa/e2e.
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(process.env.E2E_WEB_URL ?? 'http://127.0.0.1:5173');
  await page.evaluate(async () => {
    const reactModule = await import('/node_modules/.vite/deps/react.js');
    const React = reactModule.default ?? reactModule;
    const domModule = await import('/node_modules/.vite/deps/react-dom_client.js');
    const { createRoot } = domModule.default ?? domModule;
    const { MatchView } = await import('/src/MatchView.tsx');
    const { ownerRoom, spectatorRoom } = await import('/src/test-fixtures.ts');
    const mount = document.createElement('div');
    document.getElementById('root').replaceWith(mount);
    const root = createRoot(mount);
    window.sentCommands = [];
    const client = {
      command: async payload => { window.sentCommands.push(payload); return { ok: true, data: { revision: 8 } }; },
      sendChat: async payload => { window.sentCommands.push(payload); return { ok: true, data: { revision: 8 } }; },
      onVoicePeers: () => () => {},
      onVoiceSignal: () => () => {},
      joinVoice: async () => ({ ok: true, data: { playerIds: [] } }),
      leaveVoice: async () => ({ ok: true, data: { left: true } }),
      signalVoice: async () => ({ ok: true, data: { delivered: true } }),
    };
    window.preview = mode => {
      const room = mode === 'spectator' ? spectatorRoom() : ownerRoom();
      if (mode === 'shop') {
        room.public.round.phase = 'INTERMISSION';
        delete room.public.turn;
        room.private.capabilities = ['BUY', 'BUY_BLACK', 'SELL', 'POCKET', 'ASSIGN_SAFE', 'FINISH_SHOPPING', 'CHAT'];
        room.public.shop = { id: 'browser-smoke-intermission', phase: 'PUBLIC', prepDeadlineAt: Date.now() - 1, publicDeadlineAt: Date.now() + 15000, privateUnlockedBy: { p1: true }, finishedBy: {}, publicOffers: [{ id: 'public-knife', itemId: 'knife', price: 4 }], order: ['p1', 'p2'], activeShopperIndex: 1, publicPurchasedBy: {}, publicSkippedBy: { p1: true } };
        room.private.intermission = { privatePurchased: false, finished: false };
        room.private.blackMarket = [{ id: 'private-safe', itemId: 'safe', price: 5 }];
      }
      if (mode === 'response') {
        room.private.capabilities = ['CHAT', 'RESPOND_TRADE'];
        room.public.pendingTrade = { id: 'trade', actorId: 'p2', targetId: 'p1', offeredItems: [], offeredCoins: 1, requestedItems: [], requestedCoins: 0, status: 'PENDING', deadlineAt: Date.now() + 30000 };
      }
      if (mode === 'overflow') {
        room.private.capabilities = ['OVERFLOW_CHOICE'];
        room.private.overflows = [{ id: 'overflow', playerId: 'p1', incoming: { instanceId: 'incoming', itemId: 'bag', quantity: 1 }, deadlineAt: Date.now() + 15000 }];
      }
      if (mode === 'downed') {
        room.public.players[1].life = 'DOWNED';
        room.private.capabilities = ['DOWNED_INTERACTION', 'END_TURN'];
      }
      if (mode === 'exit') {
        room.private.capabilities = ['LEAVE_TABLE', 'STAY', 'END_TURN'];
        room.private.objective.status = 'EXIT_READY';
        room.public.players[0].objectiveCompleted = true;
      }
      if (mode === 'results') {
        room.public.status = 'RESULTS';
        room.public.turn = undefined;
        room.public.players[0].score = 100;
        room.public.players[0].exitOrder = 1;
      }
      root.render(React.createElement('main', { className: 'app-shell' }, React.createElement(MatchView, { key: mode, room, client, connected: true, viewerId: 'p1', voice: { enabled: false, iceServers: [], relayConfigured: false }, onView: () => {} })));
    };
    window.preview('turn');
  });
  const layout = () => page.evaluate(() => ({
    viewport: innerWidth, document: document.documentElement.scrollWidth, scrolls: document.documentElement.scrollHeight > innerHeight,
    undersized: [...document.querySelectorAll('.match-layout button, .match-layout select')].filter(el => el.getBoundingClientRect().height < 44).map(el => el.textContent.trim()),
    undersizedPrimary: [...document.querySelectorAll('.action-dock button, .match-overlay .button, .forced-decision .button')].filter(el => el.getBoundingClientRect().height < 56).map(el => el.textContent.trim()),
  }));
  await page.getByRole('heading', { name: 'Your turn.' }).waitFor();
  await page.getByRole('button', { name: 'Use item', exact: true }).click();
  await page.screenshot({ path: '/tmp/table-ui-use-phone.png', fullPage: true });
  await page.getByRole('button', { name: 'Use Pistol', exact: true }).click();
  let geometry = await layout();
  assert.equal(geometry.document, 390);
  assert.equal(geometry.scrolls, false);
  assert.deepEqual(geometry.undersized, []);
  assert.deepEqual(geometry.undersizedPrimary, []);
  const first = (await page.evaluate(() => window.sentCommands))[0];
  assert.equal(first.type, 'USE_ITEM');
  assert.deepEqual(first.payload, { instanceId: 'p1-pistol', targetId: 'p2' });
  assert.equal(first.expectedRevision, 7);
  assert.equal(first.roomId, 'room-id');
  assert.ok(first.idempotencyKey);
  await page.screenshot({ path: '/tmp/table-ui-phone.png', fullPage: true });
  await page.getByRole('button', { name: 'Trade', exact: true }).click();
  await page.screenshot({ path: '/tmp/table-ui-trade-phone.png', fullPage: true });
  await page.getByRole('button', { name: 'Propose Trade', exact: true }).click();
  await page.getByRole('button', { name: 'Threat', exact: true }).click();
  await page.getByRole('button', { name: /Under cloth/ }).click();
  await page.screenshot({ path: '/tmp/table-ui-threat-phone.png', fullPage: true });
  await page.getByRole('button', { name: 'Make Threat', exact: true }).click();
  let sent = await page.evaluate(() => window.sentCommands);
  assert.deepEqual(sent[1].payload, { targetId: 'p2', offeredItems: [], offeredCoins: 0, requestedItems: [], requestedCoins: 0 });
  assert.equal(sent[2].payload.mode, 'COVERED');
  assert.equal(sent[2].payload.committedItemId, 'p1-pistol');
  assert.equal(sent[2].payload.clothItemId, 'p1-cloth');
  await page.evaluate(() => window.preview('shop'));
  await page.getByRole('navigation', { name: 'Market navigation' }).getByRole('button', { name: 'Black Market', exact: true }).click();
  await page.screenshot({ path: '/tmp/table-ui-markets-phone.png', fullPage: true });
  await page.getByRole('button', { name: 'Buy Safe', exact: true }).click();
  sent = await page.evaluate(() => window.sentCommands);
  assert.deepEqual(sent[3].payload, { market: 'BLACK', offerId: 'private-safe' });
  geometry = await layout();
  assert.equal(geometry.document, 390);
  assert.equal(geometry.scrolls, false);
  assert.deepEqual(geometry.undersized, []);
  assert.deepEqual(geometry.undersizedPrimary, []);
  await page.screenshot({ path: '/tmp/table-ui-shop-phone.png', fullPage: true });
  await page.evaluate(() => window.preview('response'));
  await page.getByRole('button', { name: 'Accept Trade', exact: true }).waitFor();
  await page.screenshot({ path: '/tmp/table-ui-trade-response-phone.png', fullPage: true });
  assert.equal(await page.evaluate(() => document.activeElement?.textContent), 'Trade on the table');
  assert.equal((await layout()).document, 390);
  await page.evaluate(() => window.preview('overflow'));
  await page.getByRole('button', { name: 'Discard incoming Bag', exact: true }).waitFor();
  await page.screenshot({ path: '/tmp/table-ui-overflow-phone.png', fullPage: true });
  assert.equal(await page.evaluate(() => document.activeElement?.textContent), 'Make room for Bag');
  assert.equal((await layout()).document, 390);
  await page.evaluate(() => window.preview('spectator'));
  await page.getByRole('heading', { name: 'Behind every hand' }).waitFor();
  assert.equal(await page.locator('.action-dock, .match-layout form').count(), 0);
  await page.screenshot({ path: '/tmp/table-ui-spectator-phone.png', fullPage: true });
  await page.evaluate(() => window.preview('downed'));
  await page.getByRole('button', { name: 'Help / loot', exact: true }).click();
  await page.screenshot({ path: '/tmp/table-ui-downed-phone.png', fullPage: true });
  await page.evaluate(() => window.preview('exit'));
  await page.getByRole('button', { name: 'Exit ready', exact: true }).click();
  await page.screenshot({ path: '/tmp/table-ui-exit-phone.png', fullPage: true });
  await page.evaluate(() => window.preview('results'));
  await page.getByRole('heading', { name: 'Results', exact: true }).waitFor();
  await page.screenshot({ path: '/tmp/table-ui-results-phone.png', fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.evaluate(() => window.preview('turn'));
  await page.getByRole('heading', { name: 'Your turn.' }).waitFor();
  assert.equal((await layout()).document, 1440);
  await page.screenshot({ path: '/tmp/table-ui-desktop.png', fullPage: true });
  await page.getByRole('button', { name: 'Contract', exact: true }).click();
  await page.screenshot({ path: '/tmp/table-ui-contract-desktop.png', fullPage: true });
  await page.getByRole('button', { name: 'Close Private contract', exact: true }).click();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.screenshot({ path: '/tmp/table-ui-settings-desktop.png', fullPage: true });
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  await page.screenshot({ path: '/tmp/table-ui-desktop-dark.png', fullPage: true });
  assert.deepEqual(errors, []);
  console.log('PASS: phone/desktop overflow, 56px controls, item/Trade/Threat/Black Market payloads, spectator controls, browser errors.');
} finally {
  await browser.close();
}
