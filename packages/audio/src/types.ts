export type AudioAudience = 'PUBLIC' | 'PRIVATE';

export const AUDIO_CUE_IDS = {
  uiSelect: 'ui.select',
  uiSetDown: 'ui.set-down',
  uiConfirm: 'ui.confirm',
  uiReject: 'ui.reject',
  weaponKnife: 'item.knife',
  weaponPistol: 'item.pistol',
  weaponPoison: 'item.poison',
  medicine: 'item.medicine',
  antidote: 'item.antidote',
  armor: 'item.armor',
  bag: 'item.bag',
  chest: 'item.chest',
  trade: 'event.trade',
  threat: 'event.threat',
  downed: 'event.downed',
  death: 'event.death',
  exit: 'event.exit',
  results: 'event.results',
  turn: 'turn.start',
  warning: 'turn.warning',
  responseWarning: 'turn.response-warning',
  door: 'world.door',
  footstep: 'world.footstep',
  room: 'world.room',
  intro: 'intro.sting',
} as const;

export type AudioCueId = typeof AUDIO_CUE_IDS[keyof typeof AUDIO_CUE_IDS];

export interface AudioStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface AudioParamLike {
  value: number;
  setValueAtTime?(value: number, when: number): void;
  exponentialRampToValueAtTime?(value: number, when: number): void;
}

export interface AudioNodeLike {
  connect(destination: AudioNodeLike): AudioNodeLike;
  disconnect?(): void;
}

export interface OscillatorLike extends AudioNodeLike {
  type: string;
  frequency: AudioParamLike;
  start(when?: number): void;
  stop(when?: number): void;
}

export interface GainNodeLike extends AudioNodeLike {
  gain: AudioParamLike;
}

export interface FilterNodeLike extends AudioNodeLike {
  type: string;
  frequency: AudioParamLike;
  Q: AudioParamLike;
}

export interface BufferLike {
  duration: number;
  getChannelData?(channel: number): Float32Array;
}

export interface BufferSourceLike extends AudioNodeLike {
  buffer: BufferLike | null;
  loop: boolean;
  start(when?: number): void;
  stop?(when?: number): void;
}

export interface AudioContextLike {
  currentTime: number;
  state: string;
  destination: AudioNodeLike;
  sampleRate: number;
  resume?(): Promise<void>;
  close?(): Promise<void>;
  createGain(): GainNodeLike;
  createOscillator(): OscillatorLike;
  createBiquadFilter(): FilterNodeLike;
  createBuffer(channels: number, length: number, sampleRate: number): BufferLike;
  createBufferSource(): BufferSourceLike;
}

export type AudioContextFactory = () => AudioContextLike;

export interface ProjectedAudioEvent {
  id?: string;
  kind: string;
  actorId?: string;
  targetIds?: readonly string[];
  privatePayloads?: Readonly<Record<string, unknown>>;
}

export interface AudioCueRequest {
  cue: AudioCueId;
  audience: AudioAudience;
  eventId?: string;
}

export interface IntroState {
  phase: 'IDLE' | 'ARMED' | 'PLAYING' | 'COMPLETE' | 'SKIPPED';
  startedAt?: number;
  endsAt?: number;
}

export interface IntroController {
  state(): IntroState;
  arm(now?: number): IntroState;
  start(now?: number): IntroState;
  skip(now?: number): IntroState;
  tick(now?: number): IntroState;
  dispose(): void;
}

export interface AudioEngineState {
  volume: number;
  muted: boolean;
  contextReady: boolean;
}
