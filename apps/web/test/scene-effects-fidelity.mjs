import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1344, height: 756 }, reducedMotion: 'no-preference' });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  // Freeze only this fixture's next animation callback after an observed source effect frame.
  await page.addInitScript(() => { const raf = requestAnimationFrame; window.requestAnimationFrame = callback => raf(time => { if (!window.capturePaused) callback(time); }); });
  await page.goto(process.env.E2E_WEB_URL ?? 'http://localhost:5173');
  await page.evaluate(async () => {
    const React = (await import('/node_modules/.vite/deps/react.js')).default;
    const dom = await import('/node_modules/.vite/deps/react-dom_client.js');
    const { MatchView } = await import('/src/MatchView.tsx');
    const { GameTableScene } = await import('/src/GameTableScene.tsx');
    const { ownerRoom } = await import('/src/test-fixtures.ts');
    const mount = document.createElement('main'); mount.className = 'app-shell'; document.getElementById('root').replaceWith(mount);
    const root = (dom.default ?? dom).createRoot(mount);
    const client = { command: async () => ({ ok: true, data: { revision: 8 } }), onVoicePeers: () => () => {}, onVoiceSignal: () => () => {}, leaveVoice: async () => ({ ok: true, data: {} }) };
    window.showEffect = (mode, full = false) => {
      window.capturePaused = false;
      let room = ownerRoom(); room.public.id = `effect-${mode}`; room.public.events = [];
      room.private.inspections = []; room.public.players[0].visibleInventory = ['knife', 'medicine', 'antidote', 'pistol', 'poison', 'armor'].map((itemId, index) => ({ itemId, instanceId: `effect-${index}`, quantity: 1 }));
      const render = () => root.render(full
        ? React.createElement(MatchView, { key: mode, room, client, connected: true, viewerId: 'p1', voice: { enabled: false, iceServers: [], relayConfigured: false }, onView: () => {} })
        : React.createElement('div', { className: 'match-layout match-viewport' }, React.createElement('div', { className: 'match-scene-shell' }, React.createElement(GameTableScene, { key: mode, room: room.public, viewerId: 'p1' }))));
      window.triggerEffect = () => {
        room = structuredClone(room); room.public.revision++;
        const itemId = mode.split('-')[0];
        const kind = { knife: 'WEAPON_USED', pistol: 'WEAPON_USED', medicine: 'HEALED', antidote: 'POISON_CURED', poison: 'POISON_APPLIED', handcuffs: 'HANDCUFFED', armor: 'ARMOR_BLOCKED', spyglass: 'POCKET_INSPECTED' }[itemId];
        const target = ['medicine', 'antidote'].includes(itemId) ? 'p1' : 'p2';
        room.public.events = [{ id: 'effect-event', sequence: 1, at: Date.now(), kind, actorId: 'p1', targetIds: [target], publicText: '', ...(['knife', 'pistol'].includes(itemId) ? { presentation: { itemId } } : {}) }];
        if (itemId === 'spyglass') room.private.inspections = [{ eventId: 'effect-event', payload: { targetId: 'p2', pocketIndex: 0, item: { itemId: 'knife', instanceId: 'owner-only-reveal', quantity: 1 } } }];
        else if (itemId !== 'pistol') room.public.players[0].visibleInventory = room.public.players[0].visibleInventory.map(item => item?.itemId === itemId ? null : item);
        window.effectTriggeredAt = performance.now(); render();
      };
      render();
    };
  });
  const waitScene = async mode => {
    await page.waitForFunction(id => document.querySelector('.table-presentation-canvas')?.dataset.presentationRoom === id, `effect-${mode}`);
    await page.locator('.table-presentation-canvas canvas').waitFor();
    assert.equal(await page.locator('.scene-fallback').count(), 0);
  };
  const pauseAt = async predicate => page.waitForFunction(predicate => {
    const canvas = document.querySelector('.table-presentation-canvas');
    if (canvas && Function('d', `return ${predicate}`)(canvas.dataset)) { window.capturePaused = true; return true; }
    return false;
  }, predicate);
  for (const [mode, predicate] of [['knife', 'Number(d.presentationHit)>2.5'], ['pistol', 'Number(d.presentationHit)>2.5'], ['medicine', 'Number(d.presentationFlash)>.2'], ['antidote', 'Number(d.presentationFlash)>.15'], ['poison', 'Number(d.presentationActions)>0 && performance.now()-window.effectTriggeredAt>1650'], ['handcuffs', 'Number(d.presentationActions)>0 && performance.now()-window.effectTriggeredAt>1350'], ['armor', 'Number(d.presentationActions)>0 && performance.now()-window.effectTriggeredAt>1450']]) {
    await page.evaluate(mode => window.showEffect(mode), mode); await waitScene(mode);
    await page.evaluate(() => window.triggerEffect());
    try { await pauseAt(predicate); } catch (error) {
      console.error(mode, await page.locator('.table-presentation-canvas').evaluateAll(nodes => nodes.map(node => ({ ...node.dataset }))), errors);
      throw error;
    }
    await page.screenshot({ path: `audit/screenshots/scene-${mode}-effect-desktop.png` });
  }
  await page.evaluate(() => window.showEffect('spyglass', true)); await waitScene('spyglass');
  await page.evaluate(() => window.triggerEffect()); await pauseAt('Number(d.presentationFov)<20.1');
  await page.locator('.scene-spyglass-aperture').waitFor();
  await page.screenshot({ path: 'audit/screenshots/scene-spyglass-zoom-desktop.png' });
  assert.equal(await page.locator('.table-presentation-canvas').evaluate(element => element.textContent.includes('owner-only-reveal')), false);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.evaluate(() => window.showEffect('knife-reduced')); await waitScene('knife-reduced');
  await page.evaluate(() => window.triggerEffect());
  await page.waitForFunction(() => document.querySelector('.table-presentation-canvas')?.dataset.presentationActions === '0');
  assert.equal(await page.locator('.table-presentation-canvas').getAttribute('data-presentation-flash'), '0');
  for (const size of [{ width: 1280, height: 600 }, { width: 880, height: 495 }]) {
    await page.setViewportSize(size);
    await page.evaluate(mode => window.showEffect(mode, true), `short-${size.height}`); await waitScene(`short-${size.height}`);
    for (const selector of ['.match-hud-top', '.seat-ribbon', '.self-vitals', '.action-dock']) {
      const box = await page.locator(selector).boundingBox(); assert.ok(box.x >= 0 && box.y >= 0 && box.x + box.width <= size.width + 1 && box.y + box.height <= size.height + 1, `${selector} stays in ${size.width}×${size.height}`);
    }
    const heading = await page.locator('.match-hud-top').boundingBox();
    const plates = await page.locator('.scene-nameplate').evaluateAll(nodes => nodes.filter(node => getComputedStyle(node).visibility === 'visible').map(node => { const r = node.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; }));
    assert.ok(plates.every(box => box.x + box.width <= heading.x || box.x >= heading.x + heading.width || box.y >= heading.y + heading.height || box.y + box.height <= heading.y), 'visible nameplates avoid clock/header');
    await page.screenshot({ path: `audit/screenshots/scene-short-${size.height}-desktop.png` });
    await page.getByRole('button', { name: 'Pockets', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('.table-presentation-canvas')?.dataset.presentationFocus === 'down');
    await page.screenshot({ path: `audit/screenshots/scene-pockets-${size.height}-desktop.png` });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), size.width);
    assert.equal(await page.evaluate(() => document.documentElement.scrollHeight), size.height);
  }
  assert.deepEqual(errors, []);
  console.log('PASS: knife/pistol hit beats, medicine/antidote FX, targeted poison/handcuffs/armor, owner Spyglass20° zoom, reduced motion, Pocket down-focus and1280×600/880×495 desktop bounds; twelve captures, no page errors.');
} finally { await browser.close(); }
