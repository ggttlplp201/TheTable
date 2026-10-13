import type { BrowserContext, Page } from '@playwright/test';
import { test, expect } from './fixtures';
import { BROWSER_EPOCH } from '../../apps/server/test/browser-harness';
import { ORDER_REVEAL_DURATION, ROUND_INCOME_PRESENTATION_DURATION } from '../../apps/web/src/order-reveal';
import { chooseRoleAndReady, createRoom, desktopViewport, joinRoom, lockStartingPocket, waitForPlayableTable } from './helpers';
import { observeViews } from './browser-wire';

test('Round Income and private/public Wildcard decisions work through the production UI', async ({ browser, tableServer }) => {
  test.skip(!tableServer, 'State/clock controls are available only inside the isolated local test process.');
  test.setTimeout(300_000);
  // Only this isolated server widens heartbeat tolerance: this scenario steps
  // several minutes of game Date while WebSocket timers use real elapsed time.
  // Every command still requires a real, newer server snapshot on all clients.
  tableServer!.server.io.engine.opts.pingInterval = 250;
  tableServer!.server.io.engine.opts.pingTimeout = 600_000;
  const actors: Array<{ context: BrowserContext; page: Page; wire: ReturnType<typeof observeViews> }> = [];
  try {
    for (let index = 0; index < 4; index += 1) {
      const context = await browser.newContext({ viewport: desktopViewport });
      const page = await context.newPage(); await page.clock.install({ time: BROWSER_EPOCH });
      actors.push({ context, page, wire: observeViews(page) });
    }
    const admission = await createRoom(actors[0]!.page, 'Aster');
    for (let index = 1; index < 4; index += 1) await joinRoom(actors[index]!.page, admission.code, ['Aster', 'Bram', 'Cora', 'Dima'][index]!);
    for (const [index, actor] of actors.entries()) await chooseRoleAndReady(actor.page, ['Broker', 'Medic', 'Locksmith', 'Smuggler'][index]!);
    // Lobby loading consumes real browser time while the isolated server clock
    // stays paused. Start both clocks together before the 30s Pocket deadline.
    await Promise.all(actors.map(actor => actor.page.clock.setSystemTime(tableServer!.clock.now())));
    await actors[0]!.page.getByRole('button', { name: /^start match$/i }).click();
    for (const [index, actor] of actors.entries()) await lockStartingPocket(actor.page, ['Knife', 'Knife', 'Knife', 'Poison'][index]!);
    await Promise.all(actors.map(actor => actor.page.clock.fastForward(17_000)));
    await Promise.all(actors.map(actor => waitForPlayableTable(actor.page)));
    // Align Date after the introduction without advancing Socket.IO heartbeat
    // timers. Browser timers keep running while only the server clock is stepped.
    await tableServer!.clock.advanceTo(BROWSER_EPOCH + 60_000);
    const alignClocks = async () => Promise.all(actors.map(actor => actor.page.clock.setFixedTime(tableServer!.clock.now())));
    await alignClocks();
    const current = () => tableServer!.game.read(admission.code)!;
    const settle = async (revision: number) => {
      await Promise.all(actors.map(actor => actor.wire.revision(revision, 15_000)));
      await alignClocks();
    };
    const click = async (index: number, name: RegExp | string) => {
      const revision = current().revision;
      await actors[index]!.page.getByRole('button', { name, exact: typeof name === 'string' }).click();
      await settle(revision + 1);
    };
    const pass = async () => {
      const index = current().turn!.activeSeat;
      await actors[index]!.page.locator('.action-dock').hover();
      await click(index, /end turn|pass turn/i);
    };
    const startingCoins = current().players.map(player => player.inventory.coins);
    // Keep unrelated objective completion from ending this deterministic UI scenario.
    current().players.forEach((player, index) => { player.objective = { objectiveId: ['collector', 'arsenal', 'tycoon', 'merchant'][index]!, status: 'ACTIVE', rewardGranted: false, progress: {} }; });
    for (let step = 0; step < 40 && current().round!.number < 3; step += 1) {
      if (current().round!.phase === 'TURN') {
        for (const actor of actors) {
          await expect(actor.page.locator('.table-presentation-canvas')).toHaveAttribute('data-presentation-wildcard', 'hidden');
          await expect(actor.page.getByRole('button', { name: /draw wildcard/i })).toHaveCount(0);
        }
        await pass();
        if (current().round!.phase === 'INTERMISSION') {
          expect(current().players.map(player => player.inventory.coins)).toEqual(startingCoins.map(coins => coins + current().round!.number * 2));
          expect(current().events!.filter(event => event.kind === 'ROUND_INCOME_GRANTED')).toHaveLength(current().round!.number);
          await expect(actors[0]!.page.getByText('ROUND INCOME', { exact: true })).toBeVisible();
          if (current().round!.number === 1) await actors[0]!.page.screenshot({ path: 'audit/screenshots/wildcard-round-income.png' });
        }
      } else {
        const revision = current().revision;
        const deadline = tableServer!.game.deadlines(admission.code)[0]!.at;
        await tableServer!.clock.advanceTo(deadline + 1); await settle(revision + 1);
      }
    }
    expect(current().round!.number).toBe(3);
    await expect(actors[0]!.page.locator('.table-presentation-canvas')).toHaveAttribute('data-presentation-wildcard', 'available');
    await actors[0]!.page.locator('.action-dock').hover();
    await expect(actors[0]!.page.getByRole('button', { name: /draw wildcard/i })).toBeVisible();
    await actors[0]!.page.clock.runFor(1_300);
    await actors[0]!.page.screenshot({ path: 'audit/screenshots/wildcard-round-three-deck.png' });
    await expect(actors[1]!.page.getByRole('button', { name: /draw wildcard/i })).toHaveCount(0);

    // Force only the isolated test deck order; no client or production endpoint can do this.
    // The private burn also exercises the longest canonical ability at 1280×720.
    current().wildcardDeck = ['redistribution', 'seize', 'search-warrant', ...current().wildcardDeck!.filter(id => !['redistribution', 'seize', 'search-warrant'].includes(id))];
    await actors[0]!.page.getByRole('button', { name: /draw wildcard/i }).click();
    await click(0, 'DRAW WILDCARD');
    expect(current().turn!.primaryUsed).toBe(true);
    await expect(actors[0]!.page.locator('.table-presentation-canvas')).toHaveAttribute('data-presentation-wildcard-phase', 'held');
    await expect(actors[0]!.page.locator('.table-presentation-canvas')).toHaveAttribute('data-presentation-wildcard-face', 'redistribution');
    await expect(actors[0]!.page.getByRole('dialog', { name: 'Private Wildcard decision' })).toContainText('REDISTRIBUTION');
    await actors[0]!.page.setViewportSize({ width: 1280, height: 720 });
    const decisionBounds = await actors[0]!.page.getByRole('dialog', { name: 'Private Wildcard decision' }).boundingBox();
    expect(decisionBounds!.y).toBeGreaterThanOrEqual(0);
    expect(decisionBounds!.y + decisionBounds!.height).toBeLessThanOrEqual(720);
    const toolsBounds = await actors[0]!.page.getByRole('navigation', { name: 'Table tools' }).boundingBox();
    expect(toolsBounds!.x >= decisionBounds!.x + decisionBounds!.width
      || toolsBounds!.x + toolsBounds!.width <= decisionBounds!.x
      || toolsBounds!.y >= decisionBounds!.y + decisionBounds!.height
      || toolsBounds!.y + toolsBounds!.height <= decisionBounds!.y).toBe(true);
    await actors[0]!.page.screenshot({ path: 'audit/screenshots/wildcard-private-draw.png' });
    for (const actor of actors.slice(1)) {
      await expect(actor.page.getByRole('dialog', { name: 'Private Wildcard decision' })).toHaveCount(0);
      await expect(actor.page.locator('.table-presentation-canvas')).toHaveAttribute('data-presentation-wildcard-face', 'back');
      expect(JSON.stringify(actor.wire.views)).not.toContain('"cardId":"redistribution"');
    }
    await expect(actors[1]!.page.locator('.table-presentation-canvas')).toHaveAttribute('data-presentation-wildcard-phase', 'held');
    await actors[1]!.page.screenshot({ path: 'audit/screenshots/wildcard-opponent-private-draw.png' });
    await click(0, 'BURN');
    await expect(actors[0]!.page.getByRole('dialog', { name: 'Private Wildcard decision' })).toHaveCount(0);
    expect(current().players.map(player => player.inventory.coins)).toEqual(startingCoins.map(coins => coins + 4));
    for (const actor of actors.slice(1)) expect(JSON.stringify(actor.wire.views)).not.toContain('"cardId":"redistribution"');
    await expect(actors[0]!.page.getByRole('button', { name: /draw wildcard/i })).toHaveCount(0);
    await actors[0]!.page.setViewportSize(desktopViewport);
    // Burn finishes the consumed Primary Action and advances immediately.
    expect(current().turn?.activeSeat).toBe(1);
    expect(current().turn?.primaryUsed).toBe(false);

    await actors[1]!.page.locator('.action-dock').hover();
    await actors[1]!.page.getByRole('button', { name: /draw wildcard/i }).click(); await click(1, 'DRAW WILDCARD');
    await expect(actors[1]!.page.locator('.table-presentation-canvas')).toHaveAttribute('data-presentation-wildcard-phase', 'held');
    await expect(actors[1]!.page.getByRole('dialog', { name: 'Private Wildcard decision' })).toContainText('SEIZE');
    await expect(actors[1]!.page.getByLabel('Wildcard target player')).toHaveCount(0);
    await click(1, 'USE');
    for (const actor of actors) expect(actor.wire.latest().public.wildcard!.pending!.cardId).toBe('seize');
    await expect(actors[0]!.page.locator('.table-presentation-canvas')).toHaveAttribute('data-presentation-wildcard-face', 'seize');
    await actors[0]!.page.clock.setFixedTime(tableServer!.clock.now() + 700);
    await actors[0]!.page.clock.runFor(700);
    await expect(actors[0]!.page.locator('.wildcard-public-result')).toBeVisible();
    await actors[0]!.page.screenshot({ path: 'audit/screenshots/wildcard-public-reveal.png' });
    const victim = current().players[0]!; const item = victim.inventory.visible.find(item => item)!;
    await actors[1]!.page.getByLabel('Wildcard target player').selectOption(victim.id);
    await actors[1]!.page.getByLabel('Wildcard target item').selectOption(item.instanceId);
    const targetBounds = await actors[1]!.page.getByRole('dialog', { name: 'Resolve your Wildcard' }).boundingBox();
    const targetToolsBounds = await actors[1]!.page.getByRole('navigation', { name: 'Table tools' }).boundingBox();
    expect(targetToolsBounds!.x >= targetBounds!.x + targetBounds!.width
      || targetToolsBounds!.x + targetToolsBounds!.width <= targetBounds!.x
      || targetToolsBounds!.y >= targetBounds!.y + targetBounds!.height
      || targetToolsBounds!.y + targetToolsBounds!.height <= targetBounds!.y).toBe(true);
    await actors[1]!.page.screenshot({ path: 'audit/screenshots/wildcard-public-target-selection.png' });
    await click(1, 'RESOLVE WILDCARD');
    expect(current().players[1]!.inventory.visible.some(value => value?.instanceId === item.instanceId)).toBe(true);
    expect(current().wildcardDiscard!.at(-1)).toMatchObject({ cardId: 'seize', burned: false });
    expect(current().wildcardDrawUsedByPlayer![current().players[2]!.id]).not.toBe(true);
    expect(current().turn?.activeSeat).toBe(2);
    expect(current().turn?.primaryUsed).toBe(false);

    await actors[2]!.page.locator('.action-dock').hover();
    await actors[2]!.page.getByRole('button', { name: /draw wildcard/i }).click(); await click(2, 'DRAW WILDCARD'); await click(2, 'USE');
    await actors[2]!.page.getByLabel('Wildcard target player').selectOption(victim.id);
    await actors[2]!.page.getByLabel('Wildcard target Pocket').selectOption('0');
    await click(2, 'RESOLVE WILDCARD');
    for (const actor of actors) expect(actor.wire.latest().public.events!.find(event => event.kind === 'WILDCARD_RESOLVED' && event.presentation?.wildcardId === 'search-warrant')!.presentation!.revealedPocket!.item.itemId).toBe('knife');
    expect(current().turn?.activeSeat).toBe(3);
    expect(current().turn?.primaryUsed).toBe(false);
    current().players[3]!.objective!.status = 'FAILED'; current().players[3]!.objective!.failureReason = 'Isolated spectator UI fixture.';
    // Publish the isolated failed-objective fixture through a real Free Action
    // rather than consuming the turn on which Concede must be offered.
    await actors[3]!.page.getByRole('button', { name: 'Chat', exact: true }).click();
    await actors[3]!.page.getByLabel('Message', { exact: true }).fill('Ready to concede.');
    await click(3, 'Send message');
    await actors[3]!.page.getByRole('button', { name: /Close chat/ }).click();
    await actors[3]!.page.locator('.action-dock').hover();
    await actors[3]!.page.getByRole('button', { name: /^concede/i }).click();
    const beforeConcede = current().revision;
    await actors[3]!.page.getByRole('dialog', { name: 'Confirm Concede' }).getByRole('button', { name: /^concede/i }).click();
    await settle(beforeConcede + 1);
    const spectator = actors[3]!.wire.latest();
    expect(spectator.spectator).toBe(true);
    if (spectator.spectator) expect(JSON.stringify(spectator.players[0]!.private.inspections)).toContain('redistribution');
    // Conceding the final owed turn completes the Round. Let the existing
    // income/order presentation finish before expecting the spectator HUD.
    const presentationDoneAt = current().shop!.orderReveal!.startedAt + ROUND_INCOME_PRESENTATION_DURATION + ORDER_REVEAL_DURATION + 1;
    await actors[3]!.page.clock.setFixedTime(presentationDoneAt);
    await actors[3]!.page.clock.runFor(200);
    await expect(actors[3]!.page.getByRole('button', { name: 'God view', exact: true })).toBeVisible();
    for (const actor of actors) {
      const size = await actor.page.evaluate(() => ({ width: innerWidth, height: innerHeight, documentWidth: document.documentElement.scrollWidth, documentHeight: document.documentElement.scrollHeight }));
      expect(size.documentWidth).toBeLessThanOrEqual(size.width); expect(size.documentHeight).toBeLessThanOrEqual(size.height);
    }
  } finally { await Promise.all(actors.map(actor => actor.context.close())); }
});
