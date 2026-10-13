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
  const startTimes: number[] = [];
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
        start: (when?: number) => { calls.push('start'); startTimes.push(when ?? 0); },
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
  return { context, calls, filters, ambienceGains, startTimes };
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

  it('rings the turn bell only for the player whose turn starts', () => {
    expect(routeEvent({ id: 't', kind: 'TURN_STARTED', actorId: 'p1' }, 'p1').map(request => request.cue))
      .toEqual(['turn.start']);
    expect(routeEvent({ id: 't', kind: 'TURN_STARTED', actorId: 'p1' }, 'p2').map(request => request.cue))
      .toEqual(['event.turn-started']);
    expect(routeEvent({ id: 's', kind: 'SHOPPER_SKIPPED' }).map(request => request.cue))
      .toEqual(['event.shopper-skipped']);
  });

  it('has a machine-checkable cue and procedural voice for every engine event', () => {
    const emittedByEngine = [
      'TURN_PASSED', 'TASKS_ASSIGNED_PRIVATE', 'TASK_COMPLETED', 'TASK_CANCELLED', 'TASK_REPLACED', 'TASKS_EXPIRED',
      'MATCH_STARTED', 'MATCH_ENDED', 'TURN_STARTED', 'TURN_ENDED', 'INTERMISSION', 'SHOPPER_SKIPPED',
      'TRADE_OFFERED', 'TRADE_ACCEPTED', 'TRADE_DECLINED', 'TRADE_CANCELLED',
      'THREAT_OFFERED', 'THREAT_COMPLIED', 'THREAT_REFUSED', 'THREAT_CANCELLED',
      'WEAPON_USED', 'DAMAGE', 'POISON_DAMAGE', 'POISON_APPLIED', 'POISON_CURED', 'HEALED', 'STIMULANT_USED', 'ARMOR_BLOCKED', 'HANDCUFFED',
      'DOWNED', 'REVIVED', 'LOOTED', 'DEATH', 'CHEST_REFRESHED', 'CHEST_OPENED', 'CHEST_INSPECTED',
      'PURCHASE', 'SOLD', 'POCKET_FILLED', 'MARKET_REROLLED', 'POCKET_INSPECTED', 'PICKPOCKET',
      'OBJECTIVE_READY', 'OBJECTIVE_LOCKED', 'DEATH_OBJECTIVE_BANKED', 'EXIT', 'OVERFLOW', 'OVERFLOW_RESOLVED',
      'TRADE_EXPIRED_DECLINED', 'OBJECTIVE_FAILED', 'PLAYER_CONCEDED',
      'INTERMISSION_PREP_STARTED', 'PUBLIC_SHOP_TURN_STARTED', 'PUBLIC_SHOP_PASSED', 'BLACK_MARKET_UNLOCKED', 'INTERMISSION_PLAYER_FINISHED',
      'ROUND_INCOME_GRANTED', 'WILDCARD_DECK_UNLOCKED', 'WILDCARD_DRAWN_PRIVATE', 'WILDCARD_USED', 'WILDCARD_BURNED', 'WILDCARD_TARGET_SELECTED', 'WILDCARD_RESOLVED',
    ];
    expect(AUTHORITATIVE_EVENT_KINDS).toEqual(emittedByEngine);
    expect(Object.keys(EVENT_COVERAGE).sort()).toEqual([...emittedByEngine].sort());
    const gameFiles = ['actions.ts', 'combat.ts', 'economy.ts', 'engine.ts', 'inventory.ts', 'objectives.ts', 'intermission.ts', 'wildcards.ts', 'tasks.ts'];
    const literalEvents = gameFiles.flatMap((file) => [...readFileSync(new URL(`../../game/src/${file}`, import.meta.url), 'utf8').matchAll(/event\(room, now, '([A-Z_]+)'/g)].map((match) => match[1]!));
    expect(literalEvents.every((kind) => AUTHORITATIVE_EVENT_KINDS.includes(kind as typeof AUTHORITATIVE_EVENT_KINDS[number]))).toBe(true);
    for (const kind of AUTHORITATIVE_EVENT_KINDS) {
      const requests = routeEvent({ id: kind, kind });
      if (EVENT_COVERAGE[kind].audience === 'PRIVATE') expect(requests).toEqual([]);
      else expect(requests[0]).toMatchObject({ cue: EVENT_COVERAGE[kind].cue, audience: 'PUBLIC', eventId: kind });
      expect(toneForCue(EVENT_COVERAGE[kind].cue)).toHaveLength(3);
    }
  });

  it('uses supplied paper/impact/reveal beats without encoding private card identity', () => {
    expect(routeEvent({ id: 'unlock', kind: 'WILDCARD_DECK_UNLOCKED' })).toEqual([
      { cue: 'handle.paper', audience: 'PUBLIC', eventId: 'unlock' },
      { cue: 'world.table-settle', audience: 'PUBLIC', eventId: 'unlock', delaySeconds: .5 },
    ]);
    for (const kind of ['WILDCARD_DRAWN_PRIVATE', 'WILDCARD_BURNED']) {
      const event = { id: 'card', kind, privatePayloads: { owner: { cardId: 'windfall' } } };
      const otherCard = { ...event, privatePayloads: { owner: { cardId: 'destroy' } } };
      expect(routeEvent(event, 'owner')).toEqual(routeEvent(event, 'observer'));
      expect(routeEvent(event, 'observer')).toEqual(routeEvent(otherCard, 'observer'));
      expect(routeEvent(event, 'observer').map(request => request.cue)).toEqual(kind === 'WILDCARD_DRAWN_PRIVATE' ? ['handle.paper', 'handle.paper'] : ['handle.paper', 'world.table-settle']);
    }
    expect(routeEvent({ kind: 'WILDCARD_USED' })).toEqual([{ cue: 'event.objective-ready', audience: 'PUBLIC', delaySeconds: .25 }]);
  });

  it('schedules the Wildcard reveal sting at its visual beat and deduplicates it', async () => {
    const fake = fakeContext();
    const engine = createAudioEngine({ createContext: () => fake.context, storage: storage() });
    engine.handleEvent({ id: 'reveal', kind: 'WILDCARD_USED' });
    expect(fake.startTimes.length).toBeGreaterThan(0);
    // The shared synth adds its usual 10ms scheduling lead-in.
    expect(Math.min(...fake.startTimes)).toBeCloseTo(.26);
    const starts = fake.startTimes.length;
    engine.handleEvent({ id: 'reveal', kind: 'WILDCARD_USED' });
    expect(fake.startTimes).toHaveLength(starts);
    await engine.dispose();
  });

  it('covers every canonical item and keeps private detail cues owner-authorized', () => {
    const canonicalItemIds = ['knife', 'pistol', 'bullet', 'poison', 'antidote', 'medicine', 'stimulant', 'armor', 'cloth', 'bag', 'safe', 'spyglass', 'pickpocket', 'key', 'lockpick', 'crowbar', 'black-key', 'handcuffs', 'brass-idol', 'glass-eye', 'red-ledger', 'passage-token'];
    for (const itemId of canonicalItemIds) expect(ITEM_CUES[itemId]).toBeDefined();
    for (const cue of Object.values(AUDIO_CUE_IDS)) expect(toneForCue(cue)).toHaveLength(3);
    expect(Object.keys(PRIVATE_EVENT_CUES).sort()).toEqual(['CHEST_INSPECTED', 'POCKET_INSPECTED']);
    const payloadForSomeoneElse = routeEvent({ id: 'private', kind: 'POCKET_INSPECTED', privatePayloads: { owner: { item: 'pistol' } } }, 'observer');
    expect(payloadForSomeoneElse).toEqual([{ cue: 'event.pocket-inspected', audience: 'PUBLIC', eventId: 'private' }]);
    expect(routeEvent({ id: 'weapon', kind: 'WEAPON_USED', presentation: { itemId: 'pistol' } })).toEqual([
      { cue: 'event.weapon-used', audience: 'PUBLIC', eventId: 'weapon' },
      { cue: 'item.pistol', audience: 'PUBLIC', eventId: 'weapon' },
    ]);
    expect(routeEvent({ id: 'boost', kind: 'STIMULANT_USED', presentation: { itemId: 'stimulant' } })).toEqual([
      { cue: 'item.stimulant', audience: 'PUBLIC', eventId: 'boost' },
    ]);
  });

  it('suppresses duplicate event IDs but allows events without IDs', () => {
    const fake = fakeContext();
    const engine = createAudioEngine({ createContext: () => fake.context, storage: storage() });
    const starts = () => fake.calls.filter((call) => call === 'start').length;
    engine.handleEvent({ id: 'same', kind: 'TURN_STARTED' });
    const one = starts();
    expect(one).toBeGreaterThan(0);
    engine.handleEvent({ id: 'same', kind: 'TURN_STARTED' });
    expect(starts()).toBe(one);
    engine.handleEvent({ kind: 'TURN_STARTED' });
    expect(starts()).toBe(one * 2);
  });

  it('bounds receipt memory and clears it on dispose', async () => {
    const fake = fakeContext();
    const engine = createAudioEngine({ createContext: () => fake.context, storage: storage() });
    const starts = () => fake.calls.filter((call) => call === 'start').length;
    engine.handleEvent({ id: 'probe', kind: 'TURN_STARTED' });
    const per = starts();
    for (let index = 0; index < 513; index += 1) engine.handleEvent({ id: 'event-' + index, kind: 'TURN_STARTED' });
    engine.handleEvent({ id: 'event-0', kind: 'TURN_STARTED' });
    expect(starts()).toBe(per * 515);
    await engine.dispose();
    engine.handleEvent({ id: 'event-512', kind: 'TURN_STARTED' });
    expect(starts()).toBe(per * 515);
  });

  it('drives the music bed and the threat layer idempotently', async () => {
    const fake = fakeContext();
    const engine = createAudioEngine({ createContext: () => fake.context, storage: storage() });
    engine.startAmbience();
    engine.startAmbience();
    expect(engine.state()).toMatchObject({ music: 'table', threat: false });
    engine.setThreat(true);
    expect(engine.state().threat).toBe(true);
    engine.setMusic('market');
    expect(engine.state()).toMatchObject({ music: 'market', threat: true });
    engine.stopAmbience();
    expect(engine.state()).toMatchObject({ music: undefined, threat: false });
    engine.setMusic('after');
    await engine.dispose();
    expect(engine.state().music).toBeUndefined();
    expect(fake.calls).toContain('gain-disconnect');
  });

  it('does not wake audio for inactive music controls and defers a requested threat layer', async () => {
    const fake = fakeContext();
    const createContext = vi.fn(() => fake.context);
    const engine = createAudioEngine({ createContext, storage: storage() });
    engine.stopAmbience();
    engine.setThreat(false);
    engine.setMusic(undefined);
    expect(createContext).not.toHaveBeenCalled();

    engine.setThreat(true);
    expect(createContext).not.toHaveBeenCalled();
    engine.setMusic('table');
    expect(createContext).toHaveBeenCalledOnce();
    expect(engine.state()).toMatchObject({ music: 'table', threat: true });
    await engine.dispose();
  });

  it('plays a material handling cue for transfers, never the item use performance', () => {
    expect(routeEvent({ id: 'buy', kind: 'PURCHASE', presentation: { itemId: 'knife' } })).toEqual([
      { cue: 'event.purchased', audience: 'PUBLIC', eventId: 'buy' },
      { cue: 'handle.metal', audience: 'PUBLIC', eventId: 'buy' },
    ]);
    expect(routeEvent({ id: 'sell', kind: 'SOLD', presentation: { itemId: 'medicine' } }).map(r => r.cue)).toEqual(['event.sold', 'handle.glass']);
    expect(routeEvent({ id: 'refuse', kind: 'THREAT_REFUSED', presentation: { itemId: 'pistol' } }).map(r => r.cue)).toEqual(['event.threat-refused']);
  });

  it('lands weapon damage on the hit beat instead of the event arrival', () => {
    const fake = fakeContext();
    const engine = createAudioEngine({ createContext: () => fake.context, storage: storage() });
    engine.handleEvent({ id: 'w', kind: 'WEAPON_USED', presentation: { itemId: 'knife' } });
    const before = fake.startTimes.length;
    engine.handleEvent({ id: 'd', kind: 'DAMAGE' });
    const damageStarts = fake.startTimes.slice(before);
    expect(Math.min(...damageStarts)).toBeGreaterThanOrEqual(.9 / 2.7 * .8);
  });

  it('persists settings and cleans the injected context', async () => {
    const fake = fakeContext();
    const engine = createAudioEngine({ createContext: () => fake.context, storage: storage() });
    await engine.start();
    engine.setVolume(4);
    engine.setRoomVolume(0.4);
    engine.setEffectsVolume(0.8);
    engine.setMuted(true);
    expect(engine.state()).toMatchObject({ volume: 1, roomVolume: 0.4, effectsVolume: 0.8, muted: true, contextReady: true });
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
