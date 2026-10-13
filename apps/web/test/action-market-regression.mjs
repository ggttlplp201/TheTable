import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const gamePath = `/@fs${fileURLToPath(new URL('../../../packages/game/src/', import.meta.url))}`;
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1344, height: 756 }, reducedMotion: 'reduce' });
  page.setDefaultTimeout(12_000);
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto(process.env.E2E_WEB_URL ?? 'http://localhost:5173');
  await page.evaluate(async gamePath => {
    const React = (await import('/node_modules/.vite/deps/react.js')).default;
    const dom = await import('/node_modules/.vite/deps/react-dom_client.js');
    const { MatchView } = await import('/src/MatchView.tsx');
    const { MarketFocus } = await import('/src/MarketFocus.tsx');
    const { startMatch, applyCommand, applyTimeout, getNextDeadline } = await import(`${gamePath}engine.ts`);
    const { beginIntermission } = await import(`${gamePath}economy.ts`);
    const { projectAuthorizedRoom } = await import(`${gamePath}room.ts`);
    const { RULES } = await import(`${gamePath}content.ts`);
    const mount = document.createElement('main'); mount.className = 'app-shell'; document.getElementById('root').replaceWith(mount);
    const root = (dom.default ?? dom).createRoot(mount);
    let serial = 0;
    window.setupActionFixture = mode => {
      serial++;
      const now = Date.now() - RULES.intermissionPrepMs;
      let state = startMatch({ id: `action-market-${serial}`, code: 'ABC234', status: 'LOBBY', revision: 1, hostPlayerId: 'p1', createdAt: now, updatedAt: now,
        players: ['Ada', 'Bruno', 'Cora'].map((name, index) => ({ id: `p${index + 1}`, seat: index, name, normalizedName: name.toLowerCase(), connection: 'CONNECTED', roleId: ['enforcer', 'medic', 'locksmith'][index], ready: true, hp: 5, score: 0, life: 'ACTIVE', inventory: { visible: Array(6).fill(null), pockets: [{ source: 'DEFAULT', protectedBySafe: false, item: null }], coins: 0 } })),
      }, { seed: 77, now });
      const bonusId = state.setup.bonusItemInstanceId;
      for (const player of state.players) state = applyCommand(state, player.id, { type: 'LOCK_SETUP', instanceId: player.inventory.visible[2].instanceId }, now);
      for (const player of state.players) player.inventory.visible = player.inventory.visible.map(item => item?.instanceId === bonusId ? null : item);
      state.round.number = 2;
      state.events = [];
      state.players.forEach((player, index) => player.objective = { objectiveId: ['arsenal', 'collector', 'tycoon'][index], status: 'ACTIVE', progress: {}, rewardGranted: false });
      state.players[0].inventory.visible = state.players[0].inventory.visible.map(item => item?.itemId === 'bullet' ? null : item);
      state.players[0].abilities.quickDrawUsed = true;
      state.players[0].inventory.coins = 20;
      if (mode === 'market') {
        beginIntermission(state, now);
        delete state.shop.orderReveal;
        state.shop.order = ['p1', 'p2', 'p3'];
        state.shop.publicOffers = [{ id: 'medicine', itemId: 'medicine', price: 4 }, { id: 'armor', itemId: 'armor', price: 5 }];
        state.shop.privateOffers.p1 = [{ id: 'safe', itemId: 'safe', price: 5 }, { id: 'lockpick', itemId: 'lockpick', price: 4 }];
        state = applyTimeout(state, state.shop.prepDeadlineAt);
      }
      const projection = () => ({ ...projectAuthorizedRoom(state, 'p1'), viewerPlayerId: 'p1', messages: [] });
      const render = () => root.render(mode === 'market'
        ? React.createElement(MarketFocus, { key: serial, room: projection(), busy: false, initialView: 'PUBLIC', send: async command => (await submit(command)).ok, onClose: () => window.steppedBack = true })
        : React.createElement(MatchView, { key: serial, room: projection(), client, connected: true, viewerId: 'p1', voice: { enabled: false, iceServers: [], relayConfigured: false }, onView: () => render() }));
      const submit = async command => {
        window.commands.push(command);
        try {
          const at = Date.now();
          while (getNextDeadline(state) !== undefined && getNextDeadline(state) <= at) state = applyTimeout(state, at);
          state = applyCommand(state, 'p1', command, at); window.fixtureState = state; render(); return { ok: true, data: { revision: state.revision } };
        }
        catch (error) { window.lastError = error.message; return { ok: false, error: { code: error.code, message: error.message } }; }
      };
      const client = { command: async ({ type, payload }) => submit({ type, ...payload }), sync: async () => { if (window.failSync) throw new Error('sync unavailable'); return { ok: true, data: { view: projection() } }; } };
      window.commands = []; window.lastError = undefined; window.fixtureState = state; window.failSync = false; render();
    };
  }, gamePath);

  await page.evaluate(() => window.setupActionFixture('threat'));
  await page.locator('.action-dock').getByRole('button', { name: /Threaten/i }).click();
  await page.getByRole('button', { name: 'Make Threat', exact: true }).click();
  const failure = page.locator('.action-feedback [role="alert"]');
  await failure.filter({ hasText: 'Your Pistol needs a Bullet' }).waitFor();
  assert.match(await failure.innerText(), /Quick Draw has already been used/);
  assert.equal(await page.evaluate(() => window.fixtureState.turn.primaryUsed), false);
  assert.equal(await page.evaluate(() => {
    const feedback = document.querySelector('.action-feedback'), box = feedback.getBoundingClientRect();
    return feedback.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2));
  }), true, 'failure is above the threat overlay');
  await page.screenshot({ path: fileURLToPath(new URL('../../../audit/screenshots/action-failure-no-ammo.png', import.meta.url)) });
  await page.keyboard.press('Escape');
  await page.locator('.action-dock').getByRole('button', { name: /Use item/i }).click();
  await page.evaluate(() => window.failSync = true);
  await page.getByRole('button', { name: 'Use Pistol', exact: true }).click();
  await failure.filter({ hasText: 'Your Pistol needs a Bullet' }).waitFor();
  assert.doesNotMatch(await failure.innerText(), /interrupted|Retry/);
  assert.equal(await page.evaluate(() => window.fixtureState.turn.primaryUsed), false);

  async function menuIsPersistent() {
    await page.mouse.move(1, 1);
    const menu = page.getByRole('navigation', { name: 'Market navigation' });
    for (const label of ['Step back', 'Black Market', 'Pockets', 'Finish Intermission']) await menu.getByRole('button', { name: new RegExp(label, 'i') }).waitFor({ state: 'visible' });
    const values = await menu.locator('button').evaluateAll(buttons => buttons.map(button => {
      const box = button.getBoundingClientRect();
      return { background: getComputedStyle(button).backgroundColor, visible: box.top >= 0 && box.bottom <= innerHeight && box.left >= 0 && box.right <= innerWidth, hit: button.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)) };
    }));
    assert.ok(values.every(value => value.background === 'rgba(0, 0, 0, 0)' && value.visible && value.hit), JSON.stringify(values));
  }
  for (const [width, height] of [[1344, 756], [880, 495]]) {
    await page.setViewportSize({ width, height });
    await page.evaluate(() => window.setupActionFixture('market'));
    await page.locator('.market-canvas canvas').waitFor();
    await menuIsPersistent();
    assert.equal(await page.getByRole('button', { name: 'Buy Safe', exact: true }).count(), 0);
    const black = page.getByRole('navigation', { name: 'Market navigation' }).getByRole('button', { name: 'Black Market', exact: true });
    assert.equal(await black.isDisabled(), true);
    assert.match(await black.getAttribute('title'), /buy or pass on your Public Shop turn/);
    assert.equal(await page.getByRole('dialog', { name: 'Your private Black Market' }).count(), 0);
    await page.getByRole('button', { name: 'Pass Public Shop', exact: true }).click();
    await page.getByRole('dialog', { name: 'Your private Black Market' }).waitFor();
    await menuIsPersistent();
    assert.equal(await page.evaluate(() => window.fixtureState.shop.publicSkippedBy.p1), true);
    await page.getByRole('button', { name: 'Pockets', exact: true }).click();
    await menuIsPersistent();
    await page.getByRole('button', { name: 'Close Pockets ×', exact: true }).click();
    await page.getByRole('button', { name: 'Buy Safe', exact: true }).click();
    await page.waitForFunction(() => window.fixtureState.shop.privatePurchasedBy.p1);
    await page.locator('.market-canvas canvas').waitFor();
    await page.mouse.move(1, 1);
    await page.waitForTimeout(500); // Let the rebuilt scene paint before the visual artifact.
    await page.screenshot({ path: fileURLToPath(new URL(`../../../audit/screenshots/market-persistent-menu-${width}.png`, import.meta.url)) });

    await page.evaluate(() => window.setupActionFixture('market'));
    await page.getByRole('button', { name: 'SELL-BACK ▸', exact: true }).click();
    await page.getByRole('dialog', { name: 'Sell-back', exact: true }).waitFor();
    await page.locator('.market-canvas canvas').waitFor();
    await menuIsPersistent();
    await page.getByRole('button', { name: 'Public Shop', exact: true }).click().catch(async error => { console.log('public navigation', await page.evaluate(() => ({ body: document.body.innerText, buttons: [...document.querySelectorAll('button')].map(b => b.textContent) }))); throw error; });
    await page.locator('.market-canvas canvas').waitFor();
    await page.getByRole('button', { name: 'Buy Medicine', exact: true }).click();
    await page.waitForFunction(() => window.fixtureState.shop.publicPurchasedBy.p1).catch(async error => { console.log(await page.evaluate(() => ({ commands: window.commands, error: window.lastError, body: document.body.innerText }))); throw error; });
    await page.getByRole('button', { name: 'Black Market', exact: true }).click();
    await page.getByRole('dialog', { name: 'Your private Black Market' }).waitFor();
    await menuIsPersistent();
    await page.getByRole('button', { name: 'Finish Intermission', exact: true }).click();
    await page.waitForFunction(() => window.fixtureState.shop.finishedBy.p1 === true);
  }
  assert.deepEqual(errors, []);
  console.log('Real engine rejection messages, visible errors, purchase/skip market gates, and persistent transparent navigation verified at desktop and 880×495.');
} finally { await browser.close(); }
