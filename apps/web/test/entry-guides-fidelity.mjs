import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto(process.env.E2E_WEB_URL ?? 'http://localhost:5173');
  await page.getByRole('button', { name: 'HOW TO PLAY' }).waitFor();
  await page.getByRole('button', { name: 'HOW TO PLAY' }).click();
  const guide = page.getByRole('dialog', { name: 'How to play' });
  await guide.waitFor();
  assert.deepEqual(await guide.evaluate(element => { const box = element.getBoundingClientRect(); return { x: box.x, y: box.y, width: box.width, height: box.height }; }), { x: 0, y: 0, width: 1440, height: 900 });
  assert.match(await guide.innerText(), /Read your private objective/i);
  assert.match(await guide.innerText(), /60\s+seconds on your turn/i);
  assert.equal(await guide.getByPlaceholder(/search items/i).count(), 0);
  const opening = await guide.locator('.rules-hero').boundingBox();
  assert.ok(opening.height < 110, 'The quick-start strip must not reserve an empty title area.');
  assert.ok((await guide.locator('.rules-chapter').first().boundingBox()).y < 160, 'Rules begin near the top.');
  await page.screenshot({ path: 'audit/screenshots/home-how-to-play-opening.png' });
  await guide.getByRole('button', { name: /Chests & items/i }).click();
  await page.waitForTimeout(800);
  assert.ok(await page.locator('.rules-scroll').evaluate(element => element.scrollTop > 500));
  assert.equal(await guide.getByRole('button', { name: /Chests & items/i }).getAttribute('aria-current'), 'page');
  await page.screenshot({ path: 'audit/screenshots/home-how-to-play-desktop.png' });
  assert.ok(await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight));
  await guide.getByRole('button', { name: /CLOSE/i }).click();
  await page.getByRole('button', { name: 'ITEM HANDBOOK' }).click();
  const items = page.getByRole('dialog', { name: 'Item handbook' });
  await items.getByPlaceholder(/search items/i).waitFor();
  assert.deepEqual(await items.evaluate(element => { const box = element.getBoundingClientRect(); return { x: box.x, y: box.y, width: box.width, height: box.height }; }), { x: 0, y: 0, width: 1440, height: 900 });
  assert.match(await items.innerText(), /ANTIDOTE/i);
  assert.equal(await items.locator('.reference-animated-item img').count(), 0);
  assert.equal(await items.locator('.reference-animated-item canvas').count(), 22);
  await page.screenshot({ path: 'audit/screenshots/home-item-handbook-desktop.png' });
  assert.deepEqual(errors, []);
  console.log('Home How to Play and separate Item Handbook passed.');
} finally { await browser.close(); }
