import { test, expect } from './fixtures';
import { SESSION_KEY, desktopViewport, phoneViewport, waitForEntry, createRoom, joinRoom, session, startTwoPlayerLobby, captureSocketFrames, lastPrivateObjectiveId } from './helpers';

test.describe('table lobby across desktop and phone', () => {
  test('creates, joins, assigns unique roles, readies, starts, and resolves a trade response', async ({ browser }) => {
    const desktopContext = await browser.newContext({ viewport: desktopViewport });
    const phoneContext = await browser.newContext({ viewport: phoneViewport, isMobile: true, hasTouch: true });
    const desktop = await desktopContext.newPage();
    const phone = await phoneContext.newPage();

    await startTwoPlayerLobby(desktop, phone);

    await expect(desktop.getByLabel('At the table').getByText('Medic · Active', { exact: true })).toBeVisible();
    await expect(phone.getByLabel('At the table').getByText('Enforcer · Active', { exact: true })).toBeVisible();
    await expect(desktop.getByLabel('Your actions')).toBeVisible();
    await desktop.getByRole('button', { name: 'Trade', exact: true }).click();
    await desktop.getByRole('button', { name: 'Propose Trade' }).click();
    await expect(phone.getByRole('heading', { name: 'Trade on the table' })).toBeVisible();
    await phone.getByRole('button', { name: 'Accept Trade' }).click();
    await expect(desktop.getByText('Action confirmed.')).toBeVisible();
    await desktopContext.close();
    await phoneContext.close();
  });

  test('rotates reconnect credentials and rejects the replaced page', async ({ browser }) => {
    const desktopContext = await browser.newContext({ viewport: desktopViewport });
    const phoneContext = await browser.newContext({ viewport: phoneViewport, isMobile: true, hasTouch: true });
    const desktop = await desktopContext.newPage();
    const phone = await phoneContext.newPage();
    const host = await createRoom(desktop, 'Desktop Host');
    const firstSession = await joinRoom(phone, host.code, 'Phone Player');

    const replacementContext = await browser.newContext({ viewport: phoneViewport, isMobile: true, hasTouch: true });
    const replacement = await replacementContext.newPage();
    await replacement.goto('/');
    await replacement.evaluate(([key, value]) => localStorage.setItem(key!, value!), [SESSION_KEY, JSON.stringify(firstSession)]);
    await replacement.reload();
    await expect(replacement.getByRole('heading', { level: 1 })).toHaveText(host.code);
    const rotatedSession = await session(replacement);
    expect(rotatedSession.playerId).toBe(firstSession.playerId);
    expect(rotatedSession.reconnectToken).not.toBe(firstSession.reconnectToken);

    await expect(phone.getByRole('heading', { name: 'Take your seat.' })).toBeVisible();
    await expect(phone.getByRole('tab', { name: 'Create room' })).toBeEnabled();
    await desktopContext.close();
    await phoneContext.close();
    await replacementContext.close();
  });

  test('keeps opponent private objectives out of DOM and browser storage', async ({ browser }) => {
    const desktopContext = await browser.newContext({ viewport: desktopViewport });
    const phoneContext = await browser.newContext({ viewport: phoneViewport, isMobile: true, hasTouch: true });
    const desktop = await desktopContext.newPage();
    const phone = await phoneContext.newPage();
    const desktopFrames = captureSocketFrames(desktop);
    const phoneFrames = captureSocketFrames(phone);
    await startTwoPlayerLobby(desktop, phone);

    const desktopObjective = lastPrivateObjectiveId(desktopFrames);
    const phoneObjective = lastPrivateObjectiveId(phoneFrames);
    expect(desktopObjective).toBeTruthy();
    expect(phoneObjective).toBeTruthy();
    expect(desktopObjective).not.toBe(phoneObjective);

    await desktop.getByRole('button', { name: 'Contract' }).click();
    await phone.getByRole('button', { name: 'Contract' }).click();
    const desktopObjectiveName = await desktop.getByLabel('Your objective').getByRole('heading', { level: 3 }).first().innerText();
    const phoneObjectiveName = await phone.getByLabel('Your objective').getByRole('heading', { level: 3 }).first().innerText();
    expect(phoneObjectiveName).not.toBe(desktopObjectiveName);
    await expect(phone.locator('body')).not.toContainText(desktopObjectiveName);
    await expect(desktop.locator('body')).not.toContainText(phoneObjectiveName);
    expect(phoneFrames.join('\n')).not.toContain(desktopObjective!);
    expect(desktopFrames.join('\n')).not.toContain(phoneObjective!);
    const [desktopStorage, phoneStorage] = await Promise.all([
      desktop.evaluate(() => JSON.stringify(localStorage)),
      phone.evaluate(() => JSON.stringify(localStorage)),
    ]);
    expect(phoneStorage).not.toContain(desktopObjective!);
    expect(desktopStorage).not.toContain(phoneObjective!);
    expect(desktopStorage).not.toMatch(/pocket|black market|inspection/i);
    expect(phoneStorage).not.toMatch(/pocket|black market|inspection/i);

    await desktopContext.close();
    await phoneContext.close();
  });
});

test.describe('mobile affordances', () => {
  test('has no horizontal overflow and gives every entry and lobby primary control a 56px touch target', async ({ browser }) => {
    const context = await browser.newContext({ viewport: phoneViewport, isMobile: true, hasTouch: true });
    const phone = await context.newPage();
    await waitForEntry(phone);

    expect(await phone.locator('html').evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    const entryTargets = await phone.locator('button, input').evaluateAll(elements => elements.map(element => {
      const rect = element.getBoundingClientRect();
      return { label: element.getAttribute('aria-label') ?? element.textContent?.trim() ?? element.tagName, width: rect.width, height: rect.height };
    }));
    for (const target of entryTargets) {
      expect(target.height, `${target.label} must be at least 56px high`).toBeGreaterThanOrEqual(56);
    }

    await createRoom(phone, 'Mobile Host');
    expect(await phone.locator('html').evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    const lobbyTargets = await phone.locator('.role-card, .lobby-actions .button').evaluateAll(elements => elements.map(element => {
      const rect = element.getBoundingClientRect();
      return { label: element.textContent?.trim() ?? 'control', height: rect.height };
    }));
    for (const target of lobbyTargets) expect(target.height).toBeGreaterThanOrEqual(56);
    await context.close();
  });
});
