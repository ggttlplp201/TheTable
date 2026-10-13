import { describe, expect, it } from 'vitest';
import { MARKET_ENTRY_DURATION_MS, marketEntryProgress } from './market-entry';

describe('market camera entry', () => {
  it('uses a measured approach rather than cutting immediately to the counter', () => {
    expect(MARKET_ENTRY_DURATION_MS).toBeGreaterThanOrEqual(1_200);
    expect(marketEntryProgress(0)).toBe(0);
    expect(marketEntryProgress(MARKET_ENTRY_DURATION_MS / 3)).toBeGreaterThan(0);
    expect(marketEntryProgress(MARKET_ENTRY_DURATION_MS / 3)).toBeLessThan(1);
    expect(marketEntryProgress(MARKET_ENTRY_DURATION_MS)).toBe(1);
    expect(marketEntryProgress(0, true)).toBe(1);
  });
});
