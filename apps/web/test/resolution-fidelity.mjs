import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';

const browser = await chromium.launch({ headless: true });
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, reducedMotion: 'reduce' });
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => localStorage.setItem('the-table:arrival-seen:v1', '1'));
  await page.goto(process.env.E2E_WEB_URL ?? 'http://localhost:5173');
  await page.evaluate(async () => {
    const ReactModule = await import('/node_modules/.vite/deps/react.js');
    const React = ReactModule.default ?? ReactModule;
    const dom = await import('/node_modules/.vite/deps/react-dom_client.js');
    const { MatchView } = await import('/src/MatchView.tsx');
    const { ownerRoom, spectatorRoom } = await import('/src/test-fixtures.ts');
    const container = document.createElement('main'); container.className = 'app-shell';
    document.getElementById('root').replaceWith(container);
    const root = (dom.default ?? dom).createRoot(container);
    const owner = ownerRoom(); owner.private.inspections = [];
    owner.public.events = [{ id: 'start', sequence: 1, at: 1000, kind: 'MATCH_STARTED', targetIds: [], publicText: 'The table is seated.' }];
    window.commands = [];
    const client = { command: async command => { window.commands.push(command); return { ok: true, data: { revision: 8 } }; }, onVoicePeers: () => () => {}, onVoiceSignal: () => () => {}, leaveVoice: async () => ({ ok: true, data: {} }) };
    const render = room => root.render(React.createElement(MatchView, { room, client, connected: true, viewerId: 'p1', voice: { enabled: false, iceServers: [], relayConfigured: false }, onView: () => {} }));
    window.revealInspection = () => {
      const room = structuredClone(owner);
      room.public.events.push({ id: 'inspect', sequence: 2, at: 2000, kind: 'POCKET_INSPECTED', actorId: 'p1', targetIds: ['p2'], publicText: 'Ada inspected a Pocket.' });
      room.private.inspections = [{ eventId: 'inspect', payload: { targetId: 'p2', pocketIndex: 0, item: { itemId: 'knife', quantity: 1 } } }];
      render(room);
    };
    window.exitTable = () => {
      const room = spectatorRoom();
      room.public.players[0].life = 'EXITED'; room.public.players[0].exitOrder = 2; room.public.players[0].score = 75;
      room.public.events = [...owner.public.events, { id: 'exit', sequence: 3, at: 3000, kind: 'EXIT', actorId: 'p1', targetIds: [], publicText: 'Ada left the table.' }];
      render(room);
    };
    window.showResults = () => {
      const room = structuredClone(owner); room.public.status = 'RESULTS';
      room.public.events.push({ id: 'end', sequence: 2, at: 126000, kind: 'MATCH_ENDED', targetIds: [], publicText: 'The match has ended.' });
      render(room);
    };
    render(owner);
  });
  await page.locator('.table-presentation-canvas').waitFor();
  await page.evaluate(() => document.fonts.ready);
  assert.equal(await page.locator('.scene-private-inspection').count(), 0, 'Existing state must not replay a private reveal');
  await page.evaluate(() => window.revealInspection());
  await page.getByRole('status').filter({ hasText: 'BRUNO’S POCKET 1 · KNIFE' }).waitFor();
  const disclosure = await page.locator('.scene-inspection-reveal').evaluate(node => {
    const css = getComputedStyle(node); return { bottom: css.bottom, padding: css.padding, border: css.borderWidth, titleSize: getComputedStyle(node.children[0]).fontSize, textSize: getComputedStyle(node.children[1]).fontSize };
  });
  assert.deepEqual(disclosure, { bottom: '120px', padding: '8px 18px', border: '2px', titleSize: '18px', textSize: '30px' });
  await page.screenshot({ path: 'audit/screenshots/desktop-spyglass-resolution.png' });
  await page.evaluate(() => window.exitTable());
  await page.getByRole('dialog', { name: 'You left the table' }).waitFor();
  assert.equal(await page.locator('.scene-private-inspection').count(), 0, 'Private reveal must disappear immediately on spectator transition');
  const exit = await page.locator('.scene-exit-confirmation').evaluate(node => ({ background: getComputedStyle(node).backgroundColor, titleSize: getComputedStyle(node.querySelector('strong')).fontSize, detailSize: getComputedStyle(node.querySelector('small')).fontSize }));
  assert.deepEqual(exit, { background: 'rgba(0, 0, 0, 0.88)', titleSize: '72px', detailSize: '24px' });
  assert.equal(await page.locator('.match-overlay-backdrop').isVisible(), false, 'Successful exit should show over the table before the spectator cards');
  await page.screenshot({ path: 'audit/screenshots/desktop-exit-confirmation-resolution-verified.png' });
  await page.getByRole('button', { name: 'Return to the table as a spectator' }).click();
  assert.equal(await page.locator('.scene-exit-confirmation').count(), 0);
  await page.locator('.match-overlay-backdrop').waitFor({ state: 'visible' });
  assert.deepEqual(await page.evaluate(() => window.commands), [], 'Exit confirmation dismissal must never send gameplay commands');
  await page.evaluate(() => window.showResults());
  await page.getByRole('heading', { name: 'The table empties' }).waitFor();
  assert.match(await page.locator('.reference-results header').innerText(), /2:05/);
  await page.screenshot({ path: 'audit/screenshots/desktop-results-duration-resolution.png' });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 1280);
  assert.equal(await page.evaluate(() => document.documentElement.scrollHeight), 720);
  assert.deepEqual(errors, []);
  console.log('Desktop resolution fidelity passed: source dimensions, private boundary, exit dismissal, duration, no scroll, 3 captures.');
} finally { await browser.close(); }
