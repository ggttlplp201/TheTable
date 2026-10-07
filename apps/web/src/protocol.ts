import type { AuthorizedRoomView, PlayerPrivateView, PublicPlayerView, PublicRoomView, RoleId } from '@the-table/game';

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

export interface SpectatorRoomView {
  public: PublicRoomView;
  players: Array<{ public: PublicPlayerView; private: PlayerPrivateView }>;
  chests: unknown[];
  shop?: unknown;
  events: unknown[];
  capabilities: [];
  spectator: true;
  viewerPlayerId?: string;
  messages?: ChatMessage[];
}

export type AnyRoomView = RoomView | SpectatorRoomView;

export function isSpectatorView(view: AnyRoomView): view is SpectatorRoomView {
  return view.spectator === true;
}

export interface ClientError {
  code: string;
  message: string;
}

export type Result<T> = { ok: true; data: T } | { ok: false; error: ClientError };

export interface SessionPayload {
  reconnectToken: string;
  playerId?: string;
  view: AnyRoomView;
}

export interface CommandPayload {
  idempotencyKey: string;
  expectedRevision?: number;
  roomId?: string;
  type: string;
  payload?: Record<string, unknown>;
}

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
