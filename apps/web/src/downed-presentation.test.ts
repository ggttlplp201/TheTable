import { describe, expect, it } from 'vitest';
import { ownerRoom } from './test-fixtures';
import { createDownedPresentation, updateDownedPresentation, presentedHealth, downedFallProgress } from './downed-presentation';

const now = 100_000;
function lethal(itemId = 'pistol') {
  const before = ownerRoom().public; before.players[0]!.hp = 1;
  const after = structuredClone(before); after.revision++;
  after.players[0]!.hp = 0; after.players[0]!.life = 'DOWNED';
  after.events = ['WEAPON_USED', 'DAMAGE', 'DOWNED'].map((kind, index) => ({ id: `hit-${index}`, sequence: index + 1, at: now, kind, actorId: 'p2', targetIds: ['p1'], publicText: '', ...(index === 0 ? { presentation: { itemId } } : {}) }));
  return { before, after };
}

describe('downed presentation timing', () => {
  it.each([['pistol', 1.5 / 2.8 * 800], ['knife', .9 / 2.7 * 800]] as const)('waits for %s contact before showing zero HP', (weapon, delay) => {
    const { before, after } = lethal(weapon);
    const state = updateDownedPresentation(createDownedPresentation(before, true), after, now, true);
    expect(state.pending[0]?.until).toBe(now + delay);
    expect(presentedHealth(after, state.pending).players[0]).toMatchObject({ hp: 1, life: 'ACTIVE' });
    expect(after.players[0]).toMatchObject({ hp: 0, life: 'DOWNED' });
    const settled = updateDownedPresentation(state, after, now + delay, true);
    expect(presentedHealth(after, settled.pending)).toBe(after);
  });
  it('keeps the impact deadline through duplicate and later room updates', () => {
    const { before, after } = lethal();
    const state = updateDownedPresentation(createDownedPresentation(before, true), after, now, true);
    const next = structuredClone(after); next.revision++;
    expect(updateDownedPresentation(state, next, now + 100, true).pending).toEqual(state.pending);
    expect(updateDownedPresentation(state, after, now + 200, true).pending).toEqual(state.pending);
  });
  it('cancels pending visuals on revival, death, new match, or reduced motion', () => {
    const { before, after } = lethal();
    const state = updateDownedPresentation(createDownedPresentation(before, true), after, now, true);
    for (const life of ['ACTIVE', 'DEAD'] as const) {
      const next = structuredClone(after); next.revision++; next.players[0]!.life = life;
      expect(updateDownedPresentation(state, next, now + 100, true).pending).toEqual([]);
    }
    const rematch = structuredClone(after); rematch.id = 'new-room';
    expect(updateDownedPresentation(state, rematch, now + 100, true).pending).toEqual([]);
    expect(updateDownedPresentation(state, after, now + 100, false).pending).toEqual([]);
  });
  it('does not replay initial/reconnected downed state, stale events, or poison deaths', () => {
    const { before, after } = lethal();
    expect(createDownedPresentation(after, true).pending).toEqual([]);
    expect(updateDownedPresentation(createDownedPresentation(before, true), after, now + 6000, true).pending).toEqual([]);
    after.events![1]!.kind = 'POISON_DAMAGE';
    expect(updateDownedPresentation(createDownedPresentation(before, true), after, now, true).pending).toEqual([]);
  });
  it('samples a continuous, bounded fall with a soft landing', () => {
    expect(downedFallProgress(0)).toBe(0);
    expect(downedFallProgress(.85)).toBe(1);
    expect(downedFallProgress(10)).toBe(1);
    let previous = 0;
    for (let t = .01; t < .85; t += .01) {
      const progress = downedFallProgress(t);
      expect(progress).toBeGreaterThan(previous); expect(progress).toBeLessThan(1); previous = progress;
    }
  });
});
