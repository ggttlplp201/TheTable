import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1344, height: 756 }, reducedMotion: 'no-preference' });
  page.setDefaultTimeout(10_000);
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto(process.env.E2E_WEB_URL ?? 'http://localhost:5173');
  await page.evaluate(async () => {
    const React = (await import('/node_modules/.vite/deps/react.js')).default;
    const dom = await import('/node_modules/.vite/deps/react-dom_client.js');
    const { MatchView } = await import('/src/MatchView.tsx');
    const { ownerRoom } = await import('/src/test-fixtures.ts');
    const source = await (await fetch('/src/table-scene-runtime.ts')).text();
    const { Scene } = await import(source.match(/from ["']([^"']*three\.js[^"']*)["']/)[1]);
    const before = Scene.prototype.onBeforeRender;
    Scene.prototype.onBeforeRender = function (renderer, scene, camera, ...rest) {
      before.call(this, renderer, scene, camera, ...rest);
      if (!this.children.some(object => object.userData.semantic?.kind === 'ITEM')) return;
      window.sceneCamera = camera.position.toArray();
      const canvas = document.querySelector('.table-presentation-canvas');
      if (window.combatFrames) window.combatFrames.push({ at: performance.now(), y: camera.position.y, focus: canvas?.dataset.presentationFocus, hit: Number(canvas?.dataset.presentationHit), downed: Boolean(document.querySelector('.reference-downed-hud')) });
    };
    const mount = document.createElement('main'); mount.className = 'app-shell'; document.getElementById('root').replaceWith(mount);
    const root = (dom.default ?? dom).createRoot(mount);
    window.commands = [];
    const client = { command: async command => { window.commands.push(command); return { ok: true, data: { revision: 8 } }; } };
    window.showFixture = mode => {
      let room = ownerRoom(); room.public.id = `regression-${mode}`;
      const render = () => root.render(React.createElement(MatchView, { key: mode, room, client, connected: true, viewerId: 'p1', voice: { enabled: false, iceServers: [], relayConfigured: false }, onView: () => {} }));
      if (mode.startsWith('market')) {
        room.public.round.phase = 'INTERMISSION';
        delete room.public.turn;
        room.private.capabilities = ['CHAT', 'BUY', 'BUY_PUBLIC', 'SELL', 'POCKET', 'SKIP_PUBLIC_SHOP'];
        room.public.shop = { id: `sell-${mode}`, phase: 'PUBLIC', prepDeadlineAt: Date.now() - 1, publicDeadlineAt: Date.now() + 15000, privateUnlockedBy: {}, finishedBy: {}, publicOffers: [{ id: 'medicine', itemId: 'medicine', price: 4 }], order: ['p1', 'p2'], activeShopperIndex: 0, publicPurchasedBy: {}, publicSkippedBy: {} };
        room.private.intermission = { privatePurchased: false, finished: false };
      } else {
        room.public.players[0].hp = 1;
        if (mode.includes('knife')) room.public.players[1].visibleInventory[0].itemId = 'knife';
        room.private.capabilities = ['CHAT'];
      }
      window.attack = () => {
        room = structuredClone(room); room.public.revision++;
        room.public.players[0].hp = 0; room.public.players[0].life = 'DOWNED';
        const at = Date.now();
        room.public.events = ['WEAPON_USED', 'DAMAGE', 'DOWNED'].map((kind, index) => ({ id: `hit-${index}`, sequence: index + 1, at, kind, actorId: 'p2', targetIds: ['p1'], publicText: '', ...(index === 0 ? { presentation: { itemId: mode.includes('knife') ? 'knife' : 'pistol' } } : {}) }));
        if (mode.includes('knife')) room.public.players[1].visibleInventory[0] = null;
        window.combatFrames = []; window.attackAt = performance.now(); render();
      };
      window.revive = () => {
        room = structuredClone(room); room.public.revision++; room.public.players[0].hp = 2; room.public.players[0].life = 'ACTIVE'; render();
      };
      window.combatFrames = []; render();
    };
  });
  for (const [width, height] of [[1344, 756], [880, 495]]) {
    await page.setViewportSize({ width, height });
    for (const fraction of [.2, .5, .8]) {
      await page.evaluate(mode => window.showFixture(mode), `market-${width}-${fraction}`);
      const sellBack = page.getByRole('button', { name: 'SELL-BACK ▸', exact: true });
      await page.locator('.market-canvas canvas').waitFor();
      await sellBack.waitFor();
      // Raw mouse input catches movement between pointerdown/up that a retried locator click can hide.
      const box = await sellBack.boundingBox();
      await page.mouse.move(box.x + box.width * fraction, box.y + box.height / 2);
      await page.mouse.down();
      const pressed = await sellBack.boundingBox();
      assert.ok(Math.abs(pressed.x - box.x) < 5, 'pressing Sell Back preserves its anchor');
      await page.mouse.up();
      await page.getByRole('dialog', { name: 'Sell-back', exact: true }).waitFor();
      const before = await page.evaluate(() => window.commands.length);
      await page.locator('.market-sale button').click();
      await page.waitForFunction(count => window.commands.length === count + 1, before);
      assert.equal(await page.evaluate(() => window.commands.at(-1).type), 'SELL');
      assert.equal(await page.evaluate(() => window.commands.at(-1).payload.instanceId), 'p1-pistol');
    }
  }
  await page.setViewportSize({ width: 1344, height: 756 });
  const showCombat = async mode => {
    await page.evaluate(mode => window.showFixture(mode), mode);
    await page.waitForFunction(id => document.querySelector('.table-presentation-canvas')?.dataset.presentationRoom === id, `regression-${mode}`);
    await page.locator('.table-presentation-canvas canvas').waitFor();
  };
  for (const [weapon, contact] of [['pistol', 1500], ['knife', 900]]) {
    await showCombat(`combat-${weapon}`);
    const startCamera = await page.evaluate(() => window.sceneCamera);
    await page.evaluate(() => window.attack());
    await page.waitForFunction(() => document.querySelector('.table-presentation-canvas')?.dataset.presentationActions === '1');
    const early = await page.evaluate(() => ({ camera: window.sceneCamera, downed: Boolean(document.querySelector('.reference-downed-hud')), hp: document.querySelector('.self-vital-row strong')?.textContent }));
    assert.equal(early.downed, false, 'Downed overlay waits for the weapon to land');
    assert.equal(early.hp, '1/5', 'health presentation waits for weapon impact');
    assert.ok(Math.abs(early.camera[1] - startCamera[1]) < .05, 'camera stays at eye level before impact');
    await page.waitForFunction(() => document.querySelector('.table-presentation-canvas')?.dataset.presentationFocus === 'falling' && window.sceneCamera[1] < 1.5 && window.sceneCamera[1] > 1.1);
    await page.screenshot({ path: `audit/screenshots/${weapon}-downed-fall.png` });
    await page.waitForFunction(() => document.querySelector('.table-presentation-canvas')?.dataset.presentationFocus === 'downed');
    const frames = await page.evaluate(() => ({ frames: window.combatFrames, start: window.attackAt }));
    const firstDown = frames.frames.find(frame => frame.downed);
    assert.ok(firstDown.at - frames.start >= contact - 40, `${weapon}: Downed appears at contact`);
    const falling = frames.frames.filter(frame => frame.focus === 'falling');
    assert.ok(falling.length > 3, 'fall spans multiple rendered frames');
    assert.ok(falling.every((frame, index) => index === 0 || frame.y <= falling[index - 1].y + .001), 'fall progresses continuously toward the table');
    assert.equal(await page.locator('.reference-downed-hud').count(), 1);
    assert.equal(await page.locator('.self-vital-row strong').first().textContent(), '0/5');
  }
  await showCombat('combat-revive');
  await page.evaluate(() => window.attack());
  await page.waitForFunction(() => document.querySelector('.table-presentation-canvas')?.dataset.presentationActions === '1');
  await page.evaluate(() => window.revive());
  await page.waitForTimeout(1800);
  assert.equal(await page.locator('.reference-downed-hud').count(), 0);
  assert.equal(await page.locator('.self-vital-row strong').first().textContent(), '2/5');
  assert.equal(await page.locator('.table-presentation-canvas').getAttribute('data-presentation-focus'), 'seat');

  await showCombat('combat-fallback');
  await page.locator('.table-presentation-canvas canvas').evaluate(canvas => canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true })));
  await page.locator('.scene-fallback').waitFor();
  await page.evaluate(() => window.attack());
  await page.locator('.reference-downed-hud').waitFor();
  assert.equal(await page.locator('.self-vital-row strong').first().textContent(), '0/5');

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await showCombat('combat-reduced');
  await page.evaluate(() => window.attack());
  await page.waitForFunction(() => document.querySelector('.table-presentation-canvas')?.dataset.presentationFocus === 'downed');
  assert.equal(await page.locator('.table-presentation-canvas').getAttribute('data-presentation-actions'), '0');
  assert.equal(await page.locator('.reference-downed-hud').count(), 1);
  assert.deepEqual(errors, []);
  console.log('PASS: six Sell Back pointer clicks and sale commands; pistol/knife contact before Downed; continuous fall; revival, renderer fallback and reduced motion.');
} finally { await browser.close(); }
