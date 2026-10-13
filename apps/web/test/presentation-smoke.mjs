import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';

// Presentation-only browser harness: public projections and an adjacent command button.
const browser = await chromium.launch({ headless: true });
const errors = [];
async function mount(page, viewerId = 'p2') {
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(process.env.E2E_WEB_URL ?? 'http://127.0.0.1:5173');
  await page.evaluate(async viewerId => {
    const ReactModule = await import('/node_modules/.vite/deps/react.js');
    const React = ReactModule.default ?? ReactModule;
    const dom = await import('/node_modules/.vite/deps/react-dom_client.js');
    const { createRoot } = dom.default ?? dom;
    const { GameTableScene } = await import('/src/GameTableScene.tsx');
    const { ownerRoom } = await import('/src/test-fixtures.ts');
    const container = document.createElement('main'); container.style.cssText = 'max-width:900px;margin:auto;padding:16px';
    document.getElementById('root').replaceWith(container);
    const root = createRoot(container);
    const originalRaf = window.requestAnimationFrame.bind(window), originalCancel = window.cancelAnimationFrame.bind(window);
    window.pendingFrames = new Set();
    window.requestAnimationFrame = callback => { const id = originalRaf(time => { window.pendingFrames.delete(id); callback(time); }); window.pendingFrames.add(id); return id; };
    window.cancelAnimationFrame = id => { window.pendingFrames.delete(id); originalCancel(id); };
    window.projection = ownerRoom().public;
    const startedAt = Number(sessionStorage.getItem('presentation-smoke:start') ?? Date.now());
    sessionStorage.setItem('presentation-smoke:start', String(startedAt));
    window.projection.events = [{ id: 'start', sequence: 1, at: startedAt, kind: 'MATCH_STARTED', publicText: '', targetIds: [] }];
    window.commands = 0; window.beats = [];
    window.drawTable = () => root.render(React.createElement(React.Fragment, null,
      React.createElement(GameTableScene, { room: window.projection, viewerId, onArrivalBeat: beat => window.beats.push(beat) }),
      React.createElement('button', { type: 'button', onClick: () => { window.commands++; }, style: { minHeight: '56px' } }, 'Submit command')));
    window.addPublicEvent = (kind, change = {}) => {
      const previous = window.projection;
      window.projection = { ...previous, ...change, revision: previous.revision + 1,
        events: [...previous.events, { id: `event-${previous.revision}`, sequence: previous.events.length + 1, at: Date.now(), kind, actorId: 'p1', targetIds: ['p2'], publicText: '' }] };
      window.drawTable();
    };
    window.unmountTable = () => root.unmount();
    window.rematch = () => {
      const at = Date.now(); sessionStorage.setItem('presentation-smoke:start', String(at));
      window.projection = { ...window.projection, revision: window.projection.revision + 1, events: [{ id: 'start', sequence: 1, at, kind: 'MATCH_STARTED', publicText: '', targetIds: [] }] };
      window.drawTable();
    };
    window.drawTable();
  }, viewerId);
  await page.locator('.table-presentation canvas').waitFor();
  await page.waitForFunction(() => document.querySelector('.table-presentation-canvas')?.dataset.presentationEffects !== undefined);
}
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await mount(page);
  await page.waitForFunction(() => { const phase = document.querySelector('.table-presentation-canvas')?.dataset.presentationIntro; return phase && phase !== 'none'; });
  assert.equal(await page.getByRole('button', { name: 'Skip Intro' }).count(), 0);
  assert.equal(await page.evaluate(() => localStorage.getItem('the-table:arrival-seen:v1')), null);
  await page.evaluate(() => { window.originalCanvas = document.querySelector('.table-presentation canvas'); });
  await page.getByRole('button', { name: 'Submit command' }).click();
  assert.equal(await page.evaluate(() => window.commands), 1);
  await page.evaluate(() => window.addPublicEvent('HEALED'));
  await page.waitForFunction(() => document.querySelector('.table-presentation-canvas')?.dataset.presentationEffects === '1');
  assert.equal(await page.evaluate(() => document.querySelector('.table-presentation canvas') === window.originalCanvas), true);
  assert.equal(await page.locator('.table-presentation-canvas').getAttribute('data-presentation-effects'), '1');
  await page.screenshot({ path: '/tmp/table-arrival-approach.png' });
  await page.waitForFunction(() => document.querySelector('.table-presentation-canvas')?.dataset.presentationIntro === 'chair');
  await page.waitForTimeout(400); // Inspect the chair once its pull has visibly begun.
  await page.screenshot({ path: '/tmp/table-arrival-chair.png' });
  await page.waitForFunction(() => document.querySelector('.table-presentation-canvas')?.dataset.presentationIntro === 'none', null, { timeout: 14000 });
  assert.equal(await page.evaluate(() => localStorage.getItem('the-table:arrival-seen:v1')), '1');
  assert.deepEqual(await page.evaluate(() => window.beats), ['footstep', 'footstep', 'footstep', 'footstep', 'footstep', 'footstep', 'footstep', 'chair-scrape', 'footstep', 'footstep', 'chair-settle']);
  await page.screenshot({ path: '/tmp/table-presentation-overview.png' });
  await page.evaluate(() => window.rematch());
  await page.getByRole('button', { name: 'Skip Intro' }).click();
  await page.locator('.table-arrival').waitFor({ state: 'detached' });
  await page.evaluate(() => { window.originalCanvas = document.querySelector('.table-presentation canvas'); });
  await page.evaluate(() => window.addPublicEvent('CHEST_OPENED', { chests: [{ kind: 'STANDARD', availability: 'OPENED' }] }));
  assert.equal(await page.evaluate(() => document.querySelector('.table-presentation canvas') === window.originalCanvas), true);
  await page.evaluate(() => window.addPublicEvent('INTERMISSION', { round: { number: 2, phase: 'INTERMISSION', seatsOwedTurn: [] }, turn: undefined, shop: { id: 'presentation-intermission', phase: 'PREP', prepDeadlineAt: Date.now() + 15000, privateUnlockedBy: {}, finishedBy: {}, publicOffers: [{ id: 'public', itemId: 'black-key', price: 7 }], order: ['p1', 'p2'], activeShopperIndex: 0, publicPurchasedBy: {}, publicSkippedBy: {} } }));
  await page.screenshot({ path: '/tmp/table-presentation-shop.png' });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForFunction(() => window.pendingFrames.size === 0);
  await page.evaluate(() => window.addPublicEvent('DAMAGE'));
  await page.waitForFunction(() => document.querySelector('.table-presentation-canvas')?.dataset.presentationEffects === '0');
  assert.equal(await page.locator('.table-presentation-canvas').getAttribute('data-presentation-effects'), '0');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: '/tmp/table-presentation-phone.png' });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 390);
  await page.evaluate(() => window.unmountTable());
  assert.equal(await page.locator('.table-presentation canvas').count(), 0);
  assert.equal(await page.evaluate(() => window.pendingFrames.size), 0);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await mount(page);
  assert.equal(await page.getByRole('button', { name: 'Skip Intro' }).count(), 0); // persisted across reload
  await page.evaluate(() => {
    const canvas = document.querySelector('.table-presentation canvas');
    const context = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
    context.getExtension('WEBGL_lose_context').loseContext();
  });
  await page.getByRole('status').filter({ hasText: 'The table view is unavailable' }).waitFor();
  // Replacing the production root does not unmount its ambient landing-page
  // backdrop, so one unrelated RAF can remain. The failed table owns none.
  assert.equal(await page.evaluate(() => window.pendingFrames.size <= 1), true);
  await page.getByRole('button', { name: 'Submit command' }).click();
  assert.equal(await page.evaluate(() => window.commands), 1);
  await page.close();

  const skip = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await skip.addInitScript(() => localStorage.setItem('the-table:arrival-seen:v1', '1'));
  await mount(skip, 'p1');
  await skip.getByRole('button', { name: 'Skip Intro' }).click();
  await skip.getByRole('button', { name: 'Skip Intro' }).waitFor({ state: 'detached' });
  assert.equal(await skip.evaluate(() => localStorage.getItem('the-table:arrival-seen:v1')), '1');
  assert.equal(await skip.evaluate(() => document.documentElement.scrollWidth), 390);
  await skip.close();

  const reduced = await browser.newPage({ reducedMotion: 'reduce' });
  await mount(reduced);
  assert.equal(await reduced.getByRole('button', { name: 'Skip Intro' }).count(), 0);
  assert.equal(await reduced.evaluate(() => window.pendingFrames.size), 0);
  await reduced.close();
  const spectator = await browser.newPage();
  await mount(spectator, null);
  assert.equal(await spectator.getByRole('button', { name: 'Skip Intro' }).count(), 0);
  await spectator.evaluate(() => {
    window.addPublicEvent('DEATH', { players: window.projection.players.map(player => player.id === 'p2' ? { ...player, life: 'DEAD' } : player) });
  });
  await spectator.waitForFunction(() => document.querySelector('.table-presentation-canvas')?.dataset.presentationEffects === '1');
  await spectator.waitForFunction(() => document.querySelector('.table-presentation-canvas')?.dataset.presentationEffects === '0');
  await spectator.evaluate(() => window.addPublicEvent('EXIT', { players: window.projection.players.map(player => player.id === 'p1' ? { ...player, life: 'EXITED' } : player) }));
  await spectator.waitForFunction(() => document.querySelector('.table-presentation-canvas')?.dataset.presentationEffects === '1');
  await spectator.evaluate(() => window.unmountTable());
  assert.equal(await spectator.evaluate(() => window.pendingFrames.size <= 1), true);
  await spectator.close();
  assert.deepEqual(errors, []);
  console.log('Presentation smoke passed: arrival cadence, live command, incremental updates, clips, skip, persisted policy, phone, reduced motion, context-loss fallback, teardown; zero browser errors.');
} finally { await browser.close(); }
