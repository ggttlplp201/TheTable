import { createIntroController } from './intro.js';
import { handleCue, itemCue, routeEvent, WEAPON_HIT_AT } from './mappings.js';
import { createMasterChain, playProcedural, playRecordedResidual, startMusic, type MasterChain, type MusicLayer } from './synth.js';
import { playRecordedAccent, playRecordedCue, primeRecordedSamples } from './samples.js';
import type {
  AudioContextFactory,
  AudioContextLike,
  AudioCueId,
  AudioEngineState,
  AudioStorage,
  GainNodeLike,
  IntroController,
  MusicTrackId,
  ProjectedAudioEvent,
} from './types.js';

export * from './types.js';
export * from './mappings.js';
export * from './intro.js';
export * from './samples.js';
export { MUSIC, VOICES, setSynthRandom } from './synth.js';

const VOLUME_KEY = 'the-table.audio.volume';
const ROOM_VOLUME_KEY = 'the-table.audio.room-volume';
const EFFECTS_VOLUME_KEY = 'the-table.audio.effects-volume';
const MUTED_KEY = 'the-table.audio.muted';
const RECEIPT_LIMIT = 512;

const defaultStorage: AudioStorage = {
  getItem: (key) => typeof globalThis.localStorage === 'undefined' ? null : globalThis.localStorage.getItem(key),
  setItem: (key, value) => {
    if (typeof globalThis.localStorage !== 'undefined') globalThis.localStorage.setItem(key, value);
  },
};

const defaultFactory: AudioContextFactory = () => {
  const browser = globalThis as unknown as {
    AudioContext?: new () => AudioContextLike;
    webkitAudioContext?: new () => AudioContextLike;
  };
  const Constructor = browser.AudioContext ?? browser.webkitAudioContext;
  if (!Constructor) throw new Error('Web Audio is unavailable');
  return new Constructor();
};

export interface AudioEngineOptions {
  createContext?: AudioContextFactory;
  storage?: AudioStorage;
  intro?: IntroController;
}

export interface AudioEngine {
  state(): AudioEngineState;
  start(): Promise<void>;
  play(cue: AudioCueId): void;
  handleEvent(event: ProjectedAudioEvent, selfId?: string): void;
  /** Handling an item (pick up, pocket, buy, sell, hand over): its material, never its use sound. */
  playItem(itemId: string): void;
  /** The item's use performance, timed to its scene animation. Only for local uses with no public event. */
  playUse(itemId: string): void;
  /** Main music bed; undefined = silence. Crossfades over 1.5 s (250 ms when moving between table and market scenes). */
  setMusic(track: MusicTrackId | undefined): void;
  /** "Leverage" layer on top of the bed while a threat is open. */
  setThreat(open: boolean): void;
  /** Compatibility: room → "The Table", shop → "The Tallyman's Shelf". */
  startAmbience(kind?: 'room' | 'shop'): void;
  stopAmbience(): void;
  setVolume(volume: number): void;
  setRoomVolume(volume: number): void;
  setEffectsVolume(volume: number): void;
  setMuted(muted: boolean): void;
  intro: IntroController;
  dispose(): Promise<void>;
}

export function createAudioEngine(options: AudioEngineOptions = {}): AudioEngine {
  const storage = options.storage ?? defaultStorage;
  const factory = options.createContext ?? defaultFactory;
  let volume = clamp(Number(storage.getItem(VOLUME_KEY) ?? 0.65));
  let roomVolume = clamp(Number(storage.getItem(ROOM_VOLUME_KEY) ?? 0.55));
  let effectsVolume = clamp(Number(storage.getItem(EFFECTS_VOLUME_KEY) ?? 0.7));
  let muted = storage.getItem(MUTED_KEY) === 'true';
  let context: AudioContextLike | undefined;
  let master: GainNodeLike | undefined;
  let roomBus: GainNodeLike | undefined;
  let effectsBus: GainNodeLike | undefined;
  let chain: MasterChain | undefined;
  let music: { id: MusicTrackId; layer: MusicLayer } | undefined;
  let threat: MusicLayer | undefined;
  let threatOpen = false;
  let wantedMusic: MusicTrackId | undefined;
  let lastWeapon: { at: number; hitAt: number; itemId: string } | undefined;
  let disposed = false;
  const receipts = new Set<string>();
  const receiptOrder: string[] = [];
  const intro = options.intro ?? createIntroController();

  const ensure = (): void => {
    if (disposed) return;
    context ??= factory();
    if (master) return;
    master = context.createGain();
    roomBus = context.createGain();
    effectsBus = context.createGain();
    master.gain.value = muted ? 0 : volume;
    roomBus.gain.value = roomVolume;
    effectsBus.gain.value = effectsVolume;
    chain = createMasterChain(context, context.destination);
    roomBus.connect(master);
    effectsBus.connect(master);
    master.connect(chain.input);
  };

  const fx = (cue: AudioCueId, delay = 0): void => {
    ensure();
    if (!context || !effectsBus || muted) return;
    if (playRecordedCue(context, cue, effectsBus, delay)) playRecordedResidual(context, cue, effectsBus, delay);
    else playProcedural(context, cue, effectsBus, delay);
  };

  const SCENE_SWAP = new Set(['table|market', 'market|table', 'table|shop', 'shop|table', 'shop|market', 'market|shop']);
  const applyMusic = (): void => {
    if (disposed || (!context && wantedMusic === undefined)) return;
    ensure();
    if (!context || !roomBus || music?.id === wantedMusic) return;
    const swap = music && wantedMusic && SCENE_SWAP.has(music.id + '|' + wantedMusic);
    music?.layer.stop(swap ? 0.25 : 2);
    music = wantedMusic ? { id: wantedMusic, layer: startMusic(context, roomBus, wantedMusic, swap ? 0.25 : 2) } : undefined;
  };

  const applyThreat = (): void => {
    if (disposed || !context || !roomBus) return;
    if (threatOpen && !threat && music) threat = startMusic(context, roomBus, 'threat', 1.5, false);
    if ((!threatOpen || !music) && threat) {
      threat.stop(2);
      threat = undefined;
    }
  };

  const remember = (eventId: string): boolean => {
    if (receipts.has(eventId)) return false;
    receipts.add(eventId);
    receiptOrder.push(eventId);
    if (receiptOrder.length > RECEIPT_LIMIT) {
      const oldest = receiptOrder.shift();
      if (oldest) receipts.delete(oldest);
    }
    return true;
  };

  return {
    state: () => ({ volume, roomVolume, effectsVolume, muted, contextReady: context !== undefined, music: music?.id, threat: threat !== undefined }),
    start: async () => {
      ensure();
      if (context?.resume) await context.resume();
      if (context) primeRecordedSamples(context);
    },
    play: (cue) => fx(cue),
    handleEvent: (event, selfId) => {
      if (event.id !== undefined && !remember(event.id)) return;
      ensure();
      const now = context?.currentTime ?? 0;
      const weaponHit = event.kind === 'WEAPON_USED' ? WEAPON_HIT_AT[event.presentation?.itemId ?? ''] : undefined;
      const weaponId = event.presentation?.itemId;
      if (weaponHit !== undefined && weaponId) lastWeapon = { at: now, hitAt: weaponHit, itemId: weaponId };
      // Damage that arrives with a weapon is heard when the blade or bullet lands, not when the event lands.
      const followsWeapon = lastWeapon !== undefined && now - lastWeapon.at < 0.25 && ['DAMAGE', 'ARMOR_BLOCKED', 'DOWNED', 'DEATH'].includes(event.kind);
      const hitAt = followsWeapon ? lastWeapon?.hitAt : undefined;
      const delay = hitAt === undefined ? 0 : hitAt + (event.kind === 'DAMAGE' ? 0 : 0.35);
      for (const request of routeEvent(event, selfId)) fx(request.cue, delay + (request.delaySeconds ?? 0));
      if (event.kind === 'ARMOR_BLOCKED' && followsWeapon && lastWeapon?.itemId === 'knife' && context && effectsBus && !muted) {
        playRecordedAccent(context, 'knife_snap', effectsBus, delay);
      }
    },
    playItem: (itemId) => { const cue = handleCue(itemId); if (cue) fx(cue); },
    playUse: (itemId) => { const cue = itemCue(itemId); if (cue) fx(cue); },
    setMusic: (track) => { wantedMusic = track; applyMusic(); applyThreat(); },
    setThreat: (open) => { threatOpen = open; applyThreat(); },
    startAmbience: (kind = 'room') => { wantedMusic = kind === 'room' ? 'table' : 'shop'; applyMusic(); applyThreat(); },
    stopAmbience: () => { wantedMusic = undefined; applyMusic(); applyThreat(); },
    setVolume: (next) => {
      volume = clamp(next);
      storage.setItem(VOLUME_KEY, String(volume));
      if (master) master.gain.value = muted ? 0 : volume;
    },
    setRoomVolume: (next) => {
      roomVolume = clamp(next);
      storage.setItem(ROOM_VOLUME_KEY, String(roomVolume));
      if (roomBus) roomBus.gain.value = roomVolume;
    },
    setEffectsVolume: (next) => {
      effectsVolume = clamp(next);
      storage.setItem(EFFECTS_VOLUME_KEY, String(effectsVolume));
      if (effectsBus) effectsBus.gain.value = effectsVolume;
    },
    setMuted: (next) => {
      muted = next;
      storage.setItem(MUTED_KEY, String(muted));
      if (master) master.gain.value = muted ? 0 : volume;
    },
    intro,
    dispose: async () => {
      if (disposed) return;
      disposed = true;
      threat?.stop(0.05);
      threat = undefined;
      music?.layer.stop(0.05);
      music = undefined;
      chain?.nodes.forEach((node) => node.disconnect?.());
      chain = undefined;
      receipts.clear();
      receiptOrder.length = 0;
      master?.disconnect?.();
      roomBus?.disconnect?.();
      effectsBus?.disconnect?.();
      intro.dispose();
      if (context?.close) await context.close();
      context = undefined;
      master = undefined;
      roomBus = undefined;
      effectsBus = undefined;
    },
  };
}

function clamp(value: number): number {
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0.65;
}
