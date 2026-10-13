import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { register } from 'tsx/esm/api';
import { chromium } from '@playwright/test';

// Full MatchView, real pointer hit-testing, canonical owner projection and engine commits.
// Run against the development web server; no historical beta/export artifacts are written.
register();
const { startMatch, applyCommand, applyTimeout, getNextDeadline } = await import('../../../packages/game/src/engine.ts');
const { beginIntermission } = await import('../../../packages/game/src/economy.ts');
const { stack, syncEquipment } = await import('../../../packages/game/src/inventory.ts');
const { projectAuthorizedRoom } = await import('../../../packages/game/src/room.ts');
const screenshotPath = name => fileURLToPath(new URL(`../../../audit/screenshots/v14-${name}.png`, import.meta.url));
let state, serial = 0;
const snapshot = () => ({ state, other: projectAuthorizedRoom(state, 'p2'), view: { ...projectAuthorizedRoom(state, 'p1'), viewerPlayerId: 'p1', messages: [] } });
function setupState(mode) {
  serial++;
  const now = Date.now();
  state = startMatch({ id: `v14-controls-${serial}`, code: 'ABC234', status: 'LOBBY', revision: 1, hostPlayerId: 'p1', createdAt: now, updatedAt: now,
    players: ['Ada', 'Bruno', 'Cora'].map((name, index) => ({ id: `p${index + 1}`, seat: index, name, normalizedName: name.toLowerCase(), connection: 'CONNECTED', roleId: ['locksmith', 'medic', 'smuggler'][index], ready: true, hp: 5, score: 0, life: 'ACTIVE', inventory: { visible: Array(6).fill(null), pockets: [{ source: 'DEFAULT', protectedBySafe: false, item: null }], coins: 0 } })),
  }, { seed: 77, now });
  for (const player of state.players) state = applyCommand(state, player.id, { type: 'LOCK_SETUP', instanceId: player.inventory.visible[2].instanceId }, now);
  state.round.number = 2;
  state.events = []; // Skip only the opening presentation, never command validation.
  state.players.forEach((player, index) => {
    player.objective = { objectiveId: ['arsenal', 'collector', 'tycoon'][index], status: 'ACTIVE', progress: {}, rewardGranted: false };
    player.inventory.visible = Array(6).fill(null);
    player.inventory.pockets = [{ source: 'DEFAULT', protectedBySafe: false, item: null }];
    player.safeAssignments = {};
  });
  const owner = state.players[0];
  owner.inventory.visible[0] = stack(state, mode === 'knife' ? 'knife' : 'key');
  if (mode.endsWith('two')) owner.inventory.visible[1] = stack(state, 'bag');
  syncEquipment(state, owner, now);
  if (mode.startsWith('pocket')) {
    beginIntermission(state, now);
    delete state.shop.orderReveal;
  } else {
    state.turn.activeSeat = 0;
    state.turn.deadlineAt = now + 60_000;
  }
  return snapshot();
}
const browser = await chromium.launch({ headless: true });
let testPage;
try {
  const page = await browser.newPage({ viewport: { width: 1344, height: 756 }, reducedMotion: 'reduce' });
  testPage = page;
  page.setDefaultTimeout(12_000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.exposeFunction('createControlState', setupState);
  await page.exposeFunction('commitControlCommand', command => {
    try {
      const at = Date.now();
      while (getNextDeadline(state) !== undefined && getNextDeadline(state) <= at) state = applyTimeout(state, at);
      state = applyCommand(state, 'p1', command, at);
      return { ok: true, data: { revision: state.revision }, snapshot: snapshot() };
    } catch (error) { return { ok: false, error: { code: error.code, message: error.message } }; }
  });
  await page.goto(process.env.E2E_WEB_URL ?? 'http://localhost:5173');
  await page.evaluate(async () => {
    const React = (await import('/node_modules/.vite/deps/react.js')).default;
    const dom = await import('/node_modules/.vite/deps/react-dom_client.js');
    const { MatchView } = await import('/src/MatchView.tsx');
    const mount = document.createElement('main');
    mount.className = 'app-shell'; document.getElementById('root').replaceWith(mount);
    const root = (dom.default ?? dom).createRoot(mount);
    let serial = 0;
    window.setupItemControls = async mode => {
      serial++;
      let fixture = await window.createControlState(mode);
      const render = () => root.render(React.createElement(MatchView, { key: serial, room: fixture.view, client, connected: true, viewerId: 'p1', voice: { enabled: false, iceServers: [], relayConfigured: false }, onView: render }));
      const client = {
        command: async ({ type, payload }) => {
          const command = { type, ...payload }; window.controlCommands.push(command);
          const response = await window.commitControlCommand(command);
          if (response.ok) { fixture = response.snapshot; window.controlState = fixture.state; render(); }
          else window.controlError = response.error.message;
          return response;
        },
        sync: async () => ({ ok: true, data: { view: fixture.view } }),
      };
      window.controlState = fixture.state; window.controlCommands = []; window.controlError = undefined;
      window.controlItemId = fixture.state.players[0].inventory.visible[0].instanceId;
      window.otherControlView = () => fixture.other;
      render();
    };
  });

  async function pointer(locator) {
    await locator.waitFor({ state: 'visible' });
    assert.equal(await locator.isEnabled(), true, `enabled: ${await locator.textContent()}`);
    await locator.scrollIntoViewIfNeeded();
    const dockUse = (await locator.getAttribute('aria-label'))?.includes('Use item');
    if (dockUse) {
      await page.mouse.move(1, 1);
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      await page.screenshot({ path: screenshotPath(`dock-normal-${page.viewportSize().width}`) });
    }
    const initial = await locator.boundingBox();
    await page.mouse.move(initial.x + initial.width / 2, initial.y + initial.height / 2);
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const hit = await locator.evaluate(element => {
      const box = element.getBoundingClientRect(), x = box.x + box.width / 2, y = box.y + box.height / 2;
      const top = document.elementFromPoint(x, y);
      return { x, y, hit: element.contains(top), top: top?.outerHTML.slice(0, 300), inside: x >= 0 && y >= 0 && x < innerWidth && y < innerHeight };
    });
    if (dockUse) {
      const before = { x: initial.x + initial.width / 2, y: initial.y + initial.height / 2 };
      console.log('Use item hover geometry', { before, after: hit });
      await page.screenshot({ path: screenshotPath(`dock-hover-${page.viewportSize().width}`) });
      assert.ok(Math.abs(before.x - hit.x) < 2 && Math.abs(before.y - hit.y) < 2, 'Use item stays in place when the pointer approaches');
      await assertDockHitTargets();
    }
    assert.ok(hit.hit && hit.inside, `unobscured pointer target: ${await locator.textContent()} ${JSON.stringify(hit)}`);
    await page.mouse.move(hit.x, hit.y); await page.mouse.down(); await page.mouse.up();
  }
  async function assertDockHitTargets() {
    const hits = await page.locator('.action-dock .action-buttons button, .action-dock .contextual-actions button, .action-dock .action-mode-strip button').evaluateAll(buttons => buttons.map(element => {
      const box = element.getBoundingClientRect(), x = box.x + box.width / 2, y = box.y + box.height / 2;
      return { label: element.textContent, hit: element.contains(document.elementFromPoint(x, y)), inside: box.left >= 0 && box.top >= 0 && box.right <= innerWidth && box.bottom <= innerHeight, visible: getComputedStyle(element).visibility === 'visible' && box.width > 0 && box.height > 0 };
    }));
    assert.equal(hits.length, 7, 'fixture exposes three primary, two contextual and two Threat mode controls');
    assert.ok(hits.every(item => item.hit && item.inside && item.visible), `all primary, contextual and Threat mode centers remain accessible: ${JSON.stringify(hits)}`);
  }
  async function revealContextualTray() {
    const use = page.locator('.action-dock').getByRole('button', { name: /Use item/i });
    await use.waitFor({ state: 'visible' });
    const box = await use.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await assertDockHitTargets();
    const centers = () => page.locator('.action-dock .action-buttons button, .action-dock .contextual-actions button').evaluateAll(buttons => buttons.map(element => {
      const box = element.getBoundingClientRect(); return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    }));
    const before = await centers();
    const threat = await page.locator('.action-buttons button.threat').boundingBox();
    await page.mouse.move(threat.x + threat.width / 2, threat.y + threat.height / 2);
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    assert.deepEqual(await centers(), before, 'hovering Threat does not move primary or contextual controls');
    await assertDockHitTargets();
  }
  async function setup(mode) {
    await page.evaluate(mode => window.setupItemControls(mode), mode);
    await page.waitForFunction(() => document.querySelector('.table-presentation-canvas')?.dataset.presentationRoom === window.controlState.id);
    await page.locator('.table-presentation-canvas canvas').waitFor();
    await page.waitForFunction(() => document.querySelector('.table-presentation-canvas')?.dataset.presentationIntro === 'none');
    assert.equal(await page.locator('.scene-fallback').count(), 0);
  }
  async function inspect(name) {
    await pointer(page.locator('.scene-inventory-access summary'));
    await pointer(page.locator('.scene-inventory-access').getByRole('button', { name: `${name} Inspect`, exact: true }));
    return page.getByRole('region', { name: `Selected ${name}`, exact: true });
  }
  async function assertCommitted(kind) {
    await page.waitForFunction(kind => window.controlState.events.some(event => event.kind === kind), kind);
    assert.equal(await page.evaluate(() => window.controlError), undefined);
    assert.equal(await page.evaluate(() => window.controlCommands.length), 1, 'one pointer action produces one command');
  }

  for (const [width, height] of [[1344, 756], [880, 495]]) {
    await page.setViewportSize({ width, height });
    await setup('key');
    const key = await inspect('Key');
    await pointer(key.getByRole('button', { name: 'USE', exact: true }));
    await pointer(page.getByRole('dialog', { name: 'Standard Chest', exact: true }).getByRole('button', { name: 'YES, OPEN', exact: true }));
    await assertCommitted('CHEST_OPENED');
    assert.equal(await page.evaluate(() => window.controlState.chests.find(chest => chest.kind === 'STANDARD').availability), 'OPENED');
    assert.equal(await page.evaluate(() => window.controlState.players[0].inventory.visible.some(item => item?.instanceId === window.controlItemId)), false, 'the used Key is consumed even if chest loot includes a fresh Key');

    await setup('knife');
    const knife = await inspect('Knife');
    await pointer(knife.getByRole('button', { name: 'USE', exact: true }));
    await page.locator('.scene-aim-prompt').filter({ hasText: 'CHOOSE AN ADJACENT PLAYER TO STAB' }).waitFor();
    // Exercise the physical card hit target, then complete through its accessible action equivalent.
    await pointer(knife.getByRole('button', { name: 'PUT DOWN', exact: true }));
    await pointer(knife.getByRole('button', { name: 'PUT DOWN', exact: true }));
    await pointer(page.locator('.action-dock').getByRole('button', { name: /Use item/i }));
    const use = page.getByRole('form', { name: 'Use item', exact: true });
    await pointer(use.getByRole('button', { name: 'Knife', exact: true }));
    await pointer(use.getByRole('button', { name: 'Bruno Active', exact: true }));
    await pointer(use.getByRole('button', { name: 'Use Knife', exact: true }));
    await page.waitForFunction(() => window.controlState.players[1].hp === 3);
    assert.equal(await page.evaluate(() => window.controlState.turn.primaryUsed), true);
    assert.equal(await page.evaluate(() => window.controlCommands.length), 1);
    assert.equal(await page.evaluate(() => window.controlCommands[0].targetId), 'p2');
    assert.equal(await page.evaluate(() => window.controlState.players[0].inventory.visible.some(item => item?.itemId === 'knife')), false);
    assert.equal(await page.evaluate(() => window.controlError), undefined);

    // Also verify Playwright's ordinary locator action reaches the intended form without a harness retry.
    await setup('knife');
    await page.mouse.move(1, 1);
    await page.locator('.action-dock').getByRole('button', { name: /Use item/i }).click();
    await page.getByRole('form', { name: 'Use item', exact: true }).waitFor();
    console.log(`Ordinary Use item locator.click reached its form on the first call at ${width}×${height}.`);

    await setup('knife');
    await revealContextualTray();
    await pointer(page.locator('.contextual-actions').getByRole('button', { name: 'Inspect chest', exact: true }));
    await page.getByRole('heading', { name: 'Chests', exact: true }).waitFor();
    assert.equal(await page.evaluate(() => window.controlCommands.length), 0, 'opening Inspect chest is local navigation');
    assert.equal(await page.locator('.contextual-actions').isVisible(), false, 'contextual tray stays hidden behind a modal');

    await setup('knife');
    await revealContextualTray();
    await pointer(page.locator('.contextual-actions').getByRole('button', { name: 'Pass turn', exact: true }));
    await assertCommitted('TURN_ENDED');
    assert.equal(await page.evaluate(() => window.controlCommands[0].type), 'END_TURN');
    assert.equal(await page.evaluate(() => window.controlState.turn.activeSeat), 1, 'Pass turn advances the real engine to Bruno');

    for (const count of ['one', 'two']) {
      await setup(`pocket-${count}`);
      await pointer(page.getByRole('navigation', { name: 'Market navigation' }).getByRole('button', { name: 'Pockets', exact: true }));
      const pockets = page.getByRole('form', { name: 'Manage Pockets', exact: true });
      await pointer(pockets.getByRole('button', { name: 'Key', exact: true }));
      if (width === 880) await page.screenshot({ path: screenshotPath(`pocket-${count}-before-880`) });
      await pointer(pockets.getByRole('button', { name: 'PLACE IN POCKET', exact: true }));
      if (count === 'two') {
        await pockets.locator('.pocket-destination-prompt').filter({ hasText: 'CHOOSE A POCKET' }).waitFor();
        assert.equal(await page.evaluate(() => window.controlCommands.length), 0, 'two destinations wait for an explicit choice');
        assert.match(await pockets.locator('.pocket-destination-prompt').innerText(), /Selected: KEY/);
        if (width === 880) await page.screenshot({ path: screenshotPath('pocket-two-destinations-880') });
        await pointer(pockets.locator('.reference-pocket-row').getByRole('button', { name: /POCKET 2.*EMPTY.*CHOOSE/ }));
      }
      await assertCommitted('POCKET_FILLED');
      const expectedPocket = count === 'two' ? 1 : 0;
      assert.equal(await page.evaluate(index => window.controlState.players[0].inventory.pockets[index].item?.itemId, expectedPocket), 'key');
      assert.equal(await page.evaluate(() => window.controlState.players[0].inventory.visible.some(item => item?.itemId === 'key')), false);
      assert.equal(await page.evaluate(() => window.controlCommands[0].pocketIndex), expectedPocket);
      await page.locator('.action-feedback').filter({ hasText: `Key moved to Pocket ${expectedPocket + 1}.` }).waitFor();
      const publicOwner = await page.evaluate(() => window.otherControlView().public.players.find(player => player.id === 'p1'));
      assert.equal(publicOwner.pocketOccupancy[expectedPocket], true);
      assert.equal('pockets' in publicOwner, false, 'opponents receive occupancy only');
      const event = await page.evaluate(() => window.otherControlView().public.events.find(event => event.kind === 'POCKET_FILLED'));
      assert.ok(event, 'the public Pocket occupancy event exists');
      assert.equal('privatePayloads' in event, false);
      assert.equal('privatePayload' in event, false);
      assert.doesNotMatch(JSON.stringify(event), /"(?:itemId|pocketIndex)"/, 'opponents receive no private item/destination payload');
    }
  }
  assert.deepEqual(errors, []);
  console.log('v14 full-MatchView real-pointer Key/Knife, Inspect chest, Pass turn and one/two-destination Pocket flows passed at 1344×756 and 880×495; all primary/contextual hit targets, canonical engine commits and opponent Pocket privacy verified.');
} catch (error) {
  console.error(await testPage?.evaluate(() => ({ body: document.body.innerText, commands: window.controlCommands, error: window.controlError })));
  await testPage?.screenshot({ path: '/tmp/v14-item-controls-failure.png' });
  throw error;
} finally { await browser.close(); }
