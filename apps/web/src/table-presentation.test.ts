import { describe, expect, it } from 'vitest';
import type { PublicRoomView } from '@the-table/game';
import { ARRIVAL_SEEN_KEY, PublicPresentationObserver, arrivalEligible, hasSeenArrival, hasStartedArrival, publicImpactTilt, publicSeats, rememberArrival, rememberArrivalStart } from './table-presentation';
import { ownerRoom } from './test-fixtures';

const now = 100_000;
function room(): PublicRoomView {
  const view = ownerRoom().public;
  view.events = [{ id: 'start', sequence: 1, at: now, kind: 'MATCH_STARTED', publicText: '', targetIds: [] }];
  return view;
}
function event(view: PublicRoomView, kind: string, extras = {}) {
  view.revision += 1;
  view.events!.push({ id: `event-${view.revision}`, sequence: view.events!.length + 1, at: now, kind, actorId: 'p1', targetIds: ['p2'], publicText: 'Medicine Pistol Black Chest secret prose', ...extras });
}
describe('authoritative public presentation boundary', () => {
  it('samples impact tilt absolutely at any frame rate, including a transition to Downed', () => {
    for (let frame = 0; frame < 240; frame++) expect(publicImpactTilt('ACTIVE', 0.3)).toBeCloseTo(0.12);
    expect(publicImpactTilt('DOWNED', 0.3)).toBeCloseTo(0.37);
    expect(publicImpactTilt('DOWNED', 0.6)).toBeCloseTo(0.25);
    expect(publicImpactTilt('ACTIVE', 9)).toBeCloseTo(0);
  });
  it('primes the first snapshot and never replays duplicate/stale revisions or reconnect history', () => {
    const view = room(); event(view, 'HEALED');
    const observer = new PublicPresentationObserver(); expect(observer.observe(view, now)).toEqual([]);
    event(view, 'REVIVED'); const snapshot = structuredClone(view);
    expect(observer.observe(view, now)).toEqual([{ type: 'item', itemId: 'medicine', playerId: 'p1' }]);
    expect(observer.observe(view, now)).toEqual([]);
    event(view, 'DAMAGE'); expect(observer.observe(view, now)).toEqual([{ type: 'impact', playerId: 'p2' }]);
    expect(observer.observe(snapshot, now)).toEqual([]);
    event(view, 'HEALED', { at: now - 6000 }); expect(observer.observe(view, now)).toEqual([]);
  });
  it('does not inspect prose, covered commitments, inventory deltas, or private payloads', () => {
    const view = room(), observer = new PublicPresentationObserver(); observer.observe(view, now);
    for (const kind of ['THREAT_OFFERED', 'THREAT_REFUSED', 'WEAPON_USED', 'POCKET_INSPECTED', 'POCKET_FILLED', 'MARKET_REROLLED']) {
      event(view, kind, { privatePayloads: { p1: { itemId: 'pistol' } } });
    }
    view.players[0]!.visibleInventory = [];
    expect(observer.observe(view, now)).toEqual([]);
  });
  it('opens only a chest with an authoritative public availability transition', () => {
    const view = room(), observer = new PublicPresentationObserver(); observer.observe(view, now);
    event(view, 'CHEST_OPENED'); expect(observer.observe(view, now)).toEqual([]);
    view.chests![0]!.availability = 'OPENED'; event(view, 'CHEST_OPENED');
    expect(observer.observe(view, now)).toEqual([{ type: 'chest', kind: 'STANDARD' }]);
  });
  it('uses only structured public metadata for exact weapon and chest-tool clips', () => {
    const view = room(), observer = new PublicPresentationObserver(); observer.observe(view, now);
    event(view, 'WEAPON_USED', { presentation: { itemId: 'pistol' } });
    view.chests!.push({ kind: 'BLACK', availability: 'OPENED' });
    event(view, 'CHEST_OPENED', { presentation: { itemId: 'black-key', chestKind: 'BLACK' } });
    expect(observer.observe(view, now)).toEqual([
      { type: 'item', itemId: 'pistol', playerId: 'p1' },
      { type: 'item', itemId: 'blackKey', playerId: 'p1' },
      { type: 'chest', kind: 'BLACK' },
    ]);
  });
  it('maps public health/life/shop cues without inventing an item for an exchange', () => {
    const view = room(), observer = new PublicPresentationObserver(); observer.observe(view, now);
    for (const kind of ['ARMOR_BLOCKED', 'POISON_CURED', 'EXIT', 'DEATH', 'INTERMISSION', 'PURCHASE']) event(view, kind);
    expect(observer.observe(view, now)).toEqual([
      { type: 'item', itemId: 'armor', playerId: 'p2' }, { type: 'item', itemId: 'antidote', playerId: 'p1' },
      { type: 'exit', playerId: 'p1' }, { type: 'death', playerId: 'p2' }, { type: 'shop' }, { type: 'exchange', playerId: 'p1' },
    ]);
  });
  it('resets on a new match and bounds a burst instead of queuing gameplay', () => {
    const view = room(), observer = new PublicPresentationObserver(); observer.observe(view, now);
    for (let i = 0; i < 30; i++) event(view, 'DAMAGE');
    expect(observer.observe(view, now)).toHaveLength(6);
    const oldMatch = structuredClone(view);
    view.events = [{ id: 'start', sequence: 1, at: now + 100, kind: 'MATCH_STARTED', targetIds: [], publicText: '' }]; view.revision++;
    expect(observer.observe(view, now + 100)).toEqual([]);
    expect(observer.observe(oldMatch, now + 100)).toEqual([]);
    event(view, 'HEALED'); expect(observer.observe(view, now)).toHaveLength(1);
  });
});
describe('arrival policy', () => {
  it('requires an identified living player at fresh match start; spectators, reconnects and reduced motion stay overview', () => {
    const view = room();
    expect(arrivalEligible(view, 'p2', false, false, now)).toBe(true);
    expect(publicSeats(view)[1]?.position).toEqual([2.65, 0, 0]);
    expect(arrivalEligible(view, undefined, false, false, now)).toBe(false);
    expect(arrivalEligible(view, 'p1', true, false, now)).toBe(false);
    expect(arrivalEligible(view, 'p1', false, true, now)).toBe(false);
    expect(arrivalEligible(view, 'p1', false, false, now + 9000)).toBe(false);
    view.players[0]!.life = 'DEAD'; expect(arrivalEligible(view, 'p1', false, false, now)).toBe(false);
  });
  it('persists seen-once and tolerates storage denial', () => {
    const entries = new Map<string, string>(), storage = { getItem: (key: string) => entries.get(key) ?? null, setItem: (key: string, value: string) => { entries.set(key, value); } };
    expect(hasSeenArrival(storage)).toBe(false); rememberArrival(storage);
    expect(entries.get(ARRIVAL_SEEN_KEY)).toBe('1'); expect(hasSeenArrival(storage)).toBe(true);
    const blocked = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
    expect(() => rememberArrival(blocked)).not.toThrow(); expect(hasSeenArrival(blocked)).toBe(true);
  });
  it('allows a seen player to enter a rematch, but suppresses replay of an already started match', () => {
    const entries = new Map<string, string>(), storage = { getItem: (key: string) => entries.get(key) ?? null, setItem: (key: string, value: string) => { entries.set(key, value); } };
    const view = room();
    expect(hasStartedArrival(view, storage)).toBe(false);
    rememberArrivalStart(view, storage);
    expect(hasStartedArrival(view, storage)).toBe(true);
    expect(arrivalEligible(view, 'p1', false, hasStartedArrival(view, storage), now)).toBe(false);
    rememberArrival(storage);
    view.events![0]!.at += 1000;
    expect(hasSeenArrival(storage)).toBe(true);
    expect(arrivalEligible(view, 'p1', false, hasStartedArrival(view, storage), now + 1000)).toBe(true);
  });
});
