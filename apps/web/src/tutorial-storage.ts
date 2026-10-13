export const TUTORIAL_STORAGE_KEY = 'the-table/tutorial-v2';
export const TUTORIAL_TELEMETRY_KEY = 'the-table/tutorial-telemetry-v2';
export const TUTORIAL_VERSION = 2;
export interface TutorialPreferences {
  tutorialVersion: number;
  tutorialCompleted: boolean;
  tutorialLastChapter: number;
  tutorialHintsDisabled: boolean;
  skippedForNow: boolean;
  seenHints: string[];
}
const defaults = (): TutorialPreferences => ({ tutorialVersion: TUTORIAL_VERSION, tutorialCompleted: false, tutorialLastChapter: 1, tutorialHintsDisabled: false, skippedForNow: false, seenHints: [] });
let memory = defaults();
export function readTutorialPreferences(): TutorialPreferences {
  let stored: string | null;
  try { stored = localStorage.getItem(TUTORIAL_STORAGE_KEY); } catch { return memory; }
  try {
    const value = JSON.parse(stored ?? 'null');
    if (!value || value.tutorialVersion !== TUTORIAL_VERSION) return defaults();
    return { ...defaults(), tutorialCompleted: value.tutorialCompleted === true, tutorialLastChapter: Math.max(1, Math.min(6, Number(value.tutorialLastChapter) || 1)), tutorialHintsDisabled: value.tutorialHintsDisabled === true, skippedForNow: value.skippedForNow === true, seenHints: Array.isArray(value.seenHints) ? value.seenHints.filter((id: unknown) => typeof id === 'string') : [] };
  } catch { return defaults(); }
}
export function saveTutorialPreferences(update: Partial<TutorialPreferences>): TutorialPreferences {
  const next = { ...readTutorialPreferences(), ...update, tutorialVersion: TUTORIAL_VERSION };
  memory = next;
  try { localStorage.setItem(TUTORIAL_STORAGE_KEY, JSON.stringify(next)); } catch { /* Training remains available without storage. */ }
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('tutorial-preferences'));
  return next;
}
export function recordTutorialMetric(metric: { kind: string; at?: number; chapter?: number; elapsedMs?: number; action?: string }) {
  try {
    const stored = JSON.parse(localStorage.getItem(TUTORIAL_TELEMETRY_KEY) ?? '[]');
    const entries = Array.isArray(stored) ? stored.slice(-199) : [];
    entries.push({ at: Date.now(), version: TUTORIAL_VERSION, ...metric });
    localStorage.setItem(TUTORIAL_TELEMETRY_KEY, JSON.stringify(entries));
  } catch { /* Local telemetry is optional. */ }
}
