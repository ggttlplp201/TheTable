import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1344, height: 756 }, reducedMotion: 'no-preference' });
  page.setDefaultTimeout(10_000);
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto(process.env.E2E_WEB_URL ?? 'http://localhost:5173');
  await page.evaluate(async () => {
    const runtimeSource = await (await fetch('/src/table-scene-runtime.ts')).text();
    const threeUrl = runtimeSource.match(/from ["']([^"']*three\.js[^"']*)["']/)[1];
    const { Scene } = await import(threeUrl);
    const { createTablePresentation } = await import('/src/table-scene-runtime.ts');
    const { ownerRoom } = await import('/src/test-fixtures.ts');
    const target = document.createElement('div');
    target.style.cssText = 'position:fixed;inset:0';
    document.getElementById('root').replaceChildren(target);
    window.pistolFrames = [];
    // Inspect the actual rendered scene, including ancestor visibility, without production test hooks.
    const beforeRender = Scene.prototype.onBeforeRender;
    Scene.prototype.onBeforeRender = function (...args) {
      beforeRender.apply(this, args);
      const inventory = this.children.filter(object => object.userData.semantic?.kind === 'ITEM');
      if (!inventory.length) return;
      let visiblePistols = 0;
      this.traverseVisible(object => { if (object.userData.itemId === 'pistol') visiblePistols++; });
      const frame = {
        actions: Number(target.dataset.presentationActions), visiblePistols,
        inventory: Object.fromEntries(inventory.map(object => [object.userData.semantic.instanceId, object.visible])),
      };
      window.pistolFrame = frame; window.pistolFrames.push(frame);
    };
    let room = ownerRoom().public;
    room.players[0].visibleInventory[2] = { instanceId: 'spare-pistol', itemId: 'pistol', quantity: 1 };
    const presentation = createTablePresentation(target, room, { viewerId: 'p1', onIntroChange() {}, onError() { throw new Error('Scene failed'); } });
    window.firePistol = () => {
      room = structuredClone(room); room.revision++;
      room.events.push({ id: `shot-${room.revision}`, sequence: room.revision, at: Date.now(), kind: 'WEAPON_USED', actorId: 'p1', targetIds: ['p2'], publicText: '', presentation: { itemId: 'pistol' } });
      window.pistolFrames = []; presentation.update(room);
    };
    window.updateInventory = remove => {
      room = structuredClone(room); room.revision++;
      const slot = room.players[0].visibleInventory.findIndex(item => item?.instanceId === 'p1-pistol');
      const pistol = room.players[0].visibleInventory[slot];
      room.players[0].visibleInventory[slot] = null;
      if (!remove) room.players[0].visibleInventory[1] = pistol;
      presentation.update(room);
    };
  });
  const state = () => page.evaluate(() => window.pistolFrame);
  const startShot = async () => {
    await page.evaluate(() => window.firePistol());
    await page.waitForFunction(() => window.pistolFrame?.actions === 1);
  };
  const finishShot = async () => {
    try { await page.waitForFunction(() => window.pistolFrame?.actions === 0); } catch (error) {
      console.error(await page.evaluate(() => ({ frame: window.pistolFrame, frames: window.pistolFrames.length, data: { ...document.querySelector('[data-presentation-room]')?.dataset }, reduced: matchMedia('(prefers-reduced-motion: reduce)').matches, visibility: document.visibilityState })), errors);
      throw error;
    }
  };
  const assertActiveFrames = async (count = 3) => {
    const frames = await page.evaluate(() => window.pistolFrames.filter(frame => frame.actions === 1));
    assert.ok(frames.length > 0, 'observed firing frames');
    assert.ok(frames.every(frame => frame.inventory['p1-pistol'] !== true), 'inventory pistol stays hidden throughout firing');
    assert.ok(frames.every(frame => frame.inventory['spare-pistol'] && frame.inventory['p2-pistol']), 'other pistols stay visible');
    assert.ok(frames.every(frame => frame.visiblePistols === count), 'only one model represents the firing pistol');
  };
  assert.equal((await state()).visiblePistols, 3);
  await startShot();
  await page.waitForFunction(() => Number(document.querySelector('[data-presentation-room]')?.dataset.presentationHit) > 2.5);
  await assertActiveFrames();
  await page.screenshot({ path: 'audit/screenshots/pistol-single-model.png' });
  await finishShot();
  await assertActiveFrames();
  assert.equal((await state()).inventory['p1-pistol'], true, 'pistol returns to the table after firing');
  assert.equal((await state()).visiblePistols, 3);

  await startShot();
  await page.evaluate(() => window.updateInventory(false));
  await assertActiveFrames();
  await finishShot();
  assert.equal((await state()).inventory['p1-pistol'], true, 'moved pistol restores by instance, not old slot');

  await startShot();
  await page.evaluate(() => window.updateInventory(true));
  await assertActiveFrames();
  await finishShot();
  assert.equal((await state()).visiblePistols, 2, 'removed pistol is not restored');
  assert.equal((await state()).inventory['p1-pistol'], undefined);
  await startShot();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  // Let Chromium dispatch the preference change before toggling it again.
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await finishShot();
  assert.equal((await state()).inventory['spare-pistol'], true, 'interrupting animation restores pistol');
  await page.evaluate(() => window.firePistol());
  assert.equal((await state()).actions, 0, 'reduced motion skips firing animation');
  assert.equal((await state()).inventory['spare-pistol'], true);

  assert.equal((await state()).visiblePistols, 2);
  assert.deepEqual(errors, []);
  console.log('PASS: single pistol model throughout firing, other pistols unchanged, completion and reduced-motion restoration, inventory updates.');
} finally { await browser.close(); }
