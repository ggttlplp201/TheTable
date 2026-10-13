import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { OBJECTIVE_REVEAL_MS, ObjectiveIntroduction, objectiveRevealKey } from './ObjectiveIntroduction';
import { ownerRoom, spectatorRoom } from './test-fixtures';

describe('private objective introduction', () => {
  it('only creates a reveal key for a recent authorized match start', () => {
    const room = ownerRoom();
    room.public.events = [{ id: 'start', sequence: 1, at: Date.now(), kind: 'MATCH_STARTED', targetIds: [], publicText: 'The match begins.' }];
    expect(objectiveRevealKey(room, 'p1')).toContain('start:p1');
    room.public.events[0]!.at -= 31_000;
    expect(objectiveRevealKey(room, 'p1')).toBeUndefined();
    expect(objectiveRevealKey(spectatorRoom(), 'p1')).toBeUndefined();
  });

  it('shows only the authorized player contract and round countdown', () => {
    const room = ownerRoom();
    const html = renderToStaticMarkup(<ObjectiveIntroduction room={room} onComplete={() => {}} />);
    expect(html).toContain('Your objective');
    expect(html).toContain('CONTRACT · PRIVATE');
    expect(html).toContain('ROUND I');
    expect(html).toContain('ROUND I · 12');
    expect(OBJECTIVE_REVEAL_MS).toBe(12_000);
    expect(html).toContain('Arsenal');
    expect(html).not.toContain('Owner private message sentinel');
  });
});
