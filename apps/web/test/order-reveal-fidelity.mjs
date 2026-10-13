import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto(process.env.E2E_WEB_URL ?? 'http://localhost:5173');
  await page.evaluate(async () => {
    const React = (await import('/node_modules/.vite/deps/react.js')).default;
    const dom = await import('/node_modules/.vite/deps/react-dom_client.js');
    const { MatchView } = await import('/src/MatchView.tsx');
    const { ownerRoom } = await import('/src/test-fixtures.ts');
    const mount = document.createElement('main'); mount.className = 'app-shell'; document.getElementById('root').replaceWith(mount);
    const root = (dom.default ?? dom).createRoot(mount);
    const originalNow = Date.now, epoch = originalNow();
    let offset = 0; Date.now = () => epoch + offset;
    const client = { command: async () => ({ ok: true, data: { revision: 8 } }), onVoicePeers: () => () => {}, onVoiceSignal: () => () => {}, leaveVoice: async () => ({ ok: true, data: {} }) };
    window.showOrder = (elapsed, viewerId = 'p1') => {
      offset = elapsed;
      const room = ownerRoom(); room.public.id = 'order-cinematic'; room.public.events = [];
      room.public.round.phase = 'INTERMISSION'; delete room.public.turn;
      room.public.shop = { id: 'order-intermission', phase: 'PREP', prepDeadlineAt: epoch + 15000, privateUnlockedBy: {}, finishedBy: {}, order: ['p2', 'p1'], activeShopperIndex: 0, publicOffers: [], publicPurchasedBy: {}, publicSkippedBy: {}, orderReveal: { startedAt: epoch, firstPlayerId: 'p2', direction: 'DESCENDING', selectedIndex: 1, eligiblePlayerIds: ['p1', 'p2'] } };
      room.private.playerId = viewerId; room.private.capabilities = ['CHAT'];
      room.private.intermission = { privatePurchased: false, finished: false };
      root.render(React.createElement(MatchView, { room, client, connected: true, viewerId, voice: { enabled: false, iceServers: [], relayConfigured: false }, onView: () => {} }));
    };
  });
  for (const [elapsed, phase] of [[0, 'announce'], [1200, 'die'], [2800, 'first'], [3500, 'coin-cue'], [4700, 'coin'], [6400, 'result']]) {
    await page.evaluate(elapsed => window.showOrder(elapsed), elapsed);
    await page.locator(`[data-order-phase="${phase}"]`).waitFor();
    await page.waitForFunction(phase => document.querySelector('.table-presentation-canvas')?.dataset.presentationOrder === phase, phase);
    assert.equal(await page.locator('.table-presentation-canvas').getAttribute('data-presentation-focus'), 'order');
    assert.equal(await page.locator('.market-focus').count(), 0);
  }
  assert.match(await page.locator('.order-reveal-result').innerText(), /YOUR TURN = 2/);
  await page.screenshot({ path: 'audit/screenshots/order-reveal-result-desktop.png' });
  await page.evaluate(() => window.showOrder(6400, 'p2'));
  await page.waitForFunction(() => document.querySelector('.order-reveal-result')?.textContent.includes('YOUR TURN = 1'));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.evaluate(() => window.showOrder(4700));
  await page.locator('[data-order-phase="coin"]').waitFor();
  assert.equal(await page.locator('.scene-fallback').count(), 0);
  await page.evaluate(() => window.showOrder(7200));
  await page.waitForFunction(() => !document.querySelector('.order-reveal'));
  await page.waitForFunction(() => document.querySelector('.table-presentation-canvas')?.dataset.presentationOrder === 'none');
  assert.deepEqual(errors, []);
  console.log('Order reveal: all phases, two player positions, camera focus, market deferral, reduced motion, completion passed.');
} finally { await browser.close(); }
