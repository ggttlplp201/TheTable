import { test, expect } from './fixtures';
import { waitForEntry } from './helpers';

test('normal-post home fills the viewport, animates, resizes in reduced motion, and releases its context', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await waitForEntry(page);
  const canvas = page.locator('.entry-vhs-canvas');
  await expect(canvas).toHaveAttribute('data-motion', 'idle');
  expect(await canvas.boundingBox()).toEqual({ x: 0, y: 0, width: 1440, height: 900 });
  for (const selector of ['.entry-copy h1', '.entry-menu', '.entry-links']) {
    expect((await page.locator(selector).boundingBox())!.x).toBe(72);
  }
  await expect(page.locator('.entry-vhs-osd')).toHaveCount(0);
  await expect(page.getByText(/^(?:▶\s*)?PLAY$/)).toHaveCount(0);
  await expect(page.getByText('RECOMMENDED: 3–4 PLAYERS', { exact: true })).toBeVisible();
  await expect(canvas).toHaveAttribute('width', '480');
  await expect(canvas).toHaveAttribute('height', '300');
  const start = await canvas.screenshot();
  await expect.poll(async () => !(await canvas.screenshot()).equals(start)).toBe(true);
  await page.screenshot({ path: 'audit/screenshots/home-normal-post-desktop.png' });

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(canvas).toHaveAttribute('data-motion', 'reduced');
  const still = await canvas.screenshot();
  expect(await canvas.screenshot()).toEqual(still);
  await page.setViewportSize({ width: 1180, height: 740 });
  await expect(canvas).toHaveAttribute('width', '393');
  await expect(canvas).toHaveAttribute('height', '247');
  expect(await canvas.boundingBox()).toEqual({ x: 0, y: 0, width: 1180, height: 740 });
  for (const selector of ['.entry-copy h1', '.entry-menu', '.entry-links']) {
    expect((await page.locator(selector).boundingBox())!.x).toBe(59);
  }
  const resizedStill = await canvas.screenshot();
  expect(await canvas.screenshot()).toEqual(resizedStill);
  await page.screenshot({ path: 'audit/screenshots/home-normal-post-reduced-resized.png' });

  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect(canvas).toHaveAttribute('data-motion', 'idle');
  await expect.poll(async () => !(await canvas.screenshot()).equals(resizedStill)).toBe(true);
  const handle = await canvas.elementHandle();
  await page.getByRole('button', { name: 'JOIN ROOM', exact: true }).click();
  await expect(canvas).toHaveCount(0);
  await expect.poll(() => handle!.evaluate((element: HTMLCanvasElement) => element.getContext('webgl2')?.isContextLost())).toBe(true);
  await page.getByRole('button', { name: '← TITLE', exact: true }).click();
  await expect(canvas).toHaveCount(1);
  await expect(canvas).toHaveAttribute('data-motion', 'idle');
  expect(errors).toEqual([]);
});

test('home navigation stays usable when WebGL is unavailable', async ({ page }) => {
  await page.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...args: unknown[]) {
      if (type.includes('webgl')) return null;
      return Reflect.apply(getContext, this, [type, ...args]);
    } as typeof getContext;
  });
  await waitForEntry(page);
  await expect(page.locator('.entry-vhs-canvas')).toHaveCount(0);
  await page.getByRole('button', { name: 'HOW TO PLAY', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'How to play' })).toBeVisible();
  await page.getByRole('button', { name: /CLOSE/ }).click();
  await page.getByRole('button', { name: 'JOIN ROOM', exact: true }).click();
  await expect(page.getByLabel('Room Code', { exact: true })).toBeVisible();
});
