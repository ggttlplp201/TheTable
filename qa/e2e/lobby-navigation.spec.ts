import { test, expect } from './fixtures';
import { createRoom, joinRoom, SESSION_KEY, waitForEntry } from './helpers';

test('How to Play opens at the content, without an empty title area or PLAY overlay', async ({ page }) => {
  await waitForEntry(page);
  await expect(page.getByText(/^(?:▶\s*)?PLAY$/)).toHaveCount(0);
  await page.getByRole('button', { name: 'HOW TO PLAY', exact: true }).click();
  const guide = page.getByRole('dialog', { name: 'How to play' });
  expect(await guide.boundingBox()).toEqual({ x: 0, y: 0, width: 1440, height: 900 });
  expect((await guide.locator('.rules-hero').boundingBox())!.height).toBeLessThan(110);
  expect((await guide.locator('#rules-goal').boundingBox())!.y).toBeLessThan(160);
  await page.screenshot({ path: 'audit/screenshots/home-how-to-play-opening.png' });
  await guide.getByRole('button', { name: /Turns & rounds/ }).click();
  await expect(guide.getByRole('button', { name: /Turns & rounds/ })).toHaveAttribute('aria-current', 'page');
  await guide.getByRole('button', { name: /CLOSE/ }).click();
  await expect(page.getByRole('heading', { name: 'The Table', exact: true })).toBeVisible();
});

test('character hover and keyboard focus highlight without selecting, and Return Home works before choosing', async ({ page, tableServer }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const room = await createRoom(page, 'Selection Host');
  const card = page.getByRole('button', { name: /^Medic/ });
  const normalBorder = await card.evaluate(element => getComputedStyle(element).borderTopColor);
  await card.hover();
  await expect(card).toHaveCSS('border-top-color', 'rgb(224, 160, 64)');
  await expect(card).toHaveCSS('background-color', 'rgb(41, 32, 22)');
  await expect(card).toHaveAttribute('aria-pressed', 'false');
  await page.screenshot({ path: 'audit/screenshots/role-selection-hover.png' });
  await page.mouse.move(0, 0);
  await expect(card).toHaveCSS('border-top-color', normalBorder);
  await page.getByRole('button', { name: /RETURN HOME/ }).focus();
  await page.keyboard.press('Tab');
  const firstCard = page.getByRole('button', { name: /^Enforcer/ });
  await expect(firstCard).toBeFocused();
  await expect(firstCard).toHaveCSS('border-top-color', 'rgb(224, 160, 64)');
  await expect(firstCard).toHaveAttribute('aria-pressed', 'false');
  await page.getByRole('button', { name: /RETURN HOME/ }).click();
  await expect(page.getByRole('heading', { name: 'The Table', exact: true })).toBeVisible();
  expect(await page.evaluate(key => localStorage.getItem(key), SESSION_KEY)).toBeNull();
  if (tableServer) expect(tableServer.game.read(room.code)).toBeUndefined();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'The Table', exact: true })).toBeVisible();
  await createRoom(page, 'Selection Host');
  await expect(page.getByRole('heading', { name: 'Choose your starting kit' })).toBeVisible();
});

test('leaving frees a lobby seat and character, then transfers host without moving remaining seats', async ({ page, browser, tableServer }) => {
  test.setTimeout(60_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const guestContext = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  const guest = await guestContext.newPage();
  try {
    const hostSession = await createRoom(page, 'Navigation Host');
    await page.getByRole('button', { name: /^Enforcer/ }).click();
    await joinRoom(guest, hostSession.code, 'Navigation Guest');
    const taken = guest.getByRole('button', { name: /^Enforcer/ });
    await expect(taken).toBeDisabled();
    const unavailableBorder = await taken.evaluate(element => getComputedStyle(element).borderTopColor);
    await taken.hover();
    await expect(taken).toHaveCSS('border-top-color', unavailableBorder);
    await guest.getByRole('button', { name: /^Medic/ }).click();
    await expect(page.locator('.lobby-seat').filter({ hasText: 'NAVIGATION GUEST' })).toContainText('MEDIC');
    await guest.getByRole('button', { name: /RETURN HOME/ }).click();
    await expect(guest.getByRole('heading', { name: 'The Table', exact: true })).toBeVisible();
    await expect(page.locator('.lobby-seat.empty')).toHaveCount(3);
    await page.getByRole('button', { name: 'CHANGE ROLE' }).click();
    await expect(page.getByRole('button', { name: /^Medic/ })).toBeEnabled();
    await page.getByRole('button', { name: /^Enforcer/ }).click();

    const rejoined = await joinRoom(guest, hostSession.code, 'Navigation Guest');
    await guest.getByRole('button', { name: /^Medic/ }).click();
    await page.getByRole('button', { name: /RETURN HOME/ }).click();
    await expect(page.getByRole('heading', { name: 'The Table', exact: true })).toBeVisible();
    const newHost = guest.locator('.lobby-seat.self');
    await expect(newHost).toContainText('HOST');
    await expect(newHost.locator('.seat-index')).toHaveText('II');
    await expect(guest.locator('.lobby-seat').first()).toContainText('EMPTY SEAT');
    await expect(guest.locator('.lobby-seat .seat-index')).toHaveText(['I', 'II', 'III', 'IV']);
    if (tableServer) expect(tableServer.game.read(hostSession.code)?.hostPlayerId).toBe(rejoined.playerId);
    await guest.screenshot({ path: 'audit/screenshots/lobby-return-home.png' });
    await guest.getByRole('button', { name: /RETURN HOME/ }).click();
    await expect(guest.getByRole('heading', { name: 'The Table', exact: true })).toBeVisible();
    if (tableServer) expect(tableServer.game.read(hostSession.code)).toBeUndefined();
  } finally {
    await guestContext.close();
  }
});
