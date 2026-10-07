import { expect, type Page } from '@playwright/test';

export const SESSION_KEY = 'the-table/session-v1';
export const desktopViewport = { width: 1440, height: 900 };
export const phoneViewport = { width: 390, height: 844 };

export type Session = { code: string; reconnectToken: string; playerId: string };

export async function waitForEntry(page: Page) {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Take your seat.' })).toBeVisible();
}

export async function createRoom(page: Page, name: string): Promise<Session> {
  await waitForEntry(page);
  await page.getByLabel('Your name').fill(name);
  await page.getByRole('button', { name: 'Create room' }).last().click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/^[A-Z0-9]{6}$/);
  return session(page);
}

export async function joinRoom(page: Page, code: string, name: string): Promise<Session> {
  await waitForEntry(page);
  await page.getByRole('tab', { name: 'Join room' }).click();
  await page.getByLabel('Your name').fill(name);
  await page.getByLabel('Room code').fill(code);
  await page.getByRole('button', { name: 'Join room' }).last().click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(code);
  return session(page);
}

export async function session(page: Page): Promise<Session> {
  return page.evaluate(key => JSON.parse(localStorage.getItem(key) ?? 'null'), SESSION_KEY) as Promise<Session>;
}

export async function chooseRoleAndReady(page: Page, role: string) {
  await page.getByRole('button', { name: new RegExp(`^${role}`) }).click();
  await page.getByRole('button', { name: 'Ready up' }).click();
}

export async function startTwoPlayerLobby(desktop: Page, phone: Page) {
  const host = await createRoom(desktop, 'Desktop Host');
  await joinRoom(phone, host.code, 'Phone Player');
  await chooseRoleAndReady(desktop, 'Enforcer');
  await chooseRoleAndReady(phone, 'Medic');
  await expect(desktop.getByText('Desktop Host (you)')).toBeVisible();
  await expect(phone.getByText('Desktop Host', { exact: true })).toBeVisible();
  await expect(desktop.getByText('Phone Player', { exact: true })).toBeVisible();
  await expect(phone.getByText('Phone Player (you)')).toBeVisible();
  await desktop.getByRole('button', { name: 'Start match' }).click();
  await expect(desktop.getByLabel('Your objective')).toBeVisible();
  await expect(phone.getByLabel('Your objective')).toBeVisible();
  return host;
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

