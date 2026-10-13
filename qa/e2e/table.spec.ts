import { test, expect } from './fixtures';
import { observeViews } from './browser-wire';
import { SESSION_KEY, desktopViewport, phoneViewport, waitForEntry, createRoom, joinRoom, session, startThreePlayerLobby, captureSocketFrames, lastPrivateObjectiveId } from './helpers';

test.describe('desktop sound', () => {
  test('unlocks Web Audio on the first trusted interaction and plays confirmation', async ({ page }) => {
    await page.addInitScript(() => {
      const NativeAudioContext = window.AudioContext;
      const nativeSetInterval = window.setInterval.bind(window);
      const stats = { contexts: 0, resumes: 0, oscillatorStarts: 0, musicIntervals: 0 };
      Object.defineProperty(window, '__tableAudioStats', { value: stats });
      window.setInterval = ((handler: TimerHandler, timeout?: number, ...args: unknown[]) => {
        if (timeout === 150) stats.musicIntervals += 1;
        return nativeSetInterval(handler, timeout, ...args);
      }) as typeof window.setInterval;
      class TrackedAudioContext extends NativeAudioContext {
        constructor(options?: AudioContextOptions) {
          super(options);
          stats.contexts += 1;
        }
        override resume(): Promise<void> {
          stats.resumes += 1;
          return super.resume();
        }
        override createOscillator(): OscillatorNode {
          const oscillator = super.createOscillator();
          const start = oscillator.start.bind(oscillator);
          oscillator.start = (when?: number) => {
            stats.oscillatorStarts += 1;
            start(when);
          };
          return oscillator;
        }
      }
      window.AudioContext = TrackedAudioContext;
    });
    await waitForEntry(page);
    await expect(page.getByText('BARTER · THREATEN · CONCEAL · LEAVE', { exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'SETTINGS · AUDIO' }).click();
    const manualEnable = page.getByRole('button', { name: 'ENABLE SOUND' });
    if (await manualEnable.isVisible()) await manualEnable.click();
    await expect(manualEnable).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => (window as unknown as { __tableAudioStats: { contexts: number } }).__tableAudioStats.contexts)).toBe(1);
    const stats = await page.evaluate(() => (window as unknown as { __tableAudioStats: { contexts: number; resumes: number; oscillatorStarts: number; musicIntervals: number } }).__tableAudioStats);
    expect(stats.resumes).toBeGreaterThanOrEqual(1);
    expect(stats.oscillatorStarts).toBeGreaterThanOrEqual(1);
    expect(stats.musicIntervals).toBe(1);
  });

  test('keeps every interactive settings label on the readable reference ink', async ({ page }) => {
    await waitForEntry(page);
    await page.getByRole('button', { name: 'SETTINGS · AUDIO' }).click();
    const expectedInk = 'rgb(216, 204, 176)';
    const readableSelectors = [
      '.entry-utility-overlay .reference-text-size button:not(.selected)',
      '.entry-utility-overlay .reference-setting-toggle:not(.future-setting) > span:first-child',
      '.entry-utility-overlay .reference-mute',
    ];
    for (const selector of readableSelectors) {
      const colors = await page.locator(selector).evaluateAll(elements => elements.map(element => getComputedStyle(element).color));
      expect(colors.length, `${selector} must be present`).toBeGreaterThan(0);
      expect(colors, `${selector} must use readable reference ink`).toEqual(colors.map(() => expectedInk));
    }
  });
});

test.describe('table lobby across desktop and phone', () => {
  test.setTimeout(60_000);
  test('creates, joins, assigns unique roles, readies, starts, and resolves a trade response', async ({ browser }) => {
    test.setTimeout(90_000);
    const desktopContext = await browser.newContext({ viewport: desktopViewport });
    const phoneContext = await browser.newContext({ viewport: desktopViewport });
    const desktop = await desktopContext.newPage();
    const phone = await phoneContext.newPage();

    const hostWire = observeViews(desktop);
    const guestWire = observeViews(phone);
    const { thirdContext } = await startThreePlayerLobby(desktop, phone);

    const opening = hostWire.latest();
    expect(opening.public).not.toHaveProperty('sideJobsByPlayer');
    expect('private' in opening && opening.private.tasks?.jobs).toHaveLength(2);
    await desktop.keyboard.press('j');
    await expect(desktop.locator('.tasks-popup li')).toHaveCount(2);
    await desktop.keyboard.press('j');
    await expect(desktop.getByRole('button', { name: /PASS TURN/ })).toBeVisible();

    await expect(desktop.getByLabel('At the table').getByText('PHONE PLAYER', { exact: true })).toBeVisible();
    await expect(phone.getByLabel('At the table').getByText('DESKTOP HOST', { exact: true })).toBeVisible();
    await expect(desktop.getByLabel('Your actions')).toBeVisible();
    await desktop.getByRole('button', { name: /Trade/i }).click();
    await desktop.getByRole('button', { name: 'Propose Trade' }).click();
    await expect(phone.getByRole('heading', { name: 'Trade offer' })).toBeVisible();
    await phone.getByRole('button', { name: 'Accept Trade' }).click();
    await expect.poll(() => hostWire.latest().public.turn?.activeSeat).toBe(1);
    const nextTurn = hostWire.latest().public.turn!;
    expect(nextTurn.deadlineAt - nextTurn.startedAt).toBe(60_000);
    await expect(phone.getByRole('button', { name: /PASS TURN/ })).toBeVisible();
    await phone.keyboard.press('Space');
    await expect.poll(() => guestWire.latest().public.turn?.activeSeat).toBe(2);
    await expect(desktop.getByRole('button', { name: /PASS TURN/ })).toHaveCount(0);
    await thirdContext.close();
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
    await expect(replacement.getByRole('heading', { name: 'Choose your starting kit', exact: true })).toBeVisible();
    const rotatedSession = await session(replacement);
    expect(rotatedSession.playerId).toBe(firstSession.playerId);
    expect(rotatedSession.reconnectToken).not.toBe(firstSession.reconnectToken);

    await expect(phone.getByRole('alert')).toContainText(/seat was reconnected in another browser/i);
    await expect(phone.getByRole('button', { name: /title/i })).toBeEnabled();
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
    const { thirdContext } = await startThreePlayerLobby(desktop, phone);

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
    await thirdContext.close();

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
    for (const target of entryTargets.filter(target => target.height > 0)) {
      expect(target.height, `${target.label} must be at least 44px high`).toBeGreaterThanOrEqual(44);
    }
    const entryPrimaryTargets = await phone.locator('.entry-form button, .entry-form input').evaluateAll(elements => elements.map(element => {
      const rect = element.getBoundingClientRect();
      return { label: element.getAttribute('aria-label') ?? element.textContent?.trim() ?? element.tagName, height: rect.height };
    }));
    for (const target of entryPrimaryTargets.filter(target => target.height > 0)) {
      expect(target.height, `${target.label} must be at least 56px high`).toBeGreaterThanOrEqual(56);
    }

    await createRoom(phone, 'Mobile Host');
    expect(await phone.locator('html').evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    const roleTargets = await phone.locator('.role-select-card, .role-back').evaluateAll(elements => elements.map(element => {
      const rect = element.getBoundingClientRect();
      return { label: element.textContent?.trim() ?? 'control', height: rect.height };
    }));
    for (const target of roleTargets.filter(target => target.height > 0)) expect(target.height).toBeGreaterThanOrEqual(44);
    const rolePrimaryTargets = await phone.locator('.role-select-card').evaluateAll(elements => elements.map(element => {
      const rect = element.getBoundingClientRect();
      return { label: element.textContent?.trim() ?? 'role', height: rect.height };
    }));
    for (const target of rolePrimaryTargets.filter(target => target.height > 0)) expect(target.height).toBeGreaterThanOrEqual(56);
    await phone.getByRole('button', { name: /^Enforcer/i }).click();
    const lobbyTargets = await phone.locator('.lobby-side .button').evaluateAll(elements => elements.map(element => {
      const rect = element.getBoundingClientRect();
      return { label: element.textContent?.trim() ?? 'control', height: rect.height };
    }));
    for (const target of lobbyTargets.filter(target => target.height > 0)) expect(target.height).toBeGreaterThanOrEqual(44);
    const lobbyPrimaryTargets = await phone.getByRole('button', { name: /^(ready up|not ready|start match|waiting for players)$/i }).evaluateAll(elements => elements.map(element => {
      const rect = element.getBoundingClientRect();
      return { label: element.textContent?.trim() ?? 'primary lobby control', height: rect.height };
    }));
    for (const target of lobbyPrimaryTargets.filter(target => target.height > 0)) expect(target.height).toBeGreaterThanOrEqual(56);
    await context.close();
  });
});
