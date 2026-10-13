import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';

// Component interaction regression: real production components, authorized fixtures only.
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1344, height: 756 }, reducedMotion: 'reduce' });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto(process.env.E2E_WEB_URL ?? 'http://localhost:5173');
  await page.evaluate(async () => {
    const React = (await import('/node_modules/.vite/deps/react.js')).default;
    const dom = await import('/node_modules/.vite/deps/react-dom_client.js');
    const { SceneItemCard } = await import('/src/SceneContext.tsx');
    const { HudClock } = await import('/src/MatchView.tsx');
    const { PendingInteraction } = await import('/src/MatchPanels.tsx');
    const { ownerRoom } = await import('/src/test-fixtures.ts');
    const mount = document.createElement('main'); document.getElementById('root').replaceWith(mount);
    const root = (dom.default ?? dom).createRoot(mount);
    Date.now = () => 1791360000000;
    window.uiActions = [];
    window.renderUI = (mode, busy = false) => {
      const room = ownerRoom();
      const item = { instanceId: 'selected', itemId: 'knife', quantity: 1 };
      room.public.players[0].visibleInventory = [item];
      room.private.pockets = [{ source: 'DEFAULT', protectedBySafe: false }];
      room.private.capabilities = ['USE_ITEM', 'POCKET'];
      let body;
      if (mode.startsWith('clock')) {
        const seconds = mode === 'clock-calm' ? 41 : mode === 'clock-warn' ? 9 : 4;
        const mine = mode !== 'clock-other';
        body = React.createElement('header', { className: 'core-hud-heading', 'data-mine': mine ? 'true' : undefined },
          React.createElement('strong', null, mine ? 'YOUR TURN' : 'OTHER TURN'),
          React.createElement('span', { className: 'core-clock' }, React.createElement(HudClock, { deadline: Date.now() + seconds * 1000, mine })));
      } else if (mode.startsWith('response')) {
        room.private.capabilities = mode === 'response-denied' ? [] : ['RESPOND_THREAT'];
        room.public.pendingThreat = { id: 'threat', actorId: 'p2', targetId: 'p1', mode: 'COVERED', demandedItems: [], demandedCoins: 2, status: 'PENDING', deadlineAt: Date.now() + 24000 };
        body = React.createElement('div', { className: 'forced-decision' }, React.createElement(PendingInteraction, { room, busy, send: async command => { window.uiActions.push(command); return true; } }));
      } else {
        if (mode === 'denied') room.private.capabilities = [];
        body = React.createElement('div', { className: 'table-presentation', style: { position: 'fixed', inset: 0 } },
          React.createElement(SceneItemCard, { key: mode, room, item, busy, aiming: false, onUse: () => window.uiActions.push('use'), onPutDown: () => window.uiActions.push('down'), send: async command => { window.uiActions.push(command); return true; } }),
          React.createElement('input', { 'aria-label': 'Typing guard', style: { position: 'absolute', top: 0 } }));
      }
      root.render(body);
    };
  });
  for (const [mode, color, size, bar] of [
    ['calm', 'rgb(224, 160, 64)', '44px', 1], ['warn', 'rgb(240, 176, 80)', '50px', 1],
    ['critical', 'rgb(232, 112, 92)', '54px', 1], ['other', 'rgb(143, 130, 112)', '38px', 0],
  ]) {
    await page.evaluate(mode => window.renderUI(`clock-${mode}`), mode);
    const timer = page.locator(`[data-clock="${mode}"]`); await timer.waitFor();
    assert.deepEqual(await timer.evaluate(element => ({ color: getComputedStyle(element).color, size: getComputedStyle(element).fontSize, animation: getComputedStyle(element).animationName })), { color, size, animation: 'none' });
    assert.equal(await page.locator('.core-clock-bar').count(), bar);
  }
  await page.evaluate(() => window.renderUI('item'));
  const card = page.getByRole('region', { name: 'Selected Knife' }); await card.waitFor();
  assert.ok(Math.abs((await card.boundingBox()).x + (await card.boundingBox()).width / 2 - 672) < 1, 'item card remains centered');
  assert.equal(await card.evaluate(element => element.scrollWidth > element.clientWidth), false, 'item card has no horizontal overflow');
  await page.keyboard.press('e'); assert.deepEqual(await page.evaluate(() => window.uiActions), ['use']);
  await card.getByRole('button', { name: 'USE', exact: true }).focus();
  await page.keyboard.press('Escape'); assert.deepEqual(await page.evaluate(() => window.uiActions), ['use', 'down'], 'Escape fires once even inside the card');
  await page.keyboard.press('Shift+E'); await page.keyboard.press('Shift+Q');
  assert.deepEqual(await page.evaluate(() => window.uiActions), ['use', 'down'], 'modified shortcuts do not activate');
  await page.keyboard.press('q'); await card.getByRole('button', { name: 'POCKET 1 ◇', exact: true }).click();
  assert.equal((await page.evaluate(() => window.uiActions)).at(-1).type, 'POCKET');
  const before = (await page.evaluate(() => window.uiActions)).length;
  await page.getByLabel('Typing guard').fill(''); await page.keyboard.type('eq'); await page.keyboard.press('Escape');
  assert.equal((await page.evaluate(() => window.uiActions)).length, before, 'typing never triggers shortcuts');
  await page.evaluate(() => window.renderUI('denied'));
  await page.waitForFunction(() => document.querySelector('.scene-item-actions button.use')?.disabled);
  await card.getByRole('button', { name: 'PUT DOWN', exact: true }).focus();
  await page.keyboard.press('e'); await page.keyboard.press('q');
  assert.equal((await page.evaluate(() => window.uiActions)).length, before, 'capability-denied shortcuts do nothing');
  assert.equal(await card.getByRole('button', { name: 'USE', exact: true }).isDisabled(), true);
  assert.equal(await card.getByRole('button', { name: 'USE', exact: true }).evaluate(element => getComputedStyle(element).borderStyle), 'dashed');
  await page.evaluate(() => window.renderUI('response'));
  await page.getByRole('button', { name: 'Comply', exact: true }).waitFor();
  assert.equal(await page.locator('.response-progress > div').evaluate(element => element.style.width), '80%');
  assert.equal((await page.locator('.response-progress').boundingBox()).height, 8);
  assert.match(await page.locator('.reference-response').evaluate(element => getComputedStyle(element).backgroundImage), /rgb\(232, 112, 92\)/, 'threat rivets are red, not inherited brass');
  await page.keyboard.press('y'); await page.keyboard.press('n');
  assert.deepEqual((await page.evaluate(() => window.uiActions)).slice(-2), [{ type: 'RESPOND_THREAT', comply: true }, { type: 'RESPOND_THREAT', comply: false }]);
  await page.evaluate(() => window.renderUI('response', true));
  await page.waitForFunction(() => document.querySelector('.reference-response button.primary')?.disabled);
  const busyCount = (await page.evaluate(() => window.uiActions)).length;
  await page.keyboard.press('y'); assert.equal((await page.evaluate(() => window.uiActions)).length, busyCount);
  await page.evaluate(() => window.renderUI('response-denied')); await page.getByRole('button', { name: 'Comply', exact: true }).waitFor({ state: 'detached' });
  await page.keyboard.press('n'); assert.equal((await page.evaluate(() => window.uiActions)).length, busyCount);
  assert.deepEqual(errors, []);
  console.log('PASS: v2 timer states, reduced motion, centered item card, E/Q/Esc, typing/capability guards, Y/N responses and segmented countdown.');
} finally { await browser.close(); }
