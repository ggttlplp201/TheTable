import type { ObjectiveState } from '@the-table/game';
import { describe, expect, it } from 'vitest';
import { objectiveProgressItems } from './objective-progress';
import { ownerRoom } from './test-fixtures';

const objective = (objectiveId: string, progress: Record<string, unknown>, extra: Partial<ObjectiveState> = {}): ObjectiveState => ({
  objectiveId, status: 'ACTIVE', progress, rewardGranted: false, ...extra,
});

describe('objectiveProgressItems', () => {
  it('has a player-facing progress presentation for every v14 objective', () => {
    const room = ownerRoom().public;
    const cases: ObjectiveState[] = [
      objective('escapist', { passageToken: false }),
      objective('collector', { artifacts: 1, required: 2 }),
      objective('tycoon', { coins: 7, required: 15, successfulTrades: 0, requiredTrades: 1 }),
      objective('executioner', { targetLife: 'ACTIVE' }, { targetPlayerId: 'p2' }),
      objective('guardian', { targetLife: 'ACTIVE', throughRound: 2 }, { targetPlayerId: 'p2' }),
      objective('kingmaker', { targetLife: 'ACTIVE' }, { targetPlayerId: 'p2' }),
      objective('martyr', { firstDeathPlayerId: null }),
      objective('phoenix', { recoveredDownEvents: 1, required: 2 }),
      objective('betrayer', { tradedPlayerIds: ['p2'], eligibleTargetIds: ['p2'], betrayedPlayerIds: [] }),
      objective('extortionist', { distinctTargets: 1, qualifiedPlayerIds: ['p2'], required: 2 }),
      objective('con-artist', { bluffCompliance: true, armedRefusal: false }),
      objective('duelist', { distinctDowns: 1, qualifiedPlayerIds: ['p2'], required: 2 }),
      objective('savior', { distinctRevives: 1, qualifiedPlayerIds: ['p2'], required: 2 }),
      objective('graverobber', { distinctLoots: 1, qualifiedPlayerIds: ['p2'], required: 2 }),
      objective('poisoner', { poisonedPlayers: 1, qualifiedPlayerIds: ['p2'], required: 2 }),
      objective('chest-raider', { opened: ['STANDARD'] }),
      objective('merchant', { completed: 1, qualifiedPlayerIds: ['p2'], required: 2 }),
      objective('hidden-hand', { pickpocket: true, loot: false }),
      objective('survivor', { departedPlayers: 1, required: 2 }),
      objective('arsenal', { pistol: true, bullet: false, knife: true, armor: false }),
    ];
    expect(cases).toHaveLength(20);
    for (const state of cases) {
      const rendered = JSON.stringify(objectiveProgressItems(state, room));
      expect(rendered, state.objectiveId).not.toContain('p2');
      expect(rendered, state.objectiveId).not.toMatch(/qualifiedPlayerIds|betrayedPlayerIds|targetLife|distinctDowns/);
      expect(objectiveProgressItems(state, room).length, state.objectiveId).toBeGreaterThan(0);
    }
  });

  it('names every authoritative qualified target and betrayer step', () => {
    const room = ownerRoom().public;
    const rows = objectiveProgressItems(objective('betrayer', {
      tradedPlayerIds: ['p2'], eligibleTargetIds: ['p2'], betrayedPlayerIds: [],
    }), room);
    expect(rows).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: 'Step 1 — Complete a Trade', value: 'Traded with Bruno', complete: true }),
      expect.objectContaining({ label: 'Step 2 — Personally Down that player', value: 'Down Bruno', complete: false }),
    ]));
  });
  it('shows the new sustained Tycoon threshold even before required progress arrives', () => {
    expect(objectiveProgressItems(objective('tycoon', { coins: 14 }), ownerRoom().public)).toEqual([
      { label: 'Gold held', value: '14 / 15', complete: false },
      { label: 'Successful Trades', value: '0 / 1', complete: false },
    ]);
    const ready = objectiveProgressItems(objective('tycoon', { coins: 15, required: 15, successfulTrades: 1, requiredTrades: 1 }), ownerRoom().public);
    expect(ready.every(row => row.complete)).toBe(true);
  });
});
