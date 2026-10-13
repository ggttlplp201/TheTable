import { describe, expect, it } from 'vitest';
import { parseGameCommand } from '../src/game-commands.js';
import { Sessions } from '../src/sessions.js';
import { fingerprint } from '../src/protocol.js';

describe('untrusted command and credential boundaries', () => {
  it('rejects internal commands and client-selected identity, time or randomness', () => {
    for (const type of ['TIMEOUT', 'SET_CONNECTION', '__proto__', 'constructor']) {
      expect(() => parseGameCommand({ type, payload: {} })).toThrow();
    }
    for (const payload of [{ seed: 5 }, { actorId: 'victim' }, { now: 0 }, { type: 'TIMEOUT' }]) {
      expect(() => parseGameCommand({ type: 'START_MATCH', payload })).toThrow();
    }
    expect(parseGameCommand({ type: 'START_MATCH', payload: {} }, () => 42)).toEqual({ type: 'START_MATCH', seed: 42 });
  });
  it('rejects negative assets, repeated locked IDs, invalid pocket indexes and arbitrary fields', () => {
    const trade = { targetId: 'peer', offeredItems: [], requestedItems: [], offeredCoins: 0, requestedCoins: 0 };
    expect(() => parseGameCommand({ type: 'TRADE', payload: { ...trade, offeredCoins: -1 } })).toThrow();
    expect(() => parseGameCommand({ type: 'TRADE', payload: { ...trade, offeredItems: ['same', 'same'] } })).toThrow();
    expect(() => parseGameCommand({ type: 'POCKET', payload: { instanceId: 'item', pocketIndex: 2 } })).toThrow();
    expect(() => parseGameCommand({ type: 'RESPOND_TRADE', payload: { accept: true, actorId: 'victim' } })).toThrow();
  });
  it('accepts the engine Downed HELP interaction while rejecting unknown help kinds', () => {
    const payload = { targetId: 'downed-player', kind: 'HELP', instanceId: 'owned-antidote' };
    expect(parseGameCommand({ type: 'DOWNED_INTERACTION', payload })).toEqual({ type: 'DOWNED_INTERACTION', ...payload });
    expect(() => parseGameCommand({ type: 'DOWNED_INTERACTION', payload: { ...payload, kind: 'HEAL_ANYTHING' } })).toThrow();
  });
  it('bounds request fingerprints and treats JSON key order consistently', () => {
    expect(fingerprint({ b: 2, a: 1 })).toBe(fingerprint({ a: 1, b: 2 }));
    expect(fingerprint({ a: 'x'.repeat(20_000) })).toHaveLength(64);
    let nested: unknown = 'leaf';
    for (let depth = 0; depth < 20; depth += 1) nested = { nested };
    expect(() => fingerprint(nested)).toThrow('too complex');
  });
  it('accepts Wildcard decisions but never client-selected cards, randomness, or effects', () => {
    for (const type of ['DRAW_WILDCARD', 'USE_WILDCARD', 'BURN_WILDCARD']) {
      expect(parseGameCommand({ type, payload: {} })).toEqual({ type });
      for (const payload of [{ cardId: 'windfall' }, { seed: 42 }, { playerId: 'other' }, { phase: 'DRAWN' }]) {
        expect(() => parseGameCommand({ type, payload })).toThrow();
      }
    }
    const payload = { targetId: 'other', instanceId: 'visible-item', ownInstanceId: 'my-item' };
    expect(parseGameCommand({ type: 'RESOLVE_WILDCARD', payload })).toEqual({ type: 'RESOLVE_WILDCARD', ...payload });
    for (const payload of [{ pocketIndex: -1 }, { pocketIndex: 2 }, { pocketIndex: 0.5 }, { cardId: 'seize' }, { coins: 10 }, { targetId: '' }]) {
      expect(() => parseGameCommand({ type: 'RESOLVE_WILDCARD', payload })).toThrow();
    }
  });
  it('binds reconnect credentials to one room/player and invalidates them on rotation and deletion', () => {
    const sessions = new Sessions();
    const first = sessions.issue('ABCDEF', 'alice');
    expect(sessions.verify('ABCDEF', first)).toBe('alice');
    expect(() => sessions.verify('BCDEFG', first)).toThrow();
    expect(() => sessions.verify('ABCDEF', `${first}.extra`)).toThrow();
    const second = sessions.issue('ABCDEF', 'alice');
    expect(() => sessions.verify('ABCDEF', first)).toThrow();
    expect(sessions.verify('ABCDEF', second)).toBe('alice');
    sessions.destroyRoom('ABCDEF');
    expect(() => sessions.verify('ABCDEF', second)).toThrow();
  });
});
