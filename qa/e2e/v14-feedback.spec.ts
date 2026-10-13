import type { Browser, BrowserContext, Locator, Page } from '@playwright/test';
import { BROWSER_EPOCH } from '../../apps/server/test/browser-harness';
import { test, expect, type BrowserHarness } from './fixtures';
import { chooseRoleAndReady, createRoom, desktopViewport, joinRoom, lockStartingPocket, waitForPlayableTable } from './helpers';
import { installWireProbe, observeViews, probe } from './browser-wire';

type Actor = { page: Page; wire: ReturnType<typeof observeViews>; context: BrowserContext };

async function actor(browser: Browser): Promise<Actor> {
  const context = await browser.newContext({ viewport: desktopViewport });
  const page = await context.newPage();
  await page.clock.install({ time: BROWSER_EPOCH });
  await installWireProbe(page);
  return { page, wire: observeViews(page), context };
}

async function settle(actors: Actor[], revision: number) {
  await Promise.all(actors.map(person => person.wire.revision(revision, 15_000)));
}

async function action(actors: Actor[], person: Actor, control: Locator) {
  const revision = person.wire.latest().public.revision;
  await control.click();
  await settle(actors, revision + 1);
}

async function start(actors: Actor[], roles: string[], pockets: string[]) {
  const admission = await createRoom(actors[0]!.page, 'Host');
  for (let index = 1; index < actors.length; index += 1) await joinRoom(actors[index]!.page, admission.code, index === 1 ? 'Victim' : 'Witness');
  for (const [index, person] of actors.entries()) await chooseRoleAndReady(person.page, roles[index]!);
  // The server is still at its initial epoch after real-time lobby loading.
  // Reset browser Date before the server starts the timed Pocket choice.
  await Promise.all(actors.map(person => person.page.clock.setSystemTime(BROWSER_EPOCH)));
  await action(actors, actors[0]!, actors[0]!.page.getByRole('button', { name: /^start match$/i }));
  for (const [index, person] of actors.entries()) await lockStartingPocket(person.page, pockets[index]!);
  await Promise.all(actors.map(person => person.page.clock.fastForward(17_000)));
  await Promise.all(actors.map(person => waitForPlayableTable(person.page)));
  return admission;
}

async function passTurn(actors: Actor[], person: Actor) {
  await person.page.locator('.action-dock').hover();
  await action(actors, person, person.page.locator('.action-dock').getByRole('button', { name: /end turn|pass turn/i }));
}

async function returnToSeat(actors: Actor[], seat: number, tableServer: BrowserHarness) {
  for (let step = 0; step < 24; step += 1) {
    const room = actors[0]!.wire.latest().public;
    if (room.round?.phase === 'TURN' && room.turn?.activeSeat === seat && !room.turn.primaryUsed) return;
    if (room.round?.phase === 'INTERMISSION') {
      const revision = room.revision;
      const deadline = room.shop!.phase === 'PREP' ? room.shop!.prepDeadlineAt : room.shop!.phase === 'PUBLIC' ? room.shop!.publicDeadlineAt : room.shop!.privateDeadlineAt;
      await tableServer.clock.advanceTo(deadline!);
      const exact = tableServer.game.read(room.code)!;
      if (exact.revision === revision) {
        expect(tableServer.clock.now()).toBe(deadline);
        await tableServer.clock.advanceTo(deadline! + 1);
        expect(tableServer.game.read(room.code)!.revision).toBeGreaterThanOrEqual(revision + 1);
      }
      await settle(actors, revision + 1);
      continue;
    }
    await passTurn(actors, actors[room.turn!.activeSeat]!);
  }
  throw new Error(`The table did not return to seat ${seat}.`);
}

async function expectRealHitTarget(locator: Locator) {
  await expect(locator).toBeVisible();
  expect(await locator.evaluate(element => {
    const box = element.getBoundingClientRect();
    const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
    return hit === element || element.contains(hit);
  })).toBe(true);
}

async function syncVisualClock(person: Actor, tableServer: BrowserHarness, renderMs = 350) {
  const browserNow = await person.page.evaluate(() => Date.now());
  const pings = person.wire.frames.filter(frame => frame === '2').length;
  await person.page.clock.setSystemTime(Math.max(browserNow, tableServer.clock.now()));
  await person.page.clock.runFor(renderMs);
  // A real ping refreshes Socket.IO's Date-based expiry after synthetic jumps.
  await expect.poll(() => person.wire.frames.filter(frame => frame === '2').length).toBeGreaterThan(pings);
}

async function expectMarketCanvasPainted(page: Page) {
  const canvas = page.locator('.market-canvas canvas');
  await expect(canvas).toBeVisible();
  await expect.poll(async () => {
    const png = await canvas.screenshot();
    return page.evaluate(async base64 => {
      const image = new Image();
      image.src = `data:image/png;base64,${base64}`;
      await image.decode();
      const scratch = document.createElement('canvas');
      scratch.width = image.width; scratch.height = image.height;
      const context = scratch.getContext('2d')!;
      context.drawImage(image, 0, 0);
      const pixels = context.getImageData(0, 0, scratch.width, scratch.height).data;
    const colors = new Set<string>();
    for (let index = 0; index < pixels.length; index += 4 * 53) {
      colors.add(`${pixels[index]}:${pixels[index + 1]}:${pixels[index + 2]}:${pixels[index + 3]}`);
      if (colors.size > 16) break;
    }
    return colors.size;
    }, png.toString('base64'));
  }).toBeGreaterThan(8);
}

test.describe('v14 closed-beta feedback regressions', () => {
  test.skip(Boolean(process.env.E2E_EXTERNAL_SERVER), 'Deterministic clock/state setup exists only in the local browser harness.');
  test.beforeEach(({ tableServer }) => { if (tableServer) tableServer.server.io.engine.opts.pingInterval = 250; });

  test('keeps a private Chat draft through close, turn expiry, and an incoming response without redirecting it to Global', async ({ browser, tableServer }) => {
    test.setTimeout(90_000);
    const actors = [await actor(browser), await actor(browser), await actor(browser)];
    const [host, victim, witness] = actors as [Actor, Actor, Actor];
    try {
      await start(actors, ['Enforcer', 'Medic', 'Locksmith'], ['Bullet', 'Medicine', 'Knife']);
      await syncVisualClock(host, tableServer!);
      await host.page.screenshot({ path: 'audit/screenshots/v14-normal-table-compact-role.png', fullPage: true });

      await expect(host.page.getByLabel('1 usable Bullets including Pockets', { exact: true })).toHaveText('1');
      const victimSeat = host.page.locator('.seat-ribbon li').filter({ hasText: 'VICTIM' }).getByRole('button');
      const tasksTab = host.page.getByRole('button', { name: /TASKS ·/ });
      await host.page.clock.runFor(1_600);
      await expect(tasksTab).toHaveAttribute('aria-expanded', 'false');
      await tasksTab.hover();
      await expect(tasksTab).toHaveAttribute('aria-expanded', 'false');
      await tasksTab.click();
      await expect(tasksTab).toHaveAttribute('aria-expanded', 'true');
      await expectRealHitTarget(victimSeat);
      const [tasksBox, seatsBox] = await Promise.all([
        host.page.locator('.tasks-popup').boundingBox(),
        host.page.locator('.seat-ribbon').boundingBox(),
      ]);
      expect(tasksBox && seatsBox && seatsBox.x + seatsBox.width <= tasksBox.x).toBe(true);
      await victimSeat.click();
      const selectedOpponent = host.page.locator('.player-detail[data-selected="true"]');
      await expect(selectedOpponent).toContainText('Victim');
      await expect(selectedOpponent).toHaveAttribute('open', '');
      await expect(selectedOpponent).not.toContainText('Host (you)');
      await host.page.getByRole('button', { name: 'Close At the table', exact: true }).click();

      await host.page.locator('.action-dock').getByRole('button', { name: /Trade/i }).click();
      await host.page.getByRole('spinbutton', { name: 'You request Gold', exact: true }).fill('1');
      const turn = host.wire.latest().public.turn!;
      const revision = host.wire.latest().public.revision;
      await tableServer!.clock.advanceTo(turn.deadlineAt);
      await settle(actors, revision + 1);
      await expect(host.page.getByText('Turn ended. Draft saved.', { exact: true })).toBeVisible();
      await expect(host.page.getByRole('button', { name: 'Propose Trade', exact: true })).toBeDisabled();
      await expect(host.page.getByRole('spinbutton', { name: 'You request Gold', exact: true })).toHaveValue('1');
      await host.page.getByRole('button', { name: 'Close Trade', exact: true }).click();

      await host.page.getByRole('button', { name: 'Chat', exact: true }).click();
      await host.page.getByLabel('Private recipient', { exact: true }).selectOption({ label: 'Private: Victim' });
      const draft = host.page.locator('.chat-form textarea');
      await draft.fill('private-draft-sentinel');
      await expect(host.page.getByText('TO: PRIVATE · Victim', { exact: true })).toBeVisible();
      await host.page.getByRole('button', { name: /Close chat/ }).click();
      await host.page.getByRole('button', { name: 'Chat', exact: true }).click();
      await expect(host.page.getByLabel('Private recipient', { exact: true })).toHaveValue(victim.wire.latest().viewerPlayerId!);
      await expect(draft).toHaveValue('private-draft-sentinel');

      await victim.page.locator('.action-dock').getByRole('button', { name: /Trade/i }).click();
      await action(actors, victim, victim.page.getByRole('button', { name: 'Propose Trade', exact: true }));
      const accept = host.page.getByRole('button', { name: 'Accept Trade', exact: true });
      await expect(accept).toBeVisible();
      await expect(draft).toHaveValue('private-draft-sentinel');
      await expect(host.page.getByText('TO: PRIVATE · Victim', { exact: true })).toBeVisible();
      await expectRealHitTarget(accept);
      await expectRealHitTarget(draft);
      const [responseBox, chatBox] = await Promise.all([accept.boundingBox(), draft.boundingBox()]);
      expect(responseBox && chatBox && (responseBox.x + responseBox.width <= chatBox.x || chatBox.x + chatBox.width <= responseBox.x || responseBox.y + responseBox.height <= chatBox.y || chatBox.y + chatBox.height <= responseBox.y)).toBe(true);
      await syncVisualClock(host, tableServer!);
      await host.page.screenshot({ path: 'audit/screenshots/v14-response-chat-full-shell.png', fullPage: true });

      await host.page.getByRole('button', { name: 'Send message', exact: true }).click();
      await expect.poll(() => victim.wire.latest().messages?.some(message => message.text === 'private-draft-sentinel')).toBe(true);
      await victim.page.getByRole('button', { name: 'Chat', exact: true }).click();
      await expect(victim.page.getByText('private-draft-sentinel', { exact: true })).toBeVisible();
      await victim.page.getByRole('button', { name: /Close chat/ }).click();
      expect(witness.wire.frames.join('\n')).not.toContain('private-draft-sentinel');
      await expect(host.page.getByText('TO: PRIVATE · Victim', { exact: true })).toBeVisible();
      await expect(accept).toBeVisible();
    } finally { await Promise.all(actors.map(person => person.context.close())); }
  });

  test('keeps Downed tools and Chat live, recognizes Pocket Medicine, and exposes failed-contract Concede only on the normal turn', async ({ browser, tableServer }) => {
    test.setTimeout(120_000);
    const actors = [await actor(browser), await actor(browser), await actor(browser)];
    const [host, victim, witness] = actors as [Actor, Actor, Actor];
    try {
      const admission = await start(actors, ['Enforcer', 'Medic', 'Locksmith'], ['Cloth', 'Medicine', 'Knife']);
      await host.page.locator('.action-dock').getByRole('button', { name: /Use item/i }).click();
      await action(actors, host, host.page.getByRole('button', { name: 'Use Pistol', exact: true }));
      await returnToSeat(actors, 0, tableServer!);
      await host.page.locator('.action-dock').getByRole('button', { name: /Use item/i }).click();
      await host.page.getByLabel(/Use Quick Draw/).check();
      await action(actors, host, host.page.getByRole('button', { name: 'Use Pistol', exact: true }));

      await expect(victim.page.getByRole('heading', { name: 'Downed', exact: true })).toBeVisible();
      await expect(victim.page.getByText(/immediately before/i)).toBeVisible();
      await expect(victim.page.getByText(/HOST’S NEXT TURN/)).toBeVisible();
      await expect(victim.page.getByText('SELF-REVIVE', { exact: true })).toBeVisible();
      await expect(victim.page.getByText(/Wait for your Downed turn · Medicine ready/)).toBeVisible();
      for (const tool of ['Contract', 'Pockets', 'Chat', 'Log']) await expect(victim.page.getByRole('button', { name: tool, exact: true })).toBeVisible();
      const [downedActionsBox, selfHandBox] = await Promise.all([
        victim.page.locator('.downed-actions').boundingBox(),
        victim.page.locator('.self-hand').boundingBox(),
      ]);
      expect(downedActionsBox && selfHandBox && (downedActionsBox.x + downedActionsBox.width <= selfHandBox.x || selfHandBox.x + selfHandBox.width <= downedActionsBox.x || downedActionsBox.y + downedActionsBox.height <= selfHandBox.y || selfHandBox.y + selfHandBox.height <= downedActionsBox.y)).toBe(true);
      await syncVisualClock(victim, tableServer!);
      await victim.page.screenshot({ path: 'audit/screenshots/v14-downed-tools-full-shell.png', fullPage: true });
      await victim.page.getByRole('button', { name: 'Chat', exact: true }).click();
      await victim.page.getByLabel('Private recipient', { exact: true }).selectOption({ label: 'Private: Witness' });
      await victim.page.getByLabel('Message', { exact: true }).fill('medicine-bargain-sentinel');
      await victim.page.getByRole('button', { name: 'Send message', exact: true }).click();
      await expect.poll(() => witness.wire.latest().messages?.some(message => message.text === 'medicine-bargain-sentinel')).toBe(true);
      await witness.page.getByRole('button', { name: 'Chat', exact: true }).click();
      await expect(witness.page.getByText('medicine-bargain-sentinel', { exact: true })).toBeVisible();
      await witness.page.getByRole('button', { name: /Close chat/ }).click();

      // A lethal Primary Action keeps only its immediate free-loot decision
      // open. Skipping that decision advances automatically to the victim.
      await action(actors, host, host.page.getByRole('button', { name: 'Skip loot', exact: true }));
      expect(victim.wire.latest().public.turn?.activeSeat).toBe(1);
      await expect(victim.page.getByRole('button', { name: /REVIVE WITH MEDICINE/ })).toContainText('Return at 2 HP');
      await action(actors, victim, victim.page.getByRole('button', { name: /REVIVE WITH MEDICINE/ }));
      expect(victim.wire.latest().public.players[1]).toMatchObject({ life: 'ACTIVE', hp: 2 });

      const live = tableServer!.game.read(admission.code)!;
      live.players[2]!.objective!.status = 'FAILED';
      live.players[2]!.objective!.failureReason = 'Every remaining path is permanently closed.';
      const failureRevision = witness.wire.latest().public.revision;
      expect((await probe(witness.page, 'chat:send', { text: 'publish-failed-state', idempotencyKey: 'publish-failed-state' })).ok).toBe(true);
      await settle(actors, failureRevision + 1);
      for (const observer of actors) {
        expect(observer.wire.latest().public.events?.some(event => event.kind === 'OBJECTIVE_FAILED')).toBe(false);
        expect(JSON.stringify(observer.wire.latest().public)).not.toContain('Every remaining path is permanently closed.');
      }
      await witness.page.getByRole('button', { name: 'Contract', exact: true }).click();
      const failureReason = witness.page.getByText('Every remaining path is permanently closed.', { exact: true });
      await expect(failureReason).toBeVisible();
      const [failureBox, contractBodyBox] = await Promise.all([
        failureReason.boundingBox(),
        witness.page.locator('.match-overlay-body').boundingBox(),
      ]);
      expect(failureBox && contractBodyBox && failureBox.y >= contractBodyBox.y && failureBox.y + failureBox.height <= contractBodyBox.y + contractBodyBox.height).toBe(true);
      await syncVisualClock(witness, tableServer!);
      await witness.page.screenshot({ path: 'audit/screenshots/v14-private-failed-contract.png', fullPage: true });
      await witness.page.getByRole('button', { name: 'Close Private contract', exact: true }).click();
      await witness.page.locator('.action-dock').hover();
      await expect(witness.page.getByRole('button', { name: 'Concede · 0 points', exact: true })).toBeVisible();
      await witness.page.getByRole('button', { name: 'Concede · 0 points', exact: true }).click();
      const confirm = witness.page.getByRole('dialog', { name: 'Confirm Concede', exact: true });
      await expect(confirm).toContainText('Your hidden objective stays private.');
      await action(actors, witness, confirm.getByRole('button', { name: 'Concede · 0 points', exact: true }));
      await expect(witness.page.locator('[data-viewer="spectator"]')).toBeVisible();
      expect(witness.wire.latest().public.players[2]).toMatchObject({ conceded: true });
    } finally { await Promise.all(actors.map(person => person.context.close())); }
  });

  test('shows 0.8s income then 7.2s order reveal, preserving 10s Prep, 30s Public decisions, and 30s grace', async ({ browser, tableServer }) => {
    test.setTimeout(90_000);
    const actors = [await actor(browser), await actor(browser), await actor(browser)];
    try {
      await start(actors, ['Enforcer', 'Medic', 'Locksmith'], ['Cloth', 'Medicine', 'Knife']);
      const revealNow = Math.max(...await Promise.all(actors.map(person => person.page.evaluate(() => Date.now())))) + 1_000;
      await Promise.all(actors.map(person => person.page.clock.pauseAt(revealNow)));
      await passTurn(actors, actors[0]!);
      await passTurn(actors, actors[1]!);
      await tableServer!.clock.advanceTo(revealNow);
      await passTurn(actors, actors[2]!);

      const prep = actors[0]!.wire.latest().public.shop!;
      expect(prep.phase).toBe('PREP');
      expect(prep.prepDeadlineAt - prep.orderReveal!.startedAt).toBe(10_000);
      await expect(actors[0]!.page.getByLabel('Round Income', { exact: true })).toBeVisible();
      await Promise.all(actors.map(person => person.page.clock.fastForward(800)));
      await expect(actors[0]!.page.getByLabel('Shopping order reveal', { exact: true })).toBeVisible();
      await Promise.all(actors.map(person => person.page.clock.fastForward(7_300)));
      await expect(actors[0]!.page.getByLabel('Shopping order reveal', { exact: true })).toHaveCount(0);
      await expect(actors[0]!.page.locator('.market-public-order')).toContainText(/Public order:/i);
      await syncVisualClock(actors[0]!, tableServer!, 500);
      await expectMarketCanvasPainted(actors[0]!.page);
      await actors[0]!.page.screenshot({ path: 'audit/screenshots/v14-intermission-full-shell.png', fullPage: true });

      const locksmith = actors[2]!;
      await locksmith.page.locator('.match-role-card summary').click();
      const tumbler = locksmith.page.getByRole('button', { name: 'Tumbler Sense · inspect chest (free)', exact: true });
      await expect(tumbler).toBeEnabled();
      await locksmith.page.screenshot({ path: 'audit/screenshots/v14-tumbler-intermission.png', fullPage: true });
      await action(actors, locksmith, tumbler);
      await expect(locksmith.page.getByRole('button', { name: 'Tumbler Sense · USED THIS ROUND', exact: true })).toBeDisabled();
      await locksmith.page.locator('.match-role-card summary').click();

      let revision = actors[0]!.wire.latest().public.revision;
      await tableServer!.clock.advanceTo(prep.prepDeadlineAt);
      await settle(actors, revision + 1);
      let shop = actors[0]!.wire.latest().public.shop!;
      expect(shop.phase).toBe('PUBLIC');
      expect(shop.publicDeadlineAt! - tableServer!.clock.now()).toBe(30_000);

      const firstId = shop.order[shop.activeShopperIndex]!;
      const first = actors.find(person => person.wire.latest().viewerPlayerId === firstId)!;
      revision = first.wire.latest().public.revision;
      await first.page.getByRole('button', { name: 'Pass Public Shop', exact: true }).click();
      await settle(actors, revision + 1);
      shop = actors[0]!.wire.latest().public.shop!;
      expect(shop.privateUnlockedBy[firstId]).toBe(true);
      await expect(first.page.getByText('PUBLIC SHOP RESOLVED · PRIVATE MARKET UNLOCKED', { exact: true })).toBeVisible();

      while (actors[0]!.wire.latest().public.shop?.phase === 'PUBLIC') {
        const current = actors[0]!.wire.latest().public;
        revision = current.revision;
        await tableServer!.clock.advanceTo(current.shop!.publicDeadlineAt!);
        await settle(actors, revision + 1);
      }
      shop = actors[0]!.wire.latest().public.shop!;
      expect(shop.phase).toBe('GRACE');
      expect(shop.privateDeadlineAt! - tableServer!.clock.now()).toBe(30_000);
      await expect(actors[0]!.page.getByText(/PRIVATE MARKET CLOSING/)).toBeVisible();
    } finally { await Promise.all(actors.map(person => person.context.close())); }
  });
});
