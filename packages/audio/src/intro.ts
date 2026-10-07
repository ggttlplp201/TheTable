import type { IntroController, IntroState } from './types.js';

export const INTRO_DURATION_MS = 2400;

export function createIntroController(
  durationMs = INTRO_DURATION_MS,
  clock: () => number = () => Date.now(),
): IntroController {
  let current: IntroState = { phase: 'IDLE' };
  const at = (now?: number) => now ?? clock();

  return {
    state: () => ({ ...current }),
    arm: (now) => {
      current = { phase: 'ARMED', ...(now === undefined ? {} : { startedAt: now }) };
      return { ...current };
    },
    start: (now) => {
      const value = at(now);
      current = { phase: 'PLAYING', startedAt: value, endsAt: value + durationMs };
      return { ...current };
    },
    skip: (now) => {
      current = { phase: 'SKIPPED', ...(now === undefined ? {} : { startedAt: now, endsAt: now }) };
      return { ...current };
    },
    tick: (now) => {
      const value = at(now);
      if (current.phase === 'PLAYING' && current.endsAt !== undefined && value >= current.endsAt) {
        current = { ...current, phase: 'COMPLETE' };
      }
      return { ...current };
    },
    dispose: () => {
      current = { phase: 'IDLE' };
    },
  };
}
