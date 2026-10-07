import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { createAudioEngine } from './index.js';
import { createIntroController } from './intro.js';
import { AUTHORITATIVE_EVENT_KINDS, EVENT_COVERAGE, ITEM_CUES, PRIVATE_EVENT_CUES, routeEvent } from './mappings.js';
import { toneForCue } from './synth.js';
import { AUDIO_CUE_IDS } from './types.js';
import type { AudioContextLike, AudioStorage, GainNodeLike, OscillatorLike } from './types.js';

function fakeContext() {
  const calls: string[] = [];
  const filters: Array<{ type: string; frequency: { value: number }; Q: { value: number } }> = [];
  const ambienceGains: GainNodeLike[] = [];
  const makeGain = (label: string): GainNodeLike => {
    const node: GainNodeLike = {
      gain: { value: 0 },
      connect: (destination) => destination,
      disconnect: () => { calls.push(label + '-disconnect'); },
    };
    return node;
  };
  const gain: GainNodeLike = {
    gain: { value: 0 },
    connect: (destination) => destination,
    disconnect: () => { calls.push('disconnect'); },
  };
  const context: AudioContextLike = {
    currentTime: 0,
    state: 'suspended',
    sampleRate: 48_000,
    destination: gain,
    resume: vi.fn(async () => undefined),
    close: vi.fn(async () => undefined),
    createGain: () => {
      const node = makeGain('gain');
      ambienceGains.push(node);
      return node;
    },
    createOscillator: () => {
      const oscillator: OscillatorLike = {
        type: '',
        frequency: { value: 0 },
        connect: (destination) => destination,
        start: () => { calls.push('start'); },
        stop: () => { calls.push('stop'); },
      };
      return oscillator;
    },
    createBiquadFilter: () => {
      const filter = { type: '', frequency: { value: 0 }, Q: { value: 0 }, connect: (destination: GainNodeLike) => destination, disconnect: () => { calls.push('filter-disconnect'); } };
      filters.push(filter);
      return filter;
    },
    createBuffer: () => ({ duration: 2, getChannelData: () => new Float32Array(8) }),
    createBufferSource: () => ({
      buffer: null,
      loop: false,
      connect: (destination: GainNodeLike) => destination,
      start: () => { calls.push('ambience-start'); },
      stop: () => { calls.push('ambience-stop'); },
      disconnect: () => { calls.push('ambience-disconnect'); },
    }),
  };
  return { context, calls, filters, ambienceGains };
}

function storage(): AudioStorage {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); },
  };
}

describe('audio routing and lifecycle', () => {
  it('routes owner-only private cues', () => {
    const event = { id: 'e1', kind: 'POCKET_INSPECTED', privatePayloads: { p1: 'secret' } };
    expect(routeEvent(event, 'p1')).toEqual([
      { cue: 'event.pocket-inspected', audience: 'PUBLIC', eventId: 'e1' },
      { cue: 'private.inspection', audience: 'PRIVATE', eventId: 'e1' },
    ]);
    expect(routeEvent(event, 'p2')).toEqual([{ cue: 'event.pocket-inspected', audience: 'PUBLIC', eventId: 'e1' }]);
  });

  it('has a machine-checkable cue and procedural voice for every engine event', () => {
    const emittedByEngine = [
      'MATCH_STARTED', 'MATCH_ENDED', 'TURN_STARTED', 'TURN_ENDED', 'INTERMISSION', 'SHOPPER_SKIPPED',
      'TRADE_OFFERED', 'TRADE_ACCEPTED', 'TRADE_DECLINED', 'TRADE_CANCELLED',
      'THREAT_OFFERED', 'THREAT_COMPLIED', 'THREAT_REFUSED', 'THREAT_CANCELLED',
      'WEAPON_USED', 'DAMAGE', 'POISON_DAMAGE', 'POISON_APPLIED', 'POISON_CURED', 'HEALED', 'ARMOR_BLOCKED', 'HANDCUFFED',
      'DOWNED', 'REVIVED', 'LOOTED', 'DEATH', 'CHEST_REFRESHED', 'CHEST_OPENED', 'CHEST_INSPECTED',
      'PURCHASE', 'SOLD', 'POCKET_FILLED', 'MARKET_REROLLED', 'POCKET_INSPECTED', 'PICKPOCKET',
      'OBJECTIVE_READY', 'OBJECTIVE_LOCKED', 'DEATH_OBJECTIVE_BANKED', 'EXIT', 'OVERFLOW', 'OVERFLOW_RESOLVED',
    ];
    expect(AUTHORITATIVE_EVENT_KINDS).toEqual(emittedByEngine);
    expect(Object.keys(EVENT_COVERAGE).sort()).toEqual([...emittedByEngine].sort());
    const gameFiles = ['actions.ts', 'combat.ts', 'economy.ts', 'engine.ts', 'inventory.ts', 'objectives.ts'];
    const literalEvents = gameFiles.flatMap((file) => [...readFileSync(new URL(`../../game/src/${file}`, import.meta.url), 'utf8').matchAll(/event\(room, now, '([A-Z_]+)'/g)].map((match) => match[1]!));
    expect(literalEvents.every((kind) => AUTHORITATIVE_EVENT_KINDS.includes(kind as typeof AUTHORITATIVE_EVENT_KINDS[number]))).toBe(true);
    for (const kind of AUTHORITATIVE_EVENT_KINDS) {
      const requests = routeEvent({ id: kind, kind });
      expect(requests).toEqual([{ cue: EVENT_COVERAGE[kind].cue, audience: 'PUBLIC', eventId: kind }]);
      expect(toneForCue(EVENT_COVERAGE[kind].cue)).toHaveLength(3);
    }
  });

  it('covers every canonical item and keeps private detail cues owner-authorized', () => {
    const canonicalItemIds = ['knife', 'pistol', 'bullet', 'poison', 'antidote', 'medicine', 'armor', 'cloth', 'bag', 'safe', 'spyglass', 'pickpocket', 'key', 'lockpick', 'crowbar', 'black-key', 'handcuffs', 'brass-idol', 'glass-eye', 'red-ledger', 'passage-token'];
    for (const itemId of canonicalItemIds) expect(ITEM_CUES[itemId]).toBeDefined();
    for (const cue of Object.values(AUDIO_CUE_IDS)) expect(toneForCue(cue)).toHaveLength(3);
    expect(Object.keys(PRIVATE_EVENT_CUES).sort()).toEqual(['CHEST_INSPECTED', 'POCKET_INSPECTED']);
    const payloadForSomeoneElse = routeEvent({ id: 'private', kind: 'POCKET_INSPECTED', privatePayloads: { owner: { item: 'pistol' } } }, 'observer');
    expect(payloadForSomeoneElse).toEqual([{ cue: 'event.pocket-inspected', audience: 'PUBLIC', eventId: 'private' }]);
    expect(routeEvent({ id: 'weapon', kind: 'WEAPON_USED', presentation: { itemId: 'pistol' } })).toEqual([
      { cue: 'event.weapon-used', audience: 'PUBLIC', eventId: 'weapon' },
      { cue: 'item.pistol', audience: 'PUBLIC', eventId: 'weapon' },
    ]);
  });

  it('suppresses duplicate event IDs but allows events without IDs', () => {
    const fake = fakeContext();
    const engine = createAudioEngine({ createContext: () => fake.context, storage: storage() });
    engine.handleEvent({ id: 'same', kind: 'TURN_STARTED' });
    engine.handleEvent({ id: 'same', kind: 'TURN_STARTED' });
    engine.handleEvent({ kind: 'TURN_STARTED' });
    expect(fake.calls.filter((call) => call === 'start')).toHaveLength(2);
  });

  it('bounds receipt memory and clears it on dispose', async () => {
    const fake = fakeContext();
    const engine = createAudioEngine({ createContext: () => fake.context, storage: storage() });
    for (let index = 0; index < 513; index += 1) engine.handleEvent({ id: 'event-' + index, kind: 'TURN_STARTED' });
    engine.handleEvent({ id: 'event-0', kind: 'TURN_STARTED' });
    expect(fake.calls.filter((call) => call === 'start')).toHaveLength(514);
    await engine.dispose();
    engine.handleEvent({ id: 'event-512', kind: 'TURN_STARTED' });
    expect(fake.calls.filter((call) => call === 'start')).toHaveLength(514);
  });

  it('starts and stops ambience idempotently', async () => {
    const fake = fakeContext();
    const engine = createAudioEngine({ createContext: () => fake.context, storage: storage() });
    engine.startAmbience();
    engine.startAmbience();
    expect(fake.calls.filter((call) => call === 'ambience-start')).toHaveLength(1);
    expect(fake.filters[0]).toMatchObject({ type: 'lowpass', frequency: { value: 180 }, Q: { value: 0.35 } });
    expect(fake.ambienceGains[1]?.gain.value).toBe(0.018);
    engine.stopAmbience();
    engine.stopAmbience();
    expect(fake.calls.filter((call) => call === 'ambience-stop')).toHaveLength(1);
    engine.startAmbience('shop');
    expect(fake.filters[1]).toMatchObject({ type: 'bandpass', frequency: { value: 520 }, Q: { value: 0.8 } });
    await engine.dispose();
    expect(fake.calls.filter((call) => call === 'ambience-stop')).toHaveLength(2);
    expect(fake.calls).toContain('ambience-disconnect');
    expect(fake.calls).toContain('filter-disconnect');
    expect(fake.calls).toContain('gain-disconnect');
  });

  it('persists settings and cleans the injected context', async () => {
    const fake = fakeContext();
    const engine = createAudioEngine({ createContext: () => fake.context, storage: storage() });
    await engine.start();
    engine.setVolume(4);
    engine.setMuted(true);
    expect(engine.state()).toMatchObject({ volume: 1, muted: true, contextReady: true });
    await engine.dispose();
    expect(fake.calls).toContain('gain-disconnect');
    expect(fake.context.close).toHaveBeenCalled();
  });

  it('keeps intro timing presentation-only', () => {
    const intro = createIntroController(100);
    intro.arm(0);
    intro.start(10);
    expect(intro.tick(109).phase).toBe('PLAYING');
    expect(intro.tick(110).phase).toBe('COMPLETE');
    intro.skip(120);
    expect(intro.state().phase).toBe('SKIPPED');
  });
});
