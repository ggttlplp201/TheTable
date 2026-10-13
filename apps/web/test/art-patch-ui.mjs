import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 880, height: 495 }, reducedMotion: 'reduce' });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(process.env.E2E_WEB_URL ?? 'http://localhost:5173');
  await page.evaluate(async () => {
    const React = (await import('/node_modules/.vite/deps/react.js')).default;
    const dom = await import('/node_modules/.vite/deps/react-dom_client.js');
    const { MatchView } = await import('/src/MatchView.tsx');
    const { ownerRoom, spectatorRoom } = await import('/src/test-fixtures.ts');
    const mount = document.createElement('main'); mount.className = 'app-shell';
    document.getElementById('root').replaceWith(mount);
    const root = (dom.default ?? dom).createRoot(mount);
    window.patchMusic = { track: undefined, threat: false };
    const audio = {
      setMusic: track => { window.patchMusic.track = track; },
      setThreat: threat => { window.patchMusic.threat = threat; },
      play() {}, playItem() {}, playUse() {}, handleEvent() {},
      state: () => ({ volume: .65, roomVolume: .55, effectsVolume: .7, muted: false }),
    };
    window.patchCommands = [];
    const client = { command: async command => { window.patchCommands.push(command); return { ok: true, data: { revision: 8 } }; }, onVoicePeers: () => () => {}, onVoiceSignal: () => () => {}, leaveVoice: async () => ({ ok: true, data: {} }) };
    window.renderPatchState = (mode, readyAt = 1000) => {
      if (mode === 'unmount') { root.render(null); return; }
      const room = mode === 'spectator' ? spectatorRoom() : ownerRoom();
      room.public.events = [];
      if (mode === 'shop' || mode === 'shop-spent') {
        room.public.round.phase = 'INTERMISSION'; delete room.public.turn;
        room.public.shop = { id: 'art-patch-intermission', phase: 'PUBLIC', prepDeadlineAt: Date.now() - 1, publicDeadlineAt: Date.now() + 15000, privateUnlockedBy: { p1: true }, finishedBy: {}, order: ['p1', 'p2'], activeShopperIndex: 1, publicOffers: [], publicPurchasedBy: {}, publicSkippedBy: { p1: true } };
        room.private.capabilities = ['CHAT', 'BUY', 'BUY_BLACK', 'REROLL_MARKET', 'SELL', 'POCKET', 'FINISH_SHOPPING'];
        room.private.intermission = { privatePurchased: false, finished: false };
        room.public.players[0].visibleInventory[2] = { itemId: 'brass-idol', instanceId: 'idol', quantity: 1 };
        room.private.blackMarket = [{ id: 'knife', itemId: 'knife', price: 5 }, { id: 'sold', itemId: 'safe', price: 5 }];
        if (mode === 'shop-spent') {
          room.private.intermission.privatePurchased = true;
          room.private.abilities = { quickDrawUsed: false, brassIdolRound: room.public.round.number };
          room.private.blackMarket[1].purchasedBy = 'p1';
          room.private.capabilities = ['CHAT', 'SELL', 'POCKET', 'FINISH_SHOPPING'];
        }
      }
      if (mode === 'threat') {
        room.public.pendingThreat = { id: 'threat', actorId: 'p2', targetId: 'p1', demandedItems: [], demandedCoins: 2, mode: 'COVERED', status: 'PENDING', deadlineAt: Date.now() + 30000 };
        room.private.capabilities = ['RESPOND_THREAT'];
      }
      if (mode === 'fulfilled') {
        room.private.objective.status = 'EXIT_READY'; room.private.objective.firstReadyAt = readyAt;
        room.public.players[0].objectiveCompleted = true;
      }
      if (mode === 'results') room.public.status = 'RESULTS';
      root.render(React.createElement(MatchView, { key: mode, room, client, connected: true, viewerId: 'p1', voice: { enabled: false, iceServers: [], relayConfigured: false }, audioEngine: audio, audioStarted: true, onEnableAudio() {}, onView() {}, onReturnHome() {} }));
    };
    window.renderPatchState('turn');
  });
  const music = async (track, threat = false) => {
    await page.waitForFunction(expected => window.patchMusic.track === expected.track && window.patchMusic.threat === expected.threat, { track, threat });
  };
  const change = async mode => { await page.evaluate(mode => window.renderPatchState(mode), mode); };
  await music('table');
  assert.equal(await page.getByRole('button', { name: 'Public Shop', exact: true }).count(), 0);
  await page.getByRole('button', { name: /\[1\].*Trade/i }).click();
  await page.locator('[data-modal=true]').waitFor();
  assert.equal(await page.locator('.match-hud-top').isVisible(), true);
  assert.equal(await page.locator('.self-hand').isVisible(), false);
  const bounds = await page.locator('.reference-interface').evaluate(node => { const r = node.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, height: innerHeight }; });
  assert.ok(bounds.top >= 72 && bounds.bottom <= bounds.height, JSON.stringify(bounds));
  await page.getByRole('button', { name: 'Propose Trade', exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'audit/screenshots/art-patch-trade-short.png' });
  await change('contract');
  await page.getByRole('button', { name: 'Contract', exact: true }).click();
  await page.locator('.contract-locked').scrollIntoViewIfNeeded();
  const locked = await page.locator('.contract-locked').boundingBox();
  assert.ok(locked.y > 72 && locked.y + locked.height <= 495);
  await page.screenshot({ path: 'audit/screenshots/art-patch-contract-scroll.png' });
  await change('threat');
  await music('table', true);
  await change('shop');
  await music('shop');
  await page.locator('.market-footer').hover();
  await page.locator('.market-footer').getByRole('button', { name: 'Black Market', exact: true }).click();
  await music('market');
  await page.mouse.move(0, 0);
  const reroll = page.getByRole('button', { name: 'Reroll Knife with Brass Idol', exact: true });
  assert.equal(await reroll.evaluate(node => getComputedStyle(node).pointerEvents), 'auto');
  assert.equal(await reroll.isVisible(), true);
  await page.locator('.market-canvas canvas').waitFor();
  const slip = page.locator('.market-stock-tag').filter({ has: reroll });
  await slip.hover();
  const rerollBox = await reroll.boundingBox();
  await page.mouse.move(rerollBox.x + rerollBox.width / 2, rerollBox.y + rerollBox.height / 2, { steps: 12 });
  assert.equal(await reroll.evaluate(node => getComputedStyle(node).pointerEvents), 'auto');
  await page.mouse.click(rerollBox.x + rerollBox.width / 2, rerollBox.y + rerollBox.height / 2);
  await page.waitForFunction(() => window.patchCommands.some(command => command.type === 'REROLL_MARKET'));
  await reroll.focus();
  await page.waitForFunction(() => getComputedStyle(document.querySelector('.market-stock-tag:not(.sold) .market-reroll')).opacity === '1');
  await change('shop-spent');
  await page.locator('.market-footer').getByRole('button', { name: 'Black Market', exact: true }).click();
  assert.equal(await page.locator('.market-stock-tag.sold .market-reroll').isDisabled(), true);
  assert.equal(await page.getByRole('button', { name: 'Reroll Knife with Brass Idol', exact: true }).isDisabled(), true);
  await page.locator('.market-footer').hover();
  await page.locator('.market-footer').getByRole('button', { name: /Step back/ }).click();
  await music('shop');
  await change('spectator');
  await music('after');
  await page.locator('.spectator-cards').waitFor();
  assert.equal(await page.locator('.match-hud-top').isVisible(), true);
  assert.ok((await page.locator('.spectator-cards').boundingBox()).y >= 96);
  await page.getByRole('button', { name: 'Close Spectator god view', exact: true }).click();
  assert.equal(await page.getByRole('dialog', { name: 'Spectator god view', exact: true }).count(), 0);
  await page.getByRole('button', { name: 'God view', exact: true }).click();
  await page.getByRole('dialog', { name: 'Spectator god view', exact: true }).waitFor();
  await change('results');
  await music(undefined);
  await page.getByRole('button', { name: 'Return to Home' }).waitFor();
  console.log('Patch UI: modal controls, contract scroll, markets/music, spectator/results passed.');
  await change('fulfilled');
  await page.locator('.reference-fulfilled-banner').waitFor();
  await page.locator('.reference-fulfilled-banner').waitFor({ state: 'detached', timeout: 6500 });
  await change('turn');
  await change('fulfilled');
  await page.getByRole('button', { name: 'Contract', exact: true }).waitFor();
  assert.equal(await page.locator('.reference-fulfilled-banner').count(), 0);
  await page.evaluate(() => window.renderPatchState('fulfilled', 2000));
  await page.locator('.reference-fulfilled-banner').waitFor();
  await change('threat'); await music('table', true);
  await change('unmount'); await music(undefined);
  assert.deepEqual(errors, []);
  console.log('Patch UI: five-second banner, same-contract deduplication, rematch and shared music cleanup passed.');
} finally { await browser.close(); }
