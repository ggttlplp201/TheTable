import { createIntroController } from './intro.js';
import { itemCue, routeEvent } from './mappings.js';
import { playAmbience, playProcedural } from './synth.js';
import type {
  AudioContextFactory,
  AudioContextLike,
  AudioCueId,
  AudioEngineState,
  AudioStorage,
  BufferSourceLike,
  GainNodeLike,
  IntroController,
  ProjectedAudioEvent,
} from './types.js';

export * from './types.js';
export * from './mappings.js';
export * from './intro.js';

const VOLUME_KEY = 'the-table.audio.volume';
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
  playItem(itemId: string): void;
  startAmbience(kind?: 'room' | 'shop'): void;
  stopAmbience(): void;
  setVolume(volume: number): void;
  setMuted(muted: boolean): void;
  intro: IntroController;
  dispose(): Promise<void>;
}

export function createAudioEngine(options: AudioEngineOptions = {}): AudioEngine {
  const storage = options.storage ?? defaultStorage;
  const factory = options.createContext ?? defaultFactory;
  let volume = clamp(Number(storage.getItem(VOLUME_KEY) ?? 0.65));
  let muted = storage.getItem(MUTED_KEY) === 'true';
  let context: AudioContextLike | undefined;
  let master: GainNodeLike | undefined;
  let ambience: BufferSourceLike | undefined;
  let disposed = false;
  const receipts = new Set<string>();
  const receiptOrder: string[] = [];
  const intro = options.intro ?? createIntroController();

  const ensure = (): void => {
    if (disposed) return;
    context ??= factory();
    master ??= context.createGain();
    master.gain.value = muted ? 0 : volume;
    master.connect(context.destination);
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
    state: () => ({ volume, muted, contextReady: context !== undefined }),
    start: async () => {
      ensure();
      if (context?.resume) await context.resume();
    },
    play: (cue) => {
      ensure();
      if (context && master && !muted) playProcedural(context, cue, master);
    },
    handleEvent: (event, selfId) => {
      if (event.id !== undefined && !remember(event.id)) return;
      for (const request of routeEvent(event, selfId)) {
        ensure();
        if (context && master && !muted) playProcedural(context, request.cue, master);
      }
    },
    playItem: (itemId) => {
      const cue = itemCue(itemId);
      if (cue) {
        ensure();
        if (context && master && !muted) playProcedural(context, cue, master);
      }
    },
    startAmbience: (kind = 'room') => {
      ensure();
      if (!context || !master || ambience) return;
      ambience = playAmbience(context, master, kind);
    },
    stopAmbience: () => {
      ambience?.stop?.();
      ambience?.disconnect?.();
      ambience = undefined;
    },
    setVolume: (next) => {
      volume = clamp(next);
      storage.setItem(VOLUME_KEY, String(volume));
      if (master) master.gain.value = muted ? 0 : volume;
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
      ambience?.stop?.();
      ambience?.disconnect?.();
      ambience = undefined;
      receipts.clear();
      receiptOrder.length = 0;
      master?.disconnect?.();
      intro.dispose();
      if (context?.close) await context.close();
      context = undefined;
      master = undefined;
    },
  };
}

function clamp(value: number): number {
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0.65;
}
