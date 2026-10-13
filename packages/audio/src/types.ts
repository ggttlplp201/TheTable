export type AudioAudience = 'PUBLIC' | 'PRIVATE';

export const AUDIO_CUE_IDS = {
  // Local controls and inventory handling are intentionally separate from
  // authoritative event cues: callers may play them before an action resolves.
  taskReveal: 'task.reveal', taskStamp: 'task.stamp', taskCoin: 'task.coin', taskCancel: 'task.cancel', turnSwitch: 'turn.switch', tutorialPage: 'tutorial.page',
  uiSelect: 'ui.select',
  uiSetDown: 'ui.set-down',
  uiConfirm: 'ui.confirm',
  uiReject: 'ui.reject',
  uiCoins: 'ui.coins', uiPocket: 'ui.pocket', uiInventory: 'ui.inventory',
  lobbyJoin: 'lobby.join', lobbyReady: 'lobby.ready', lobbyMatch: 'lobby.match',
  weaponKnife: 'item.knife',
  weaponPistol: 'item.pistol',
  bullet: 'item.bullet',
  weaponPoison: 'item.poison',
  medicine: 'item.medicine',
  stimulant: 'item.stimulant',
  antidote: 'item.antidote',
  armor: 'item.armor',
  cloth: 'item.cloth',
  bag: 'item.bag',
  safe: 'item.safe', spyglass: 'item.spyglass', pickpocket: 'item.pickpocket',
  key: 'item.key', lockpick: 'item.lockpick', crowbar: 'item.crowbar', blackKey: 'item.black-key', handcuffs: 'item.handcuffs',
  brassIdol: 'item.brass-idol', glassEye: 'item.glass-eye', redLedger: 'item.red-ledger', passageToken: 'item.passage-token',
  chest: 'item.chest',
  matchStarted: 'event.match-started', matchEnded: 'event.match-ended',
  turnStarted: 'event.turn-started', turnEnded: 'event.turn-ended', intermission: 'event.intermission', shopperSkipped: 'event.shopper-skipped',
  tradeOffered: 'event.trade-offered', tradeAccepted: 'event.trade-accepted', tradeDeclined: 'event.trade-declined', tradeCancelled: 'event.trade-cancelled',
  threatOffered: 'event.threat-offered', threatComplied: 'event.threat-complied', threatRefused: 'event.threat-refused', threatCancelled: 'event.threat-cancelled',
  weaponUsed: 'event.weapon-used', damage: 'event.damage', poisonTick: 'event.poison-tick', healed: 'event.healed', poisonCured: 'event.poison-cured', armorBlocked: 'event.armor-blocked', handcuffed: 'event.handcuffed',
  downed: 'event.downed',
  revived: 'event.revived', looted: 'event.looted',
  death: 'event.death',
  exit: 'event.exit',
  results: 'event.results',
  chestRefreshed: 'event.chest-refreshed', chestOpened: 'event.chest-opened', chestInspected: 'event.chest-inspected',
  purchased: 'event.purchased', sold: 'event.sold', pocketFilled: 'event.pocket-filled', marketRerolled: 'event.market-rerolled', pocketInspected: 'event.pocket-inspected', pickpocketed: 'event.pickpocketed',
  objectiveReady: 'event.objective-ready', objectiveLocked: 'event.objective-locked', objectiveBanked: 'event.objective-banked', overflow: 'event.overflow', overflowResolved: 'event.overflow-resolved',
  privateInspection: 'private.inspection', privateChestInspection: 'private.chest-inspection',
  turn: 'turn.start',
  turnEndedTick: 'turn.end',
  warning: 'turn.warning',
  responseWarning: 'turn.response-warning',
  door: 'world.door',
  footstep: 'world.footstep',
  chair: 'world.chair', chairScrape: 'world.chair-scrape', chairSettle: 'world.chair-settle', tableSettle: 'world.table-settle', coinScatter: 'world.coin-scatter',
  room: 'world.room',
  shop: 'world.shop',
  intro: 'intro.sting',
  // Handling an item (pick up, hand over, pocket, buy, sell) by material. Never the item's use sound.
  handleMetal: 'handle.metal', handleGlass: 'handle.glass', handleCloth: 'handle.cloth', handleWood: 'handle.wood', handlePaper: 'handle.paper', handleCoin: 'handle.coin',
} as const;

/** Music beds. 'threat' is a layer that sits on top of whichever bed is playing. */
export const MUSIC_TRACK_IDS = ['table', 'shop', 'market', 'after'] as const;
export type MusicTrackId = typeof MUSIC_TRACK_IDS[number];

export type AudioCueId = typeof AUDIO_CUE_IDS[keyof typeof AUDIO_CUE_IDS];

export interface AudioStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface AudioParamLike {
  value: number;
  setValueAtTime?(value: number, when: number): void;
  linearRampToValueAtTime?(value: number, when: number): void;
  exponentialRampToValueAtTime?(value: number, when: number): void;
  cancelScheduledValues?(when: number): void;
}

export interface AudioNodeLike {
  connect(destination: AudioNodeLike): AudioNodeLike;
  disconnect?(): void;
}

export interface OscillatorLike extends AudioNodeLike {
  type: string;
  frequency: AudioParamLike;
  detune?: AudioParamLike;
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
  start(when?: number, offset?: number): void;
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
  /* Optional master-chain nodes. Missing nodes (tests, old browsers) fall back to a direct connection. */
  createWaveShaper?(): AudioNodeLike & { curve: Float32Array | null };
  createConvolver?(): AudioNodeLike & { buffer: BufferLike | null };
  createDynamicsCompressor?(): AudioNodeLike & { threshold: AudioParamLike; ratio: AudioParamLike };
}

export type AudioContextFactory = () => AudioContextLike;

export interface ProjectedAudioEvent {
  id?: string;
  kind: string;
  actorId?: string;
  targetIds?: readonly string[];
  presentation?: { itemId?: string; chestKind?: 'STANDARD' | 'BLACK'; market?: 'PUBLIC' };
  privatePayloads?: Readonly<Record<string, unknown>>;
}

export interface AudioCueRequest {
  cue: AudioCueId;
  audience: AudioAudience;
  eventId?: string;
  /** Cosmetic timing only; never delays the authoritative action. */
  delaySeconds?: number;
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
  music?: MusicTrackId | undefined;
  threat?: boolean;
  volume: number;
  roomVolume: number;
  effectsVolume: number;
  muted: boolean;
  contextReady: boolean;
}
