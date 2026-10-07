import { setImmediate as nextEventLoop } from 'node:timers/promises';
import { RoomStore } from '@the-table/game';
import { RoomStoreAdapter } from '../src/game-adapter.js';
import type { Clock } from '../src/runtime.js';
import { createTableServer } from '../src/server.js';

export const BROWSER_EPOCH = 1_800_000_000_000;
export const LIFECYCLE_SEED = 5424;

/** Test-process only: no HTTP control route, client seed, or production import. */
export class BrowserClock implements Clock {
  private value = BROWSER_EPOCH;
  private serial = 0;
  private readonly tasks = new Map<number, { at: number; callback: () => void }>();
  now = () => this.value;
  get pendingCount(): number { return this.tasks.size; }
  setTimeout = (callback: () => void, delay: number): ReturnType<typeof setTimeout> => {
    const id = ++this.serial;
    this.tasks.set(id, { at: this.value + Math.max(1, delay), callback });
    return id as unknown as ReturnType<typeof setTimeout>;
  };
  clearTimeout = (timer: ReturnType<typeof setTimeout>): void => {
    this.tasks.delete(timer as unknown as number);
  };

  async advanceTo(target: number): Promise<void> {
    if (!Number.isSafeInteger(target) || target < this.value) throw new Error('Clock must advance to a finite monotonic integer.');
    // Run each scheduled instant, letting the runtime queue drain and reschedule.
    // setImmediate yields one event-loop turn; it does not wait for elapsed time.
    for (let iterations = 0; iterations < 10_000; iterations += 1) {
      const next = [...this.tasks.entries()].filter(([, task]) => task.at <= target)
        .sort((a, b) => a[1].at - b[1].at || a[0] - b[0])[0];
      if (!next) { this.value = target; return; }
      this.value = next[1].at;
      this.tasks.delete(next[0]);
      next[1].callback();
      await nextEventLoop();
    }
    throw new Error('Clock exceeded its scheduled-callback limit.');
  }
}

export function createBrowserHarness(origin = 'http://127.0.0.1:4173') {
  const clock = new BrowserClock();
  const game = new RoomStoreAdapter(new RoomStore({ now: clock.now, issueSessions: false }), () => LIFECYCLE_SEED);
  const errors: unknown[] = [];
  const server = createTableServer({ origin, game, clock, onError: error => errors.push(error) });
  return { server, clock, game, errors };
}
