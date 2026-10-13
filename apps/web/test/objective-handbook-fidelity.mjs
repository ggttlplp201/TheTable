import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(process.env.E2E_WEB_URL ?? 'http://localhost:5173');
  await page.evaluate(async () => {
    const React = (await import('/node_modules/.vite/deps/react.js')).default;
    const dom = await import('/node_modules/.vite/deps/react-dom_client.js');
    const { MatchView } = await import('/src/MatchView.tsx');
    const { ReferenceHandbook } = await import('/src/ReferenceInterfaces.tsx');
    const { ownerRoom } = await import('/src/test-fixtures.ts');
    const mount = document.createElement('main'); mount.className = 'app-shell'; document.getElementById('root').replaceWith(mount);
    const root = (dom.default ?? dom).createRoot(mount);
    const epoch = Date.now(); let offset = 0; Date.now = () => epoch + offset;
    const room = ownerRoom(); room.public.events = [{ id: 'fresh-match', sequence: 1, at: epoch, kind: 'MATCH_STARTED', targetIds: [], publicText: 'The match begins.' }];
    const client = { command: async () => ({ ok: true, data: { revision: 8 } }), onVoicePeers: () => () => {}, onVoiceSignal: () => () => {}, leaveVoice: async () => ({ ok: true, data: {} }) };
    root.render(React.createElement(MatchView, { room, client, connected: true, viewerId: 'p1', voice: { enabled: false, iceServers: [], relayConfigured: false }, onView: () => {} }));
    window.finishObjective = () => { offset = 13000; };
    window.showHandbook = () => root.render(React.createElement('section', { className: 'match-overlay reference-interface neutral', 'data-panel': 'HANDBOOK' }, React.createElement('div', { className: 'match-overlay-body' }, React.createElement(ReferenceHandbook))));
  });
  await page.locator('.objective-introduction').waitFor();
  assert.match(await page.locator('.objective-introduction').innerText(), /YOUR OBJECTIVE/i);
  assert.match(await page.locator('.objective-introduction').innerText(), /CONTRACT · PRIVATE/);
  const objectiveContrast = await page.locator('.objective-introduction .reference-contract').evaluate(contract => ({
    background: getComputedStyle(contract).backgroundColor,
    contract: getComputedStyle(contract).color,
    title: getComputedStyle(contract.querySelector('.objective-name')).color,
    body: getComputedStyle(contract.querySelector('.objective-detail > p')).color,
  }));
  assert.deepEqual(objectiveContrast, { background: 'rgb(214, 201, 171)', contract: 'rgb(26, 20, 16)', title: 'rgb(26, 20, 16)', body: 'rgb(26, 20, 16)' });
  assert.equal(await page.locator('.action-dock').count(), 0);
  await page.screenshot({ path: 'audit/screenshots/objective-introduction-desktop.png' });
  await page.evaluate(() => window.finishObjective());
  await page.waitForFunction(() => !document.querySelector('.objective-introduction'));

  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.evaluate(() => window.showHandbook());
  await page.waitForFunction(() => document.querySelectorAll('.handbook-items canvas').length >= 20);
  await page.waitForTimeout(250);
  const sample = () => page.locator('.handbook-description canvas').evaluate(canvas => {
    const context = canvas.getContext('2d'); return Array.from(context.getImageData(0, 0, canvas.width, canvas.height).data).reduce((hash, value, index) => (hash + value * (index % 97 + 1)) % 2147483647, 0);
  });
  const first = await sample(); await page.waitForTimeout(700); const second = await sample();
  assert.notEqual(first, second, 'selected source item model should rotate');
  assert.equal(await page.locator('.handbook-items canvas').count(), 21);
  assert.equal(await page.locator('.reference-animated-item img').count(), 0, 'static art must not sit beneath the live model');
  assert.deepEqual(await page.locator('.reference-animated-item canvas').evaluateAll(canvases => canvases.map(canvas => {
    const context = canvas.getContext('2d');
    return context && context.getImageData(0, 0, canvas.width, canvas.height).data.some((value, index) => index % 4 === 3 && value > 0);
  })), Array(22).fill(true), 'every handbook item must have a visible animated model');
  await page.screenshot({ path: 'audit/screenshots/handbook-live-items-desktop.png' });
  await page.emulateMedia({ reducedMotion: 'reduce' }); await page.waitForTimeout(200);
  const frozen = await sample(); await page.waitForTimeout(500); assert.equal(await sample(), frozen, 'reduced motion should freeze the turntable');
  assert.deepEqual(errors, []);
  console.log('Objective introduction and shared live handbook turntables passed.');
} finally { await browser.close(); }
