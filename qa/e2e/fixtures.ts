import { test as base, expect } from '@playwright/test';
import { createBrowserHarness } from '../../apps/server/test/browser-harness';

export type BrowserHarness = ReturnType<typeof createBrowserHarness>;
export const test = base.extend<{ tableServer: BrowserHarness | undefined }>({
  tableServer: [async ({}, use) => {
    // Existing smoke tests may target an external deployment. Lifecycle tests
    // explicitly skip there because a deployment must never accept clock input.
    if (process.env.E2E_EXTERNAL_SERVER) { await use(undefined); return; }
    const url = new URL(process.env.E2E_SERVER_URL ?? 'http://127.0.0.1:3101');
    if (url.hostname !== '127.0.0.1' || url.protocol !== 'http:' || !url.port) {
      throw new Error('The in-process E2E server requires an explicit loopback HTTP port.');
    }
    const harness = createBrowserHarness(process.env.E2E_WEB_URL ?? 'http://127.0.0.1:4173');
    try {
      await harness.server.listen(Number(url.port), '127.0.0.1');
      await use(harness);
    } finally {
      await harness.server.close();
      expect(harness.errors, 'runtime errors').toEqual([]);
      expect(harness.clock.pendingCount, 'all scheduled callbacks are torn down').toBe(0);
    }
  }, { auto: true }],
});
export { expect };
