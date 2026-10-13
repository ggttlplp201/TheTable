import { expect, type Page } from '@playwright/test';

export const SESSION_KEY = 'the-table/session-v1';
export const desktopViewport = { width: 1440, height: 900 };
export const phoneViewport = { width: 390, height: 844 };

export type Session = { code: string; reconnectToken: string; playerId: string };

export async function waitForEntry(page: Page) {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'The Table', exact: true })).toBeVisible();
  const skipTraining = page.getByRole('button', { name: 'SKIP FOR NOW', exact: true });
  if (await skipTraining.isVisible()) await skipTraining.click();
}

export async function createRoom(page: Page, name: string): Promise<Session> {
  await waitForEntry(page);
  await page.getByRole('button', { name: /create room/i }).click();
  await page.getByLabel(/name at the table/i).fill(name);
  await page.getByRole('button', { name: /^create room$/i }).click();
  await expect(page.getByRole('heading', { name: 'Choose your starting kit', exact: true })).toBeVisible();
  return session(page);
}

export async function joinRoom(page: Page, code: string, name: string): Promise<Session> {
  await waitForEntry(page);
  await page.getByRole('button', { name: /^join room$/i }).click();
  await page.getByLabel(/name at the table/i).fill(name);
  await page.getByLabel(/room code/i).fill(code);
  await page.getByRole('button', { name: /take a seat/i }).click();
  await expect(page.getByRole('heading', { name: 'Choose your starting kit', exact: true })).toBeVisible();
  return session(page);
}

export async function session(page: Page): Promise<Session> {
  return page.evaluate(key => JSON.parse(localStorage.getItem(key) ?? 'null'), SESSION_KEY) as Promise<Session>;
}

export async function chooseRoleAndReady(page: Page, role: string) {
  await page.getByRole('button', { name: new RegExp(`^${role}`) }).click();
  await page.getByRole('button', { name: /ready up/i }).click();
}

/** The scene mounts before arrival and the private-objective presentation finish. */
export async function waitForPlayableTable(page: Page) {
  // Several software-rendered clients share one GPU in this harness. Wait for
  // the setup acknowledgement and scene mount with the same budget as arrival.
  await expect(page.getByLabel('First person table view', { exact: true })).toBeVisible({ timeout: 25_000 });
  // Arrival and the 12-second contract reveal run consecutively.
  await expect(page.getByLabel('At the table', { exact: true })).toBeVisible({ timeout: 40_000 });
  await expect(page.locator('.objective-introduction')).toHaveCount(0);
  await expect(page.locator('.table-arrival')).toHaveCount(0);
}

export async function lockStartingPocket(page: Page, itemName: string) {
  await expect(page.getByLabel('Private match setup', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: `Pocket ${itemName}`, exact: true }).first().click();
  await page.getByRole('button', { name: 'Lock Pocket choice', exact: true }).click();
}

export async function startThreePlayerLobby(desktop: Page, phone: Page) {
  const host = await createRoom(desktop, 'Desktop Host');
  await joinRoom(phone, host.code, 'Phone Player');
  const thirdContext = await desktop.context().browser()!.newContext({ viewport: desktopViewport });
  const third = await thirdContext.newPage();
  await joinRoom(third, host.code, 'Third Player');
  await chooseRoleAndReady(third, 'Smuggler');
  await chooseRoleAndReady(desktop, 'Enforcer');
  await chooseRoleAndReady(phone, 'Medic');
  await expect(desktop.locator('.lobby-seat').filter({ hasText: 'DESKTOP HOST' })).toBeVisible();
  await expect(phone.locator('.lobby-seat').filter({ hasText: 'DESKTOP HOST' })).toBeVisible();
  await expect(desktop.locator('.lobby-seat').filter({ hasText: 'PHONE PLAYER' })).toBeVisible();
  await expect(phone.locator('.lobby-seat').filter({ hasText: 'PHONE PLAYER' })).toBeVisible();
  await desktop.getByRole('button', { name: 'Start match' }).click();
  await lockStartingPocket(desktop, 'Cloth');
  await lockStartingPocket(phone, 'Knife');
  await lockStartingPocket(third, 'Poison');
  await Promise.all([waitForPlayableTable(desktop), waitForPlayableTable(phone)]);
  return { ...host, thirdContext };
}

export function captureSocketFrames(page: Page) {
  const frames: string[] = [];
  page.on('websocket', socket => socket.on('framereceived', frame => frames.push(String(frame.payload))));
  return frames;
}

export function lastPrivateObjectiveId(frames: string[]): string | undefined {
  for (const frame of [...frames].reverse()) {
    if (!frame.startsWith('42')) continue;
    try {
      const [event, payload] = JSON.parse(frame.slice(2)) as [string, { private?: { objective?: { objectiveId?: string } } }];
      const objectiveId = event === 'room:view' ? payload.private?.objective?.objectiveId : undefined;
      if (objectiveId) return objectiveId;
    } catch {
      // Socket.IO may send unrelated non-JSON control frames alongside room snapshots.
    }
  }
  return undefined;
}
