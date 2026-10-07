import type { Browser, BrowserContext, Locator, Page } from '@playwright/test';
import { BROWSER_EPOCH, LIFECYCLE_SEED } from '../../apps/server/test/browser-harness';
import { test, expect } from './fixtures';
import { chooseRoleAndReady, createRoom, desktopViewport, joinRoom, phoneViewport, session } from './helpers';
import { installWireProbe, observeViews, probe } from './browser-wire';

type Player = { page: Page; wire: ReturnType<typeof observeViews>; context: BrowserContext };

async function player(browser: Browser, phone = false): Promise<Player> {
  const context = await browser.newContext(phone
    ? { viewport: phoneViewport, isMobile: true, hasTouch: true }
    : { viewport: desktopViewport });
  const page = await context.newPage();
  await page.clock.setFixedTime(BROWSER_EPOCH);
  await installWireProbe(page);
  return { page, context, wire: observeViews(page) };
}
async function settle(players: Player[], revision: number) {
  await Promise.all(players.map(person => person.wire.revision(revision)));
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
  for (const person of players) await expect(person.page.getByLabel('First person table view', { exact: true })).toBeVisible();
  return host;
}
async function returnToHost(players: Player[]) {
  for (let step = 0; step < 12; step += 1) {
    const room = players[0]!.wire.latest().public;
    expect(room.status).toBe('PLAYING');
    if (room.round?.phase !== 'INTERMISSION' && room.turn?.activeSeat === 0 && !room.turn.primaryUsed) return;
    const seat = room.round?.phase === 'INTERMISSION'
      ? room.players.find(person => person.id === room.shop!.order[room.shop!.activeShopperIndex])!.seat
      : room.turn!.activeSeat;
    const person = players[seat]!;
    await action(players, person, person.page.getByRole('button', {
      name: room.round?.phase === 'INTERMISSION' ? 'Finish shopping' : /end turn|pass turn/i,
    }));
  }
  throw new Error('The scripted round did not return to the host.');
}
async function shoot(players: Player[], quickDraw = false) {
  const host = players[0]!;
  await host.page.getByRole('button', { name: 'Use item', exact: true }).click();
  if (quickDraw) await host.page.getByLabel('Use Quick Draw (once per match)', { exact: true }).check();
  await action(players, host, host.page.getByRole('button', { name: 'Use Pistol', exact: true }));
}
function resultRow(page: Page, name: string) {
  return page.getByRole('region', { name: 'Results', exact: true }).getByRole('listitem')
    .filter({ has: page.getByRole('heading', { name, exact: true }) });
}

test.describe('deterministic lifecycle', () => {
  test.skip(Boolean(process.env.E2E_EXTERNAL_SERVER), 'Clock injection exists only in the local test process.');

  test('permanent death automatically grants read-only god view; scored exit reaches Results and spectator host rematches', async ({ browser, tableServer }) => {
    test.setTimeout(90_000);
    const players = [await player(browser), await player(browser, true), await player(browser)];
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
      await returnToHost(players);
      await shoot(players, true);
      expect(host.wire.latest().public.players[1]!.life).toBe('DOWNED');
      await expect(victim.page.locator('[data-viewer="player"]')).toBeVisible();
      expect((await probe(victim.page, 'room:spectate')).error?.code).toBe('SPECTATOR_FORBIDDEN');
      expect(victim.wire.frames.join('\n')).not.toContain('executioner');
      expect(victim.wire.frames.join('\n')).not.toContain('tycoon');

      await returnToHost(players);
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
      await victim.page.getByText('Host · Active · 0 points', { exact: true }).click();
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

      await host.page.getByRole('button', { name: 'Exit ready', exact: true }).click();
      await action(players, host, host.page.getByRole('button', { name: 'Leave Table', exact: true }));
      for (const person of players) {
        await expect(person.page.getByRole('heading', { name: 'Results', exact: true })).toBeVisible();
        await expect(resultRow(person.page, 'Host').locator('.score')).toHaveText('100points');
        await expect(resultRow(person.page, 'Host')).toContainText('Exit #1');
        await expect(resultRow(person.page, 'Victim').locator('.score')).toHaveText('0points');
        await expect(resultRow(person.page, 'Witness').locator('.score')).toHaveText('0points');
        expect(person.wire.latest().public.players.map(person => person.score)).toEqual([100, 0, 0]);
        expect(person.wire.latest().public.turn).toBeUndefined();
      }
      await expect(resultRow(witness.page, 'Host')).toContainText('Executioner · Banked');
      await expect(resultRow(witness.page, 'Victim')).toContainText('Objective unrevealed');
      await expect(resultRow(victim.page, 'Victim')).toContainText('Collector · Failed');
      await expect(resultRow(host.page, 'Victim')).toContainText('Collector · Failed');
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
        await expect(person.page.getByRole('button', { name: 'Ready up', exact: true })).toBeEnabled();
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
      for (const person of players) await person.page.getByRole('button', { name: 'Ready up', exact: true }).click();
      await action(players, host, host.page.getByRole('button', { name: 'Start match', exact: true }));
      for (const person of players) await expect(person.page.getByLabel('First person table view', { exact: true })).toBeVisible();
      expect(host.wire.latest().public.players.map(person => person.hp)).toEqual([5, 5, 5]);
    } finally { await Promise.all(players.map(person => person.context.close())); }
  });

  test('scheduled turn expiry skips once and Trade expiry accepts atomically at the exact deadline', async ({ browser, tableServer }) => {
    const players = [await player(browser), await player(browser, true)];
    const [host, guest] = players as [Player, Player];
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
      await expect(guest.page.getByRole('heading', { level: 1 })).toHaveText('Your turn.');
      await tableServer!.clock.advanceTo(turn.deadlineAt);
      expect(room().revision).toBe(initialRevision + 1);

      await guest.page.getByRole('button', { name: 'Trade', exact: true }).click();
      await guest.page.getByLabel(/You request Coins/).fill('1');
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
      await expect(host.page.getByRole('heading', { name: 'Trade on the table', exact: true })).toHaveCount(0);
      expect(guest.wire.latest().public.players.map(person => person.coins)).toEqual([beforeCoins[0]! - 1, beforeCoins[1]! + 1]);
      expect(guest.wire.latest().public.pendingTrade).toBeUndefined();
      expect(guest.wire.latest().public.turn!.pausedRemainingMs).toBeUndefined();
      expect(guest.wire.latest().public.turn!.deadlineAt).toBe(deadline + remaining);
      expect(guest.wire.latest().public.turn!.primaryUsed).toBe(true);
      await tableServer!.clock.advanceTo(deadline);
      expect(room().revision).toBe(revision + 1);
    } finally { await Promise.all(players.map(person => person.context.close())); }
  });
});
