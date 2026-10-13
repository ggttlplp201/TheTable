import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TutorialController } from '@the-table/game/tutorial';
import { TutorialClient } from './tutorial-client';
import { hintCandidates } from './MultiplayerHints';
import { readTutorialPreferences, saveTutorialPreferences, recordTutorialMetric, TUTORIAL_STORAGE_KEY, TUTORIAL_TELEMETRY_KEY } from './tutorial-storage';
import { ownerRoom } from './test-fixtures';

describe('local tutorial persistence and transport', () => {
  let values: Map<string, string>;
  beforeEach(() => { values = new Map(); vi.stubGlobal('localStorage', { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) }); });
  afterEach(() => vi.unstubAllGlobals());
  it('persists completion, resume chapter, and opt-out without requiring an account', () => {
    expect(readTutorialPreferences().tutorialCompleted).toBe(false);
    saveTutorialPreferences({ tutorialCompleted: true, tutorialLastChapter: 6, tutorialHintsDisabled: true });
    expect(readTutorialPreferences()).toMatchObject({ tutorialCompleted: true, tutorialLastChapter: 6, tutorialHintsDisabled: true });
    values.set(TUTORIAL_STORAGE_KEY, '{bad'); expect(readTutorialPreferences().tutorialLastChapter).toBe(1);
    values.set(TUTORIAL_STORAGE_KEY, JSON.stringify({ tutorialVersion: 1, tutorialCompleted: true })); expect(readTutorialPreferences().tutorialCompleted).toBe(false);
  });
  it('bounds local telemetry and works when storage is denied', () => {
    for(let i=0;i<210;i++) recordTutorialMetric({ kind:'retry', chapter:3 });
    expect(JSON.parse(values.get(TUTORIAL_TELEMETRY_KEY)!)).toHaveLength(200);
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); } });
    expect(() => saveTutorialPreferences({ skippedForNow:true })).not.toThrow();
    expect(readTutorialPreferences()).toMatchObject({ tutorialVersion: 2, skippedForNow: true });
  });
  it('deduplicates commands and keeps wrong actions reversible', async () => {
    const controller = new TutorialController(() => 1000); controller.look(40); controller.next(); controller.next();
    const changed = vi.fn(); const client = new TutorialClient(controller, changed);
    const wrong = { roomId:'tutorial', expectedRevision:controller.room.revision, idempotencyKey:'wrong', type:'PASS_TURN', payload:{} } as const;
    const before = structuredClone(controller.room); expect((await client.command(wrong)).ok).toBe(false); expect(controller.room).toEqual(before);
    await client.command(wrong); expect(controller.retries).toBe(1);
    const medicine = controller.room.players[0]!.inventory.visible.find(item => item?.itemId === 'medicine')!;
    const good = { ...wrong, idempotencyKey:'pocket', type:'POCKET', payload:{ instanceId:medicine.instanceId,pocketIndex:0 } } as const;
    expect((await client.command(good)).ok).toBe(true); const revision=controller.room.revision;
    expect((await client.command(good)).ok).toBe(true); expect(controller.room.revision).toBe(revision); expect(controller.step).toBe('privacy');
  });
  it('offers multiplayer hints only for the owner and the relevant first occurrence', () => {
    const room = ownerRoom(); room.private.pockets[0]!.item = { instanceId:'medicine',itemId:'medicine',quantity:1 };
    expect(hintCandidates(room,true)).toEqual(['market','pocket']);
    room.public.mode='tutorial'; expect(hintCandidates(room,true)).toEqual([]);
  });
});
