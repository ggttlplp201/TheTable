import type { Browser, BrowserContext, Locator, Page } from '@playwright/test';
import { BROWSER_EPOCH, LIFECYCLE_SEED } from '../../apps/server/test/browser-harness';
import { test, expect, type BrowserHarness } from './fixtures';
import { chooseRoleAndReady, createRoom, desktopViewport, joinRoom, session, lockStartingPocket, waitForPlayableTable } from './helpers';
import { installWireProbe, observeViews, probe } from './browser-wire';

type Player = { page: Page; wire: ReturnType<typeof observeViews>; context: BrowserContext };

async function player(browser: Browser): Promise<Player> {
  const context = await browser.newContext({ viewport: desktopViewport });
  const page = await context.newPage();
  // Keep the server's epoch, but let arrival/objective UI deadlines progress.
  await page.clock.install({ time: BROWSER_EPOCH });
  await installWireProbe(page);
  return { page, context, wire: observeViews(page) };
}
async function settle(players: Player[], revision: number) {
  // Three live WebGL clients can briefly defer Socket.IO frame delivery while
  // all of them mount the order-reveal scene at the same revision.
  await Promise.all(players.map(person => person.wire.revision(revision, 15_000)));
}
async function action(players: Player[], person: Player, button: Locator) {
  const revision = person.wire.latest().public.revision;
  await button.click();
  await settle(players, revision + 1);
}
async function start(players: Player[]) {
  const host = await createRoom(players[0]!.page, 'Host');
  for (let index = 1; index < players.length; index += 1) {
    await joinRoom(players[index]!.page, host.code, index === 1 ? 'Victim' : 'Witness');
  }
  const roles = ['Enforcer', 'Smuggler', 'Locksmith'];
  for (const [index, person] of players.entries()) await chooseRoleAndReady(person.page, roles[index]!);
  await expect(players[0]!.page.getByRole('button', { name: 'Start match' })).toBeEnabled();
  await action(players, players[0]!, players[0]!.page.getByRole('button', { name: 'Start match' }));
  for (const [index, person] of players.entries()) await lockStartingPocket(person.page, ['Cloth', 'Poison', 'Knife'][index]!);
  await Promise.all(players.map(person => waitForPlayableTable(person.page)));
  return host;
}
async function returnToHost(players: Player[], tableServer: BrowserHarness) {
  for (let step = 0; step < 24; step += 1) {
    const room = players[0]!.wire.latest().public;
    expect(room.status).toBe('PLAYING');
    if (room.round?.phase !== 'INTERMISSION' && room.turn?.activeSeat === 0 && !room.turn.primaryUsed) return;
    if (room.round?.phase === 'INTERMISSION') {
      const revision = room.revision;
      const deadline = room.shop!.phase === 'PREP' ? room.shop!.prepDeadlineAt : room.shop!.phase === 'PUBLIC' ? room.shop!.publicDeadlineAt : room.shop!.privateDeadlineAt;
      expect(deadline).toBeDefined();
      await tableServer.clock.advanceTo(deadline!);
      // A timeout published at the clock's current instant may be registered at
      // current + 1 because BrowserClock deliberately clamps zero-delay tasks.
      // Probe authoritative state first so the extra tick is used only when
      // that exact scheduling boundary was actually observed.
      const exact = tableServer.game.read(room.code)!;
      if (exact.revision === revision) {
        expect(tableServer.clock.now()).toBe(deadline);
        await tableServer.clock.advanceTo(deadline! + 1);
        expect(tableServer.game.read(room.code)!.revision).toBeGreaterThanOrEqual(revision + 1);
      }
      await settle(players, revision + 1);
      continue;
    }
    const seat = room.turn!.activeSeat;
    const person = players[seat]!;
    const downed = room.players[seat]!.life === 'DOWNED';
    if (!downed) await person.page.getByLabel('Your actions').hover();
    await action(players, person, person.page.getByRole('button', {
      name: downed ? /^pass downed turn$/i : /end turn|pass turn/i,
    }));
  }
  throw new Error('The scripted round did not return to the host.');
}
async function shoot(players: Player[], quickDraw = false) {
  const host = players[0]!;
  await host.page.getByRole('button', { name: /Use item/i }).click();
  if (quickDraw) await host.page.getByLabel(/Use Quick Draw/).check();
  await action(players, host, host.page.getByRole('button', { name: 'Use Pistol', exact: true }));
}
function resultRow(page: Page, name: string) {
  return page.getByRole('table', { name: 'Final scores', exact: true }).getByRole('row')
    .filter({ has: page.getByRole('cell', { name: new RegExp(`^${name}$`, 'i') }) });
}

test.describe('deterministic lifecycle', () => {
  test.skip(Boolean(process.env.E2E_EXTERNAL_SERVER), 'Clock injection exists only in the local test process.');

  test('permanent death automatically grants read-only god view; scored exit reaches Results and spectator host rematches', async ({ browser, tableServer }) => {
    // This covers two full three-client starts, including their detailed rigs.
    test.setTimeout(120_000);
    const players = [await player(browser), await player(browser), await player(browser)];
    const [host, victim, witness] = players as [Player, Player, Player];
    try {
      const admission = await start(players);
      const identities = await Promise.all(players.map(person => session(person.page)));
      expect(tableServer!.game.read(admission.code)!.match!.seed).toBe(LIFECYCLE_SEED);
      for (const person of players) await person.page.getByRole('button', { name: 'Contract', exact: true }).click();
      await expect(host.page.getByLabel('Your objective', { exact: true })).toContainText('Executioner');
      await expect(victim.page.getByLabel('Your objective', { exact: true })).toContainText('Collector');
      await expect(witness.page.getByLabel('Your objective', { exact: true })).toContainText('Tycoon');
      for (const person of players) await person.page.getByRole('button', { name: 'Close Private contract', exact: true }).click();
      expect((await probe(victim.page, 'room:spectate')).error?.code).toBe('SPECTATOR_FORBIDDEN');

      await shoot(players);
      expect(host.wire.latest().public.players[1]!.hp).toBe(2);
      await returnToHost(players, tableServer!);
      await shoot(players, true);
      expect(host.wire.latest().public.players[1]!.life).toBe('DOWNED');
      await expect(host.page.getByRole('button', { name: 'Take immediate loot', exact: true })).toBeVisible();
      const lootedInstanceId = host.wire.latest().public.players[1]!.visibleInventory.find(item => item !== null)!.instanceId;
      await host.page.getByRole('button', { name: 'Take immediate loot', exact: true }).click();
      await action(players, host, host.page.getByRole('button', { name: 'Loot item', exact: true }));
      expect(host.wire.latest().public.turn!.immediateLoot).toBeUndefined();
      expect(host.wire.latest().public.players[0]!.visibleInventory.some(item => item?.instanceId === lootedInstanceId)).toBe(true);
      await expect(victim.page.locator('[data-viewer="player"]')).toBeVisible();
      expect((await probe(victim.page, 'room:spectate')).error?.code).toBe('SPECTATOR_FORBIDDEN');
      expect(victim.wire.frames.join('\n')).not.toContain('executioner');
      expect(victim.wire.frames.join('\n')).not.toContain('tycoon');

      await returnToHost(players, tableServer!);
      expect(host.wire.latest().public.status).toBe('PLAYING');
      expect(host.wire.latest().public.players[1]!.life).toBe('DEAD');
      // No room:spectate request after death: publication must promote automatically.
      await expect(victim.page.locator('[data-viewer="spectator"]')).toBeVisible();
      const spectator = victim.wire.latest();
      expect(spectator.spectator).toBe(true);
      if (!spectator.spectator) throw new Error('Expected verified spectator projection');
      expect(spectator.viewerPlayerId).toBe(identities[1]!.playerId);
      expect(spectator.capabilities).toEqual([]);
      expect(spectator.players.map(person => person.private.capabilities)).toEqual([[], [], []]);
      expect(spectator.players.map(person => person.private.objective!.objectiveId)).toEqual(['executioner', 'collector', 'tycoon']);
      expect(spectator).not.toHaveProperty('private');
      expect(spectator.chests.some(chest => chest.loot.length > 0)).toBe(true);
      expect(host.wire.latest().public.chests!.every(chest => !('loot' in chest))).toBe(true);
      await expect(victim.page.getByLabel('Host’s private information')).toContainText('Executioner');
      await expect(victim.page.locator('[data-viewer="spectator"] form')).toHaveCount(0);
      await expect(victim.page.getByLabel('Your actions', { exact: true })).toHaveCount(0);
      const beforeRejected = victim.wire.latest().public.revision;
      expect((await probe(victim.page, 'room:command', { type: 'END_TURN', payload: {}, idempotencyKey: 'dead-action' })).error?.code).toBe('SPECTATOR_READ_ONLY');
      expect((await probe(victim.page, 'chat:send', { text: 'dead-chat-sentinel', idempotencyKey: 'dead-chat' })).error?.code).toBe('SPECTATOR_READ_ONLY');
      expect(tableServer!.game.read(admission.code)!.revision).toBe(beforeRejected);
      expect(host.wire.frames.join('\n')).not.toContain('collector');
      expect(witness.wire.frames.join('\n')).not.toContain('collector');
      await expect(witness.page.locator('body')).not.toContainText('Collector');

      await action(players, host, host.page.getByRole('button', { name: /leave table/i }));
      const exitConfirmation = host.page.getByRole('button', { name: 'Return to the table as a spectator', exact: true });
      if (await exitConfirmation.isVisible()) await exitConfirmation.click();
      for (const person of players) {
        await expect(person.page.getByRole('heading', { name: 'The table empties', exact: true })).toBeVisible();
        await expect(resultRow(person.page, 'Host').getByRole('cell').last()).toHaveText('100');
        await expect(resultRow(person.page, 'Host').getByRole('cell').first()).toHaveText('1');
        await expect(resultRow(person.page, 'Victim').getByRole('cell').last()).toHaveText('0');
        await expect(resultRow(person.page, 'Witness').getByRole('cell').last()).toHaveText('0');
        expect(person.wire.latest().public.players.map(person => person.score)).toEqual([100, 0, 0]);
        expect(person.wire.latest().public.turn).toBeUndefined();
      }
      await expect(resultRow(witness.page, 'Host')).toContainText('Executioner ✓');
      await expect(resultRow(witness.page, 'Victim')).toContainText('Objective unrevealed');
      await expect(resultRow(victim.page, 'Victim')).toContainText('Collector ✕');
      await expect(resultRow(host.page, 'Victim')).toContainText('Collector ✕');
      expect(witness.wire.frames.join('\n')).not.toContain('collector');
      expect(JSON.stringify(witness.wire.latest())).toContain('executioner');
      expect(await witness.page.evaluate(() => JSON.stringify(localStorage))).not.toContain('collector');
      await expect(witness.page.locator('body')).not.toContainText('Collector');
      await expect(host.page.locator('[data-viewer="spectator"]')).toBeVisible();
      await expect(victim.page.getByRole('button', { name: 'Rematch', exact: true })).toHaveCount(0);
      await expect(witness.page.getByRole('button', { name: 'Rematch', exact: true })).toHaveCount(0);
      expect((await probe(victim.page, 'room:rematch', { idempotencyKey: 'non-host-rematch' })).error?.code).toBe('NOT_HOST');
      const finalRevision = host.wire.latest().public.revision;
      await tableServer!.clock.advanceTo(tableServer!.clock.now() + 60_000);
      expect(tableServer!.game.read(admission.code)!.revision).toBe(finalRevision);
      await action(players, host, host.page.getByRole('button', { name: 'Rematch', exact: true }));
      for (const [index, person] of players.entries()) {
        await expect(person.page.getByRole('heading', { level: 1 })).toHaveText(admission.code);
        await expect(person.page.getByRole('button', { name: /ready up/i })).toBeEnabled();
        expect(await session(person.page)).toEqual(identities[index]);
        const view = person.wire.latest();
        expect(view.spectator).not.toBe(true);
        if (view.spectator) throw new Error('Rematch did not restore player view');
        expect(view.private.playerId).toBe(identities[index]!.playerId);
        expect(view.private.objective).toBeUndefined();
        expect(view.public.players.map(person => ({ id: person.id, seat: person.seat, ready: person.ready, score: person.score, life: person.life })))
          .toEqual(identities.map((identity, seat) => ({ id: identity.playerId, seat, ready: false, score: 0, life: 'ACTIVE' })));
      }
      // Prove the retained identities can actually play again, not just render a lobby.
      for (const person of players) await person.page.getByRole('button', { name: /ready up/i }).click();
      await action(players, host, host.page.getByRole('button', { name: /start match/i }));
      for (const [index, person] of players.entries()) await lockStartingPocket(person.page, ['Cloth', 'Poison', 'Knife'][index]!);
      await Promise.all(players.map(person => waitForPlayableTable(person.page)));
      expect(host.wire.latest().public.players.map(person => person.hp)).toEqual([5, 5, 5]);
    } finally { await Promise.all(players.map(person => person.context.close())); }
  });

  test('scheduled turn expiry skips once and Trade expiry declines atomically at the exact deadline', async ({ browser, tableServer }) => {
    test.setTimeout(60_000);
    const players = [await player(browser), await player(browser), await player(browser)];
    const [host, guest] = players as [Player, Player, Player];
    try {
      const admission = await start(players);
      const room = () => tableServer!.game.read(admission.code)!;
      const turn = host.wire.latest().public.turn!;
      const initialRevision = room().revision;
      await tableServer!.clock.advanceTo(turn.deadlineAt - 1);
      expect(room().revision).toBe(initialRevision);
      await tableServer!.clock.advanceTo(turn.deadlineAt);
      await settle(players, initialRevision + 1);
      expect(room().revision).toBe(initialRevision + 1);
      expect(guest.wire.latest().public.turn!.activeSeat).toBe(1);
      await expect(guest.page.getByText('YOUR TURN', { exact: true })).toBeVisible();
      await tableServer!.clock.advanceTo(turn.deadlineAt);
      expect(room().revision).toBe(initialRevision + 1);

      await guest.page.getByRole('button', { name: /Trade/i }).click();
      await guest.page.getByRole('spinbutton', { name: 'You request Gold', exact: true }).fill('1');
      await action(players, guest, guest.page.getByRole('button', { name: 'Propose Trade', exact: true }));
      await expect(host.page.getByRole('button', { name: 'Accept Trade', exact: true })).toBeVisible();
      const pending = guest.wire.latest().public;
      const beforeCoins = pending.players.map(person => person.coins);
      const revision = pending.revision;
      const deadline = pending.pendingTrade!.deadlineAt;
      const remaining = pending.turn!.pausedRemainingMs!;
      await tableServer!.clock.advanceTo(deadline - 1);
      expect(room().revision).toBe(revision);
      await expect(host.page.getByRole('button', { name: 'Accept Trade', exact: true })).toBeVisible();
      await tableServer!.clock.advanceTo(deadline);
      await settle(players, revision + 1);
      await expect(host.page.getByRole('heading', { name: 'Trade offer', exact: true })).toHaveCount(0);
      expect(guest.wire.latest().public.players.map(person => person.coins)).toEqual(beforeCoins);
      expect(guest.wire.latest().public.pendingTrade).toBeUndefined();
      expect(guest.wire.latest().public.turn!.pausedRemainingMs).toBeUndefined();
      expect(guest.wire.latest().public.turn!.deadlineAt).toBe(deadline + remaining);
      expect(guest.wire.latest().public.turn!.activeSeat).toBe(2);
      expect(guest.wire.latest().public.turn!.primaryUsed).toBe(false);
      expect(guest.wire.latest().public.events?.some(event => event.kind === 'TRADE_EXPIRED_DECLINED' && event.publicText.includes('Trade expired — declined'))).toBe(true);
      await tableServer!.clock.advanceTo(deadline);
      expect(room().revision).toBe(revision + 1);
    } finally { await Promise.all(players.map(person => person.context.close())); }
  });
});
