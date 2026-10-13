export const MARKET_ENTRY_DURATION_MS = 1_400;

/** Ease-out quint keeps the approach readable without making the counter feel sluggish. */
export function marketEntryProgress(elapsedMs: number, reducedMotion = false): number {
  if (reducedMotion) return 1;
  const value = Math.max(0, Math.min(1, elapsedMs / MARKET_ENTRY_DURATION_MS));
  return 1 - (1 - value) ** 5;
}
