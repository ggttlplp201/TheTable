import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';

// Exercise the actual camera-projected prompt and production contract at short/tall desktop sizes.
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 880, height: 495 }, reducedMotion: 'reduce' });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => { Date.now = () => 1791360000000; localStorage.setItem('the-table:arrival-seen:v1', '1'); });
  await page.goto(process.env.E2E_WEB_URL ?? 'http://localhost:5173');
  await page.evaluate(async () => {
    const React = (await import('/node_modules/.vite/deps/react.js')).default;
    const dom = await import('/node_modules/.vite/deps/react-dom_client.js');
    const { MatchView } = await import('/src/MatchView.tsx');
    const { ownerRoom } = await import('/src/test-fixtures.ts');
    const mount = document.createElement('main'); mount.className = 'app-shell';
    document.getElementById('root').replaceWith(mount);
    const root = (dom.default ?? dom).createRoot(mount);
    window.patch3Commands = [];
    const client = { command: async command => { window.patch3Commands.push(command); return { ok: true, data: { revision: 8 } }; }, onVoicePeers: () => () => {}, onVoiceSignal: () => () => {}, leaveVoice: async () => ({ ok: true, data: {} }) };
    window.renderPatch3 = (mode, size) => {
      const room = ownerRoom(); room.public.id = `patch3-${mode}-${size}`;
      room.public.events = [{ id: 'started', sequence: 1, at: Date.now() - 90000, kind: 'MATCH_STARTED', targetIds: [], publicText: 'The match began.' }];
      room.public.turn.deadlineAt = Date.now() + 41000;
      if (mode === 'exit' || mode === 'fulfilled') {
        room.private.capabilities = ['LEAVE_TABLE', 'STAY', 'END_TURN'];
        if (mode === 'fulfilled') { room.private.objective.status = 'EXIT_READY'; room.private.objective.firstReadyAt = 1000; room.public.players[0].objectiveCompleted = true; }
      }
      root.render(React.createElement(MatchView, { key: room.public.id, room, client, connected: true, viewerId: 'p1', voice: { enabled: false, iceServers: [], relayConfigured: false }, onView() {} }));
    };
  });
  const measurements = [];
  const doorModes = new Set();
  for (const [width, height] of [[880, 350], [880, 495], [1180, 600], [1344, 756], [1440, 900], [1920, 1400]]) {
    await page.setViewportSize({ width, height });
    await page.evaluate(height => window.renderPatch3('exit', height), height);
    await page.getByRole('button', { name: '⤴ LEAVE TABLE', exact: true }).waitFor({ state: 'visible' });
    await page.waitForFunction(() => document.querySelector('.table-presentation-canvas')?.dataset.presentationFocus === 'door');
    const door = await page.locator('.scene-exit-prompt').evaluate(prompt => {
      const frame = prompt.closest('.table-presentation'), rect = prompt.getBoundingClientRect(), frameRect = frame.getBoundingClientRect();
      const mode = frame.dataset.doorPrompt;
      const timer = document.querySelector('.match-hud-top').getBoundingClientRect();
      return { mode, centerX: rect.x + rect.width / 2, anchorX: frameRect.x + parseFloat(frame.style.getPropertyValue('--scene-door-x')), anchorY: frameRect.y + parseFloat(frame.style.getPropertyValue('--scene-door-y')), promptY: mode === 'inside' ? rect.y + rect.height / 2 : rect.bottom, top: rect.top, bottom: rect.bottom, pointer: getComputedStyle(prompt.querySelector('i')).display, timerCollision: rect.left < timer.right && rect.right > timer.left && rect.top < timer.bottom && rect.bottom > timer.top };
    });
    doorModes.add(door.mode);
    assert.ok(Math.abs(door.centerX - door.anchorX) < 1, JSON.stringify(door));
    assert.ok(Math.abs(door.promptY - door.anchorY) < 1, JSON.stringify(door));
    assert.ok(door.top >= 0 && door.bottom <= height, JSON.stringify(door));
    assert.equal(door.timerCollision, false, 'Door prompt must not collide with turn timer');
    assert.equal(door.pointer === 'none', door.mode === 'inside');
    if (height === 350) { measurements.push({ width, height, door: door.mode }); continue; }
    if (height === 756) await page.screenshot({ path: 'audit/screenshots/scene-exit-desktop.png' });
    await page.evaluate(height => window.renderPatch3('contract', height), height);
    await page.getByRole('button', { name: 'Contract', exact: true }).click();
    await page.evaluate(() => document.fonts.ready);
    const card = await page.locator('.reference-contract').evaluate(card => {
      const rect = card.getBoundingClientRect(), footer = card.querySelector('footer').getBoundingClientRect();
      return { top: rect.top, bottom: rect.bottom, footerBottom: footer.bottom, scrollHeight: card.scrollHeight, clientHeight: card.clientHeight, titleSize: getComputedStyle(card.querySelector('.objective-name')).fontSize, bodySize: getComputedStyle(card.querySelector('.objective-detail > p')).fontSize };
    });
    assert.ok(card.top >= 72 && card.bottom <= height, JSON.stringify(card));
    assert.ok(card.footerBottom <= height, JSON.stringify(card));
    assert.equal(card.scrollHeight, card.clientHeight, 'Normal contract should fit without scrolling');
    assert.equal(card.titleSize, height <= 640 ? '28px' : height <= 820 ? '32px' : '40px');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), width);
    if (height === 495) await page.screenshot({ path: 'audit/screenshots/desktop-contract-verified.png' });
    measurements.push({ width, height, door: door.mode, card });
  }
  assert.deepEqual([...doorModes].sort(), ['above', 'inside']);
  await page.setViewportSize({ width: 880, height: 495 });
  await page.evaluate(() => window.renderPatch3('fulfilled', 495));
  await page.locator('.reference-fulfilled-banner').waitFor();
  await page.getByRole('button', { name: '⤴ LEAVE TABLE', exact: true }).waitFor({ state: 'visible' });
  await page.screenshot({ path: 'audit/screenshots/desktop-fulfilled-verified.png' });
  await page.getByRole('button', { name: '⤴ LEAVE TABLE', exact: true }).click();
  await page.waitForFunction(() => window.patch3Commands.at(-1)?.type === 'LEAVE_TABLE');
  assert.deepEqual(errors, []);
  console.log(JSON.stringify(measurements, null, 2));
  console.log('PASS: door prompt stays anchored above/inside doorway with no timer collision; contract fits short/tall viewports; Leave Table still dispatches.');
} finally { await browser.close(); }
