import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

// Production components with deterministic authorized projections. No server rules are replaced.
const output = new URL('../../../audit/screenshots/', import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1344, height: 756 }, reducedMotion: 'reduce' });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(process.env.E2E_WEB_URL ?? 'http://localhost:5173');
  await page.evaluate(async () => {
    const React = (await import('/node_modules/.vite/deps/react.js')).default;
    const dom = await import('/node_modules/.vite/deps/react-dom_client.js');
    const { createRoot } = dom.default ?? dom;
    const { MatchView } = await import('/src/MatchView.tsx');
    const { GameTableScene } = await import('/src/GameTableScene.tsx');
    const { ownerRoom, spectatorRoom } = await import('/src/test-fixtures.ts');
    const mount = document.createElement('div'); document.getElementById('root').replaceWith(mount);
    const root = createRoot(mount);
    window.captureCommands = [];
    const client = {
      command: async command => { window.captureCommands.push(command); return { ok: true, data: { revision: 8 } }; },
      onVoicePeers: () => () => {}, onVoiceSignal: () => () => {},
      joinVoice: async () => ({ ok: true, data: { playerIds: [] } }),
      leaveVoice: async () => ({ ok: true, data: { left: true } }),
    };
    window.captureScene = (count, viewer = 'p1', mode = 'turn', sceneOnly = false) => {
      window.captureCommands = [];
      const room = mode === 'spectator' ? spectatorRoom() : ownerRoom();
      room.public.id = `scene-${count}-${viewer}-${mode}`;
      const template = structuredClone(room.public.players[1]);
      for (let index = 2; index < count; index++) room.public.players.push({ ...structuredClone(template), id: `p${index + 1}`, seat: index, name: ['Ada', 'Bruno', 'Ilka', 'Vesna'][index], roleId: ['enforcer', 'medic', 'smuggler', 'broker'][index], visibleInventory: [] });
      room.public.players = room.public.players.slice(0, count);
      room.public.chests = [{ kind: 'STANDARD', availability: 'AVAILABLE' }, { kind: 'BLACK', availability: 'AVAILABLE' }];
      if (mode !== 'spectator') {
        const source = room.public.players[0], local = room.public.players.find(player => player.id === viewer);
        if (viewer !== 'p1') { const inventory = source.visibleInventory; source.visibleInventory = local.visibleInventory; local.visibleInventory = inventory; }
        room.private.playerId = viewer; room.viewerPlayerId = viewer;
        if (mode === 'downed') { local.hp = 0; local.life = 'DOWNED'; room.private.capabilities = []; }
        if (['props', 'exit', 'chest', 'covered', 'open'].includes(mode)) {
          local.visibleInventory = ['knife', 'medicine', 'key', 'bullet', 'cloth', 'armor'].map((itemId, index) => ({ instanceId: `prop-${index}`, itemId, quantity: itemId === 'bullet' ? 2 : 1 }));
          room.public.players[1].objectiveCompleted = true;
        }
        if (mode === 'exit') room.private.capabilities = ['LEAVE_TABLE', 'STAY'];
        if (mode === 'covered' || mode === 'open') {
          room.public.pendingThreat = { id: 'scene-threat', actorId: 'p2', targetId: 'p1', mode: mode === 'covered' ? 'COVERED' : 'OPEN', demandedItems: [], demandedCoins: 1, status: 'PENDING', deadlineAt: Date.now() + 30_000, ...(mode === 'open' ? { committedItemType: 'pistol', committedItemId: 'p2-pistol' } : {}) };
          room.private.capabilities = ['RESPOND_THREAT'];
        }
      }
      root.render(React.createElement('main', { className: 'app-shell' }, sceneOnly
        ? React.createElement('div', { className: 'match-layout match-viewport' }, React.createElement('div', { className: 'match-scene-shell' }, React.createElement(GameTableScene, { key: mode, room: room.public, viewerId: viewer, showOwnerMarket: true })))
        : React.createElement(MatchView, { key: `${count}:${viewer}:${mode}`, room, client, connected: true, viewerId: viewer, voice: { enabled: false, iceServers: [], relayConfigured: false }, onView: () => {} })));
    };
    window.captureFlight = () => {
      let room = ownerRoom().public;
      room.id = 'scene-loot-flight'; room.events = [];
      room.chests = [{ kind: 'STANDARD', availability: 'AVAILABLE' }, { kind: 'BLACK', availability: 'AVAILABLE' }];
      const render = () => root.render(React.createElement('main', { className: 'app-shell' }, React.createElement('div', { className: 'match-layout match-viewport' }, React.createElement('div', { className: 'match-scene-shell' }, React.createElement(GameTableScene, { key: 'loot-flight', room, viewerId: 'p1' })))));
      render();
      window.openCapturedChest = () => {
        room = structuredClone(room); room.revision += 1;
        room.players[0].visibleInventory[2] = { instanceId: 'new-spyglass', itemId: 'spyglass', quantity: 1 };
        room.chests[0].availability = 'OPENED';
        room.events.push({ id: 'loot-open', sequence: 1, at: Date.now(), kind: 'CHEST_OPENED', actorId: 'p1', targetIds: [], publicText: '', presentation: { itemId: 'key', chestKind: 'STANDARD' } });
        render();
      };
    };
  });
  const captures = [[2, 'p1', 'turn', 'scene-2p-desktop'], [3, 'p1', 'turn', 'scene-3p-desktop'], [4, 'p1', 'turn', 'scene-4p-desktop'], [4, 'p3', 'turn', 'scene-seat3-desktop'], [4, 'p1', 'downed', 'scene-downed-desktop'], [2, 'p1', 'spectator', 'scene-spectator-desktop'], [4, 'p1', 'props', 'scene-props-desktop'], [4, 'p1', 'exit', 'scene-exit-desktop'], [4, 'p1', 'chest', 'scene-chest-desktop'], [4, 'p1', 'covered', 'scene-covered-desktop'], [4, 'p1', 'open', 'scene-open-threat-desktop']];
  for (const [count, viewer, mode, name] of captures) {
    await page.evaluate(([count, viewer, mode]) => window.captureScene(count, viewer, mode), [count, viewer, mode]);
    await page.locator('.table-presentation-canvas canvas').waitFor();
    await page.waitForFunction(id => document.querySelector('.table-presentation-canvas')?.dataset.presentationRoom === id, `scene-${count}-${viewer}-${mode}`);
    await page.waitForFunction(() => document.querySelector('.table-presentation-canvas')?.dataset.presentationIntro === 'none');
    assert.equal(await page.locator('.scene-fallback').count(), 0);
    if (mode === 'spectator') {
      await page.getByRole('button', { name: 'Close Spectator god view', exact: true }).click();
      await page.getByRole('button', { name: 'Close Spectator god view', exact: true }).waitFor({ state: 'detached' });
      assert.match(await page.locator('.core-hud-heading').textContent(), /◎ SPECTATING · GOD VIEW.*ALL INPUT DISABLED · CHAT READ-ONLY/);
      assert.equal(await page.locator('.action-dock').count(), 0);
    }
    if (mode === 'exit') {
      const leave = page.getByRole('button', { name: '⤴ LEAVE TABLE', exact: true });
      await leave.waitFor({ state: 'visible' });
      const box = await leave.boundingBox(); assert.ok(box.y >= 0 && box.y + box.height <= 756, 'door action is not clipped');
      await page.waitForFunction(() => document.querySelector('.table-presentation-canvas')?.dataset.presentationFocus === 'door');
    }
    if (mode === 'chest') {
      const point = await page.locator('.table-presentation').evaluate(element => ({ clientX: parseFloat(element.style.getPropertyValue('--scene-standard-x')), clientY: parseFloat(element.style.getPropertyValue('--scene-standard-y')) + 70 }));
      await page.locator('.table-presentation-canvas canvas').dispatchEvent('pointerdown', { ...point, pointerId: 1, pointerType: 'mouse' });
      await page.locator('.table-presentation-canvas canvas').dispatchEvent('pointerup', { ...point, pointerId: 1, pointerType: 'mouse' });
      await page.getByRole('dialog', { name: 'Standard Chest', exact: true }).waitFor();
      await page.getByRole('button', { name: 'YES, OPEN', exact: true }).waitFor();
      assert.equal(await page.locator('.scene-chest-prompt h2').evaluate(element => getComputedStyle(element).fontSize), '28px');
    }
    await page.screenshot({ path: fileURLToPath(new URL(`${name}.png`, output)) });
    if (mode === 'exit' || mode === 'chest') {
      await page.getByRole('button', { name: mode === 'exit' ? '⤴ LEAVE TABLE' : 'YES, OPEN', exact: true }).click();
      const command = await page.evaluate(() => window.captureCommands.at(-1));
      assert.equal(command.type, mode === 'exit' ? 'LEAVE_TABLE' : 'USE_ITEM');
      if (mode === 'chest') assert.equal(command.payload.instanceId, 'prop-2');
    }
  }
  for (const mode of ['covered', 'open']) {
    await page.evaluate(mode => window.captureScene(4, 'p1', mode, true), mode);
    await page.locator('.table-presentation-canvas canvas').waitFor();
    await page.waitForFunction(() => document.querySelector('.table-presentation-canvas')?.dataset.presentationIntro === 'none');
    await page.screenshot({ path: fileURLToPath(new URL(`scene-${mode}-pose-desktop.png`, output)) });
  }
  await page.evaluate(() => window.captureScene(4, 'p1', 'props'));
  await page.waitForFunction(() => document.querySelector('.table-presentation-canvas')?.dataset.presentationRoom === 'scene-4-p1-props');
  await page.locator('.scene-inventory-access button').first().dispatchEvent('click');
  const card = page.getByRole('region', { name: 'Selected Knife' });
  await card.waitFor();
  await page.waitForFunction(() => document.querySelector('.table-presentation-canvas')?.dataset.presentationSelection === 'true');
  const cardBox = await card.boundingBox(); assert.equal(cardBox.width, 480); assert.equal(Math.round(756 - cardBox.y - cardBox.height), 96);
  assert.equal(await card.locator('h2').evaluate(element => getComputedStyle(element).fontSize), '34px');
  await page.screenshot({ path: fileURLToPath(new URL('scene-item-card-desktop.png', output)) });
  await card.getByRole('button', { name: 'USE', exact: true }).click();
  await page.locator('.scene-aim-prompt').waitFor();
  await page.screenshot({ path: fileURLToPath(new URL('scene-aim-desktop.png', output)) });
  await page.mouse.click(672, 430);
  assert.equal(await page.locator('.table-presentation-canvas').getAttribute('data-presentation-intent'), 'EMPTY');
  await page.locator('.scene-aim-prompt').waitFor({ state: 'detached' }); await card.waitFor();
  await card.getByRole('button', { name: 'USE', exact: true }).click();
  await page.locator('.seat-ribbon button').nth(1).click();
  assert.equal(await page.locator('select[name="instanceId"]').inputValue(), 'prop-0');
  assert.equal(await page.locator('select[name="targetId"]').inputValue(), 'p2');
  await page.waitForFunction(() => document.querySelector('.table-presentation-canvas')?.dataset.presentationFocus === 'down');
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('table-visual-settings', { detail: { grain: .06 } })));
  await page.waitForFunction(() => document.querySelector('.table-presentation-canvas')?.dataset.presentationGrain === '.06' || document.querySelector('.table-presentation-canvas')?.dataset.presentationGrain === '0.06');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.evaluate(() => window.captureFlight());
  await page.waitForFunction(() => document.querySelector('.table-presentation-canvas')?.dataset.presentationRoom === 'scene-loot-flight');
  await page.evaluate(() => window.openCapturedChest());
  await page.waitForFunction(() => document.querySelector('.table-presentation-canvas')?.dataset.presentationLoot === '1');
  await page.waitForTimeout(3100);
  await page.screenshot({ path: fileURLToPath(new URL('scene-chest-loot-flight-desktop.png', output)) });
  await page.waitForFunction(() => document.querySelector('.table-presentation-canvas')?.dataset.presentationLoot === '0');
  await page.screenshot({ path: fileURLToPath(new URL('scene-chest-loot-settled-desktop.png', output)) });
  assert.deepEqual(errors, []);
  console.log(`${captures.length + 6} desktop captures complete; contextual commands, item aim/cancel/target, chest loot flight, camera focus and live grain verified; no scene fallback or page errors.`);
} finally { await browser.close(); }
