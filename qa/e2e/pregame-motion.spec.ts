import { test, expect } from './fixtures';
import { createRoom, waitForEntry } from './helpers';

test('join shows only the actual room outcome, with no reference state gallery', async ({ page }) => {
  await waitForEntry(page);
  await page.getByRole('button', { name: 'JOIN ROOM', exact: true }).click();
  await expect(page.getByText('OTHER STATES')).toHaveCount(0);
  await expect(page.getByText('SEAT FOUND', { exact: false })).toHaveCount(0);
  await expect(page.getByText('TABLE FULL', { exact: false })).toHaveCount(0);
  await page.getByLabel('Room Code', { exact: true }).fill('ZZZZZZ');
  await page.getByLabel('NAME AT THE TABLE').fill('Guest');
  await page.getByRole('button', { name: 'TAKE A SEAT' }).click();
  await expect(page.getByRole('alert')).toContainText(/room|code|table/i);
  await expect(page.getByRole('alert')).toHaveCount(1);
  await page.screenshot({ path: 'audit/screenshots/join-actual-error.png' });
});

test('reference rig idles in selection and lobby, and freezes for reduced motion', async ({ page }) => {
  await createRoom(page, 'Motion Host');
  const portraits = page.locator('.role-select-grid canvas.reference-portrait');
  await expect(portraits).toHaveCount(6);
  await expect(portraits.first()).toHaveAttribute('data-motion', 'idle');
  const before = await portraits.first().evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL());
  await expect.poll(() => portraits.first().getAttribute('data-idle-time')).not.toBe('0.000');
  await expect.poll(() => portraits.first().evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL())).not.toBe(before);
  await page.screenshot({ path: 'audit/screenshots/role-selection-idle.png' });

  await page.getByRole('button', { name: /^Enforcer/ }).click();
  const portrait = page.locator('.lobby-role-plaque canvas.reference-portrait');
  await expect(portrait).toHaveAttribute('data-motion', 'idle');
  await expect.poll(() => portrait.getAttribute('data-idle-time')).not.toBe('0.000');
  await page.screenshot({ path: 'audit/screenshots/lobby-character-idle.png' });

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(portrait).toHaveAttribute('data-motion', 'reduced');
  const still = await portrait.evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL());
  await page.waitForTimeout(250);
  expect(await portrait.evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL())).toBe(still);
  await expect(portrait).toHaveAttribute('data-idle-time', '0.000');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect(portrait).toHaveAttribute('data-motion', 'idle');
  await expect.poll(() => portrait.evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL())).not.toBe(still);
});
