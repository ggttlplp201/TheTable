import { test, expect } from './fixtures';
import { BROWSER_EPOCH } from '../../apps/server/test/browser-harness';
import { chooseRoleAndReady, createRoom, joinRoom, lockStartingPocket, waitForPlayableTable } from './helpers';
import { installWireProbe, observeViews, probe } from './browser-wire';

test('three-player minimum, private starting items, reconnect, and simultaneous four-player reveal', async ({ browser, tableServer }) => {
  test.setTimeout(90_000);
  const contexts = await Promise.all([
    browser.newContext({ viewport: { width: 1344, height: 900 } }),
    browser.newContext({ viewport: { width: 880, height: 630 } }),
    browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }),
    browser.newContext({ viewport: { width: 1440, height: 900 } }),
  ]);
  try {
    const pages = await Promise.all(contexts.map(context => context.newPage()));
    const wires = pages.map(observeViews);
    for (const page of pages) { await page.clock.install({ time: BROWSER_EPOCH }); await installWireProbe(page); }
    const admission = await createRoom(pages[0]!, 'Host');
    await joinRoom(pages[1]!, admission.code, 'Medic');
    await chooseRoleAndReady(pages[0]!, 'Enforcer');
    await chooseRoleAndReady(pages[1]!, 'Medic');
    await expect(pages[0]!.getByRole('button', { name: 'Need at least 3 players' })).toBeDisabled();
    const rejected = await probe(pages[0]!, 'match:start', { idempotencyKey: 'invalid-two-player-start' });
    expect(rejected.ok).toBe(false);
    await joinRoom(pages[2]!, admission.code, 'Smuggler');
    await chooseRoleAndReady(pages[2]!, 'Smuggler');
    await expect(pages[0]!.getByRole('button', { name: 'Start match' })).toBeEnabled();
    await joinRoom(pages[3]!, admission.code, 'Locksmith');
    await chooseRoleAndReady(pages[3]!, 'Locksmith');
    await pages[0]!.getByRole('button', { name: 'Start match' }).click();
    await Promise.all(pages.map(page => expect(page.getByLabel('Private match setup', { exact: true })).toBeVisible()));
    const initial = wires.map(wire => wire.latest());
    const bonusOwners = initial.flatMap((view, index) => !view.spectator && view.private.setup?.bonusItemInstanceId ? [index] : []);
    expect(bonusOwners).toHaveLength(1);
    for (const [index, view] of initial.entries()) {
      if (view.spectator) throw new Error('Unexpected spectator');
      expect(view.private.setup!.items).toHaveLength(bonusOwners[0] === index ? 4 : 3);
      expect(view.public.players.every(player => player.visibleInventory.every(item => item === null))).toBe(true);
      await expect(pages[index]!.getByLabel('First person table view', { exact: true })).toHaveCount(0);
      const setupBounds = await pages[index]!.getByLabel('Private match setup', { exact: true }).boundingBox();
      expect(setupBounds!.x).toBe(0); expect(setupBounds!.y).toBe(0);
      expect(await pages[index]!.locator('.setup-contract .reference-contract header').evaluate(element => getComputedStyle(element).color)).toBe('rgb(26, 20, 16)');
      expect(await pages[index]!.locator('html').evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
      for (const other of initial.filter(other => other !== view)) {
        if (other.spectator) continue;
        for (const item of other.private.setup!.items) expect(wires[index]!.frames.join('\n')).not.toContain(JSON.stringify(item.instanceId));
      }
    }
    await pages[0]!.screenshot({ path: 'audit/screenshots/private-setup-desktop.png', fullPage: true });
    await pages[1]!.screenshot({ path: 'audit/screenshots/private-setup-short.png', fullPage: true });
    await pages[2]!.screenshot({ path: 'audit/screenshots/private-setup-phone.png', fullPage: true });
    await expect(pages[2]!.getByRole('button', { name: 'Pocket Bag', exact: true })).toBeDisabled();
    await expect(pages[2]!.getByRole('button', { name: 'Pocket Bag', exact: true })).toContainText('Must remain visible');
    for (const [index, page] of pages.entries()) {
      if (index === bonusOwners[0]) {
        await page.locator('.setup-items button').filter({ hasText: 'SECRET BONUS' }).click();
        await page.getByRole('button', { name: 'Lock Pocket choice', exact: true }).click();
      } else await lockStartingPocket(page, ['Cloth', 'Knife', 'Poison', 'Knife'][index]!);
      if (index < pages.length - 1) {
        await expect(page.getByText(/is locked in your Pocket/)).toBeVisible();
        if (index === 0) {
          await page.reload();
          await expect(page.getByText(/is locked in your Pocket/)).toBeVisible();
        }
        expect(wires[index]!.latest().public.players.every(player => player.visibleInventory.every(item => item === null))).toBe(true);
      }
    }
    await Promise.all(pages.map(waitForPlayableTable));
    const room = tableServer!.game.read(admission.code)!;
    expect(room.round).toMatchObject({ number: 1, phase: 'TURN' });
    expect(room.shop).toBeUndefined();
    expect(room.chests!.map(chest => chest.availability)).toEqual(['AVAILABLE', 'HIDDEN']);
    for (const wire of wires) for (const view of wire.views) {
      if (view.public.round?.phase === 'SETUP') expect(view.public.players.every(player => player.visibleInventory.every(item => item === null))).toBe(true);
      if (view.public.round?.phase === 'TURN') expect(view.public.players.every(player => player.visibleInventory.filter(Boolean).length >= 2)).toBe(true);
    }
    const bonusOwner = initial[bonusOwners[0]!]!;
    if (bonusOwner.spectator) throw new Error('Unexpected spectator');
    for (const wire of wires) expect(JSON.stringify(wire.latest().public)).not.toContain(bonusOwner.private.setup!.bonusItemInstanceId);
  } finally { await Promise.all(contexts.map(context => context.close())); }
});
