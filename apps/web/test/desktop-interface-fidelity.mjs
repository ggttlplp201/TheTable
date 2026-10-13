import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

// Production components with deterministic, authorized projections; no alternate UI.
const directory = 'audit/screenshots';
await mkdir(directory, { recursive: true });
const browser = await chromium.launch({ headless: true });
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 880, height: 495 }, reducedMotion: 'reduce' });
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => { Date.now = () => 1791360000000; localStorage.setItem('the-table:arrival-seen:v1', '1'); });
  await page.goto(process.env.E2E_WEB_URL ?? 'http://localhost:5173');
  await page.evaluate(async () => {
    const ReactModule = await import('/node_modules/.vite/deps/react.js');
    const React = ReactModule.default ?? ReactModule;
    const dom = await import('/node_modules/.vite/deps/react-dom_client.js');
    const { MatchView } = await import('/src/MatchView.tsx');
    const { ownerRoom, spectatorRoom } = await import('/src/test-fixtures.ts');
    const { loadReferenceArt } = await import('/src/ReferenceItemArt.tsx');
    await loadReferenceArt();
    const container = document.createElement('main'); container.className = 'app-shell';
    document.getElementById('root').replaceWith(container);
    const root = (dom.default ?? dom).createRoot(container);
    window.commands = []; window.returnedHome = 0;
    const client = { command: async command => { window.commands.push(command); return { ok: true, data: { revision: 8 } }; }, sendChat: async () => ({ ok: true, data: { revision: 8 } }), onVoicePeers: () => () => {}, onVoiceSignal: () => () => {}, leaveVoice: async () => ({ ok: true, data: {} }) };
    window.preview = mode => {
      const room = mode === 'spectator' ? spectatorRoom() : ownerRoom();
      if (mode !== 'spectator') {
        room.private.capabilities = ['USE_ITEM', 'TRADE', 'THREAT', 'END_TURN', 'CHAT'];
        const mine = ['knife', 'medicine', 'bullet', 'antidote', 'cloth', 'pistol'];
        room.public.players[0].visibleInventory = mine.map((itemId, index) => ({ instanceId: `own-${index}`, itemId, quantity: 1 }));
        room.public.players[0].coins = 12;
        room.public.players[1].visibleInventory = ['poison', 'red-ledger', 'spyglass', 'key', 'armor', 'medicine'].map((itemId, index) => ({ instanceId: `other-${index}`, itemId, quantity: 1 }));
        room.public.players[1].coins = 9;
        room.public.turn.deadlineAt = Date.now() + 41000;
        room.public.events = [{ id: 'start', sequence: 1, at: Date.now() - 90000, kind: 'MATCH_STARTED', targetIds: [], publicText: 'The table is seated.' }];
        if (mode === 'trade-response') {
          room.private.capabilities = ['RESPOND_TRADE'];
          room.public.pendingTrade = { id: 'trade', actorId: 'p2', targetId: 'p1', offeredItems: ['other-2'], offeredCoins: 2, requestedItems: ['own-3'], requestedCoins: 0, status: 'PENDING', deadlineAt: Date.now() + 24000 };
        }
        if (mode === 'threat-response') {
          room.private.capabilities = ['RESPOND_THREAT'];
          room.public.pendingThreat = { id: 'threat', actorId: 'p2', targetId: 'p1', demandedItems: ['own-1'], demandedCoins: 3, mode: 'COVERED', status: 'PENDING', deadlineAt: Date.now() + 17000 };
        }
        if (mode === 'overflow') { room.private.capabilities = ['OVERFLOW_CHOICE']; room.private.overflows = [{ id: 'overflow', playerId: 'p1', incoming: { instanceId: 'new', itemId: 'spyglass', quantity: 1 }, deadlineAt: Date.now() + 11000 }]; }
        if (mode === 'fulfilled') { room.private.objective.status = 'EXIT_READY'; room.public.players[0].objectiveCompleted = true; room.private.capabilities = ['LEAVE_TABLE', 'STAY', 'END_TURN']; }
        if (mode === 'downed') { room.public.players[0].life = 'DOWNED'; room.public.players[0].hp = 0; room.public.events.push({ id: 'down', sequence: 2, at: Date.now(), kind: 'DOWNED', actorId: 'p2', targetIds: ['p1'], publicText: 'Alice is Downed.' }); room.private.capabilities = ['USE_ITEM', 'END_TURN']; }
        if (mode === 'results') { room.public.status = 'RESULTS'; room.public.players[0].life = 'EXITED'; room.public.players[0].exitOrder = 1; room.public.players[0].score = 100; room.private.objective.status = 'BANKED'; }
      }
      root.render(React.createElement(MatchView, { key: mode, room, client, connected: true, viewerId: 'p1', voice: { enabled: false, iceServers: [], relayConfigured: false }, onView: () => {}, onReturnHome: () => { window.returnedHome += 1; } }));
    };
    window.preview('turn');
  });
  await page.locator('.table-presentation-canvas').waitFor();
  await page.evaluate(() => document.fonts.ready);
  const capture = async name => {
    await page.locator('.reference-item-art').first().evaluateAll(images => Promise.all(images.map(image => image.decode().catch(() => {}))));
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await page.screenshot({ path: `${directory}/desktop-${name}-verified.png` });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 880, `${name}: horizontal page overflow`);
    assert.equal(await page.evaluate(() => document.documentElement.scrollHeight), 495, `${name}: vertical page overflow`);
  };
  for (const [panel, button] of [['contract', 'Contract'], ['trade-builder', 'Trade'], ['threat-builder', 'Threat'], ['social', 'Chat'], ['handbook', 'Handbook'], ['settings', 'Settings']]) {
    await page.evaluate(mode => window.preview(mode), `turn-${panel}`);
    await page.getByRole('button', { name: panel === 'trade-builder' ? /TRADE/i : panel === 'threat-builder' ? /THREAT/i : button, exact: !['trade-builder', 'threat-builder'].includes(panel) }).click();
    await page.locator('.reference-interface').waitFor();
    if (panel === 'threat-builder') await page.locator('.reference-interface').getByRole('button', { name: /Under cloth/i }).click();
    if (panel === 'settings') {
      const expectedInk = 'rgb(216, 204, 176)';
      const readableSelectors = [
        '.reference-text-size button:not(.selected)',
        '.reference-setting-toggle:not(.future-setting) > span:first-child',
        '.reference-mute',
      ];
      for (const selector of readableSelectors) {
        const colors = await page.locator(selector).evaluateAll(elements => elements.map(element => getComputedStyle(element).color));
        assert.ok(colors.length > 0, `settings: ${selector} must be present`);
        assert.ok(colors.every(color => color === expectedInk), `settings: ${selector} must use readable reference ink; got ${colors.join(', ')}`);
      }
    }
    await capture(panel);
  }
  for (const mode of ['trade-response', 'threat-response', 'overflow', 'downed', 'fulfilled', 'spectator', 'results']) {
    await page.evaluate(mode => window.preview(mode), mode);
    await page.waitForTimeout(80);
    if (mode === 'overflow') await page.getByRole('button', { name: 'Replace Cloth', exact: true }).click();
    await capture(mode);
    if (mode === 'fulfilled') { await page.getByRole('button', { name: 'Contract', exact: true }).click(); await capture('contract-fulfilled'); }
    if (mode === 'results') {
      await page.getByRole('button', { name: 'Return to Home', exact: true }).click();
      assert.equal(await page.evaluate(() => window.returnedHome), 1, 'results must expose a working return-home action');
    }
  }
  await page.evaluate(() => window.preview('turn-trade-command'));
  await page.getByRole('button', { name: /\[1\].*Trade/i }).click();
  await page.locator('.asset-tile:has(input[name="offeredItems"][value="own-0"])').click();
  await page.locator('input[name="offeredCoins"]').fill('3');
  await page.locator('.asset-tile:has(input[name="requestedItems"][value="other-2"])').click();
  await page.getByRole('button', { name: 'Propose Trade', exact: true }).click();
  const confirmation = page.getByText('Action confirmed.', { exact: true });
  await confirmation.waitFor({ state: 'visible' });
  const confirmationStyle = await confirmation.evaluate(node => {
    const panel = node.parentElement, box = panel.getBoundingClientRect();
    return { border: getComputedStyle(panel).borderWidth, background: getComputedStyle(panel).backgroundColor, center: Math.round(box.left + box.width / 2), viewportCenter: Math.round(innerWidth / 2) };
  });
  assert.deepEqual(confirmationStyle, { border: '0px', background: 'rgba(0, 0, 0, 0)', center: 440, viewportCenter: 440 });
  await confirmation.waitFor({ state: 'hidden', timeout: 4000 });
  let sent = await page.evaluate(() => window.commands);
  assert.equal(sent.at(-1).type, 'TRADE');
  assert.deepEqual(sent.at(-1).payload, { targetId: 'p2', offeredItems: ['own-0'], offeredCoins: 3, requestedItems: ['other-2'], requestedCoins: 0 });
  await page.evaluate(() => window.preview('turn-threat-command'));
  await page.getByRole('button', { name: /\[2\].*Threaten/i }).click();
  await page.locator('.reference-interface').getByRole('button', { name: /Under cloth/i }).click();
  await page.getByRole('button', { name: 'Pistol', exact: true }).click();
  await page.locator('input[name="demandedCoins"]').fill('2');
  await page.getByRole('button', { name: 'Make Threat', exact: true }).click();
  sent = await page.evaluate(() => window.commands);
  assert.deepEqual(sent.at(-1).payload, { targetId: 'p2', mode: 'COVERED', committedItemId: 'own-5', clothItemId: 'own-4', demandedItems: [], demandedCoins: 2 });
  const beforeOverflow = sent.length;
  await page.evaluate(() => window.preview('overflow'));
  await page.getByRole('button', { name: 'Replace Cloth', exact: true }).click();
  assert.equal((await page.evaluate(() => window.commands)).length, beforeOverflow, 'Selecting overflow replacement must not submit');
  await page.getByRole('button', { name: 'REPLACE CLOTH', exact: true }).click();
  sent = await page.evaluate(() => window.commands);
  assert.deepEqual(sent.at(-1).payload, { overflowId: 'overflow', replaceInstanceId: 'own-4' });
  assert.deepEqual(errors, []);
  console.log('PASS: 14 production desktop reference compositions at 880×495; no overflow/browser errors; live Trade/covered Threat payloads and select-then-confirm Overflow verified.');
} finally { await browser.close(); }
