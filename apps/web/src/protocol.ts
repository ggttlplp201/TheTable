import type { AuthorizedRoomView, GameCommand, RoleId, SpectatorView } from '@the-table/game';

export interface ChatMessage {
  id: string;
  at: number;
  fromPlayerId: string;
  channel: 'GLOBAL' | 'PRIVATE';
  toPlayerId?: string;
  text: string;
}

export type RoomView = AuthorizedRoomView & { viewerPlayerId?: string; spectator?: false; messages?: ChatMessage[] };

export interface RevisionAck {
  revision: number;
}

export type SpectatorRoomView = SpectatorView & {
  spectator: true;
  viewerPlayerId?: string;
  messages?: ChatMessage[];
};

export type AnyRoomView = RoomView | SpectatorRoomView;

export function isSpectatorView(view: AnyRoomView): view is SpectatorRoomView {
  return view.spectator === true;
}

export interface ClientError {
  code: string;
  message: string;
  revision?: number;
}

export interface VoiceIceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

export interface VoiceCapability {
  enabled: boolean;
  iceServers: VoiceIceServer[];
  relayConfigured: boolean;
}

export type VoiceSignal =
  | { type: 'offer' | 'answer'; sdp: string }
  | { type: 'candidate'; candidate: string; sdpMid?: string | null; sdpMLineIndex?: number | null };

export type Result<T> = { ok: true; data: T } | { ok: false; error: ClientError };

export interface SessionPayload {
  reconnectToken: string;
  playerId?: string;
  view: AnyRoomView;
  voice?: VoiceCapability;
}

/** Seed, actor, clock and timeout fields never belong to client input. */
export type PlayerCommand = Exclude<GameCommand, { type: 'START_MATCH' }>;
type Envelope<C extends PlayerCommand> = C extends PlayerCommand ? {
  idempotencyKey: string;
  expectedRevision: number;
  roomId: string;
  type: C['type'];
  payload: Omit<C, 'type'>;
} : never;
export type CommandPayload = Envelope<PlayerCommand>;

export interface SessionSnapshot {
  code: string;
  reconnectToken: string;
  playerId: string;
}

export const ROLE_COPY: Record<RoleId, { name: string; kit: string; ability: string }> = {
  enforcer: { name: 'Enforcer', kit: 'Pistol, Bullet, 2 coins', ability: 'Quick Draw fires your Pistol once without ammunition.' },
  medic: { name: 'Medic', kit: 'Medicine, Antidote, 3 coins', ability: 'Your Medicine revives another player to 3 HP.' },
  smuggler: { name: 'Smuggler', kit: 'Cloth, Bag, 4 coins', ability: 'See four private Black Market offers.' },
  locksmith: { name: 'Locksmith', kit: 'Key, Lockpick, 3 coins', ability: 'Read the Standard Chest once each full round.' },
  broker: { name: 'Broker', kit: 'Spyglass, 6 coins', ability: 'Gain 1 extra coin when reselling an item.' },
  scavenger: { name: 'Scavenger', kit: 'Knife, Medicine, 3 coins', ability: 'Gain 1 coin after a forced Intermission discard.' },
};

export const ROLES = Object.keys(ROLE_COPY) as RoleId[];
