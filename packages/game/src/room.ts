import { createHash, randomBytes, randomUUID } from 'node:crypto';
import {
  ROLE_IDS,
  RoomError,
  type AuthorizedRoomView,
  type ActionEvent,
  type PlayerPrivateView,
  type PlayerState,
  type PublicPlayerView,
  type PublicRoomView,
  type RoleId,
  type RoomState,
  type SessionRecord,
} from './types.js';

import { projectPublicRoom, projectPrivatePlayer } from './projection.js';
export { projectPublicRoom, projectPublicPlayer, projectPrivatePlayer, projectAuthorizedRoom, projectSpectatorRoom } from './projection.js';

const CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const ROOM_CODE_LENGTH = 6;
const MAX_PLAYERS = 4;
const NAME_MAX = 24;

export interface RandomSource {
  bytes(length: number): Uint8Array;
  uuid(): string;
}

const secureRandom: RandomSource = {
  bytes: (length) => randomBytes(length),
  uuid: () => randomUUID(),
};

export interface RoomStoreOptions {
  now?: () => number;
  random?: RandomSource;
  issueSessions?: boolean;
}

export interface JoinResult {
  room: RoomState;
  player: PlayerState;
  reconnectToken: string;
}

export class RoomStore {
  readonly rooms = new Map<string, RoomState>();
  private readonly sessions = new Map<string, SessionRecord>();
  private readonly now: () => number;
  private readonly random: RandomSource;
  private readonly issueSessions: boolean;

  constructor(options: RoomStoreOptions = {}) {
    this.now = options.now ?? Date.now;
    this.random = options.random ?? secureRandom;
    this.issueSessions = options.issueSessions ?? true;
  }

  createRoom(name: string): JoinResult {
    const code = this.generateUniqueCode();
    const timestamp = this.now();
    const player = this.createPlayer(name, 0);
    const room: RoomState = {
      id: this.random.uuid(),
      code,
      revision: 1,
      status: 'LOBBY',
      hostPlayerId: player.id,
      players: [player],
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    this.rooms.set(code, room);
    return { room, player, reconnectToken: this.issueSession(player.id) };
  }

  joinRoom(codeInput: string, name: string): JoinResult {
    const code = normalizeCode(codeInput);
    const room = this.getRoom(code);
    if (room.status !== 'LOBBY') throw new RoomError('NOT_IN_LOBBY', 'The match has already started.');
    if (room.players.length >= MAX_PLAYERS) throw new RoomError('ROOM_FULL', 'This room is full.');
    const normalizedName = normalizeName(name);
    if (room.players.some((player) => player.normalizedName === normalizedName)) {
      throw new RoomError('DUPLICATE_NAME', 'That name is already in use in this room.');
    }
    const seat = firstOpenSeat(room.players);
    const player = this.createPlayer(name, seat);
    room.players.push(player);
    this.touch(room);
    return { room, player, reconnectToken: this.issueSession(player.id) };
  }

  reconnect(codeInput: string, token: string): JoinResult {
    const room = this.getRoom(normalizeCode(codeInput));
    const tokenHash = hashToken(token);
    const session = this.sessions.get(tokenHash);
    if (!session) throw new RoomError('INVALID_SESSION', 'Reconnect token is invalid or expired.');
    const player = room.players.find((candidate) => candidate.id === session.playerId);
    if (!player) throw new RoomError('INVALID_SESSION', 'Reconnect token does not belong to this room.');
    this.sessions.delete(tokenHash);
    player.connection = 'CONNECTED';
    this.touch(room);
    return { room, player, reconnectToken: this.issueSession(player.id) };
  }

  disconnect(codeInput: string, playerId: string): void {
    const room = this.getRoom(normalizeCode(codeInput));
    const player = room.players.find((candidate) => candidate.id === playerId);
    if (!player) throw new RoomError('INVALID_SESSION', 'Player is not in this room.');
    player.connection = 'DISCONNECTED';
    this.touch(room);
  }

  claimRole(codeInput: string, playerId: string, roleIdInput: string): RoomState {
    const room = this.getRoom(normalizeCode(codeInput));
    if (room.status !== 'LOBBY') throw new RoomError('NOT_IN_LOBBY', 'Roles can only be changed in the lobby.');
    if (!ROLE_IDS.includes(roleIdInput as RoleId)) throw new RoomError('ROLE_UNKNOWN', 'Unknown role.');
    const roleId = roleIdInput as RoleId;
    const player = room.players.find((candidate) => candidate.id === playerId);
    if (!player) throw new RoomError('INVALID_SESSION', 'Player is not in this room.');
    if (room.players.some((candidate) => candidate.id !== playerId && candidate.roleId === roleId)) {
      throw new RoomError('ROLE_TAKEN', 'That role is already claimed.');
    }
    player.roleId = roleId;
    player.ready = false;
    this.touch(room);
    return room;
  }

  viewFor(codeInput: string, playerId: string): AuthorizedRoomView {
    const room = this.getRoom(normalizeCode(codeInput));
    const player = room.players.find((candidate) => candidate.id === playerId);
    if (!player) throw new RoomError('INVALID_SESSION', 'Player is not in this room.');
    return { public: projectPublicRoom(room), private: projectPrivatePlayer(player, room) };
  }

  private getRoom(code: string): RoomState {
    const room = this.rooms.get(code);
    if (!room) throw new RoomError('ROOM_NOT_FOUND', 'Room not found.');
    return room;
  }

  private createPlayer(nameInput: string, seat: 0 | 1 | 2 | 3): PlayerState {
    const name = displayName(nameInput);
    return {
      id: this.random.uuid(),
      seat,
      name,
      normalizedName: normalizeName(name),
      connection: 'CONNECTED',
      ready: false,
      hp: 5,
      inventory: {
        visible: [null, null, null, null, null, null],
        pockets: [{ item: null, protectedBySafe: false, source: 'DEFAULT' }],
        coins: 0,
      },
      life: 'ACTIVE',
      score: 0,
    };
  }

  private issueSession(playerId: string): string {
    if (!this.issueSessions) return "";
    const token = Buffer.from(this.random.bytes(32)).toString('base64url');
    const timestamp = this.now();
    this.sessions.set(hashToken(token), { playerId, tokenHash: hashToken(token), createdAt: timestamp, rotatedAt: timestamp });
    return token;
  }

  private touch(room: RoomState): void {
    room.revision += 1;
    room.updatedAt = this.now();
  }

  private generateUniqueCode(): string {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const bytes = this.random.bytes(ROOM_CODE_LENGTH);
      let code = '';
      for (const byte of bytes) code += CODE_ALPHABET[byte % CODE_ALPHABET.length];
      if (!this.rooms.has(code)) return code;
    }
    throw new Error('Unable to generate a unique room code.');
  }
}

export function normalizeCode(input: string): string {
  const code = input.trim().toUpperCase();
  if (code.length !== ROOM_CODE_LENGTH || [...code].some((character) => !CODE_ALPHABET.includes(character))) {
    throw new RoomError('INVALID_CODE', 'Room code must contain six valid characters.');
  }
  return code;
}

export function normalizeName(input: string): string {
  return displayName(input).toLocaleLowerCase('en-US');
}

function displayName(input: string): string {
  const name = input.trim().replace(/\s+/g, ' ');
  if (name.length < 1 || name.length > NAME_MAX) {
    throw new RoomError('INVALID_NAME', `Name must be between 1 and ${NAME_MAX} characters.`);
  }
  return name;
}

function firstOpenSeat(players: PlayerState[]): 0 | 1 | 2 | 3 {
  const occupied = new Set(players.map((player) => player.seat));
  for (const seat of [0, 1, 2, 3] as const) if (!occupied.has(seat)) return seat;
  throw new RoomError('ROOM_FULL', 'This room is full.');
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('base64url');
}

/** GAME_RULES.md:95 and CONTENT_SCHEMA.md:59 authorize god-view only after permanent death/exit. */
