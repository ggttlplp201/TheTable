import { createHash, randomBytes, randomUUID } from 'node:crypto';
import {
  ROLE_IDS,
  RoomError,
  type AuthorizedRoomView,
  type PlayerPrivateView,
  type PlayerState,
  type PublicPlayerView,
  type PublicRoomView,
  type RoleId,
  type RoomState,
  type SessionRecord,
} from './types.js';

import { canLeave } from './engine.js';

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

export function projectPublicRoom(room: RoomState): PublicRoomView {
  return {
    id: room.id,
    code: room.code,
    revision: room.revision,
    status: room.status,
    hostPlayerId: room.hostPlayerId,
    players: room.players.map(projectPublicPlayer),
    ...(room.round ? { round: structuredClone(room.round) } : {}),
    ...(room.turn ? { turn: structuredClone(room.turn) } : {}),
    ...(room.pendingTrade ? { pendingTrade: structuredClone(room.pendingTrade) } : {}),
    ...(room.pendingThreat ? { pendingThreat: {
      id: room.pendingThreat.id, actorId: room.pendingThreat.actorId, targetId: room.pendingThreat.targetId,
      mode: room.pendingThreat.mode, demandedItems: [...room.pendingThreat.demandedItems], demandedCoins: room.pendingThreat.demandedCoins,
      status: room.pendingThreat.status, deadlineAt: room.pendingThreat.deadlineAt,
      ...(room.pendingThreat.mode === 'OPEN' ? { committedItemId: room.pendingThreat.committedItemId, committedItemType: room.pendingThreat.committedItemType } : {}),
    } } : {}),
    ...(room.chests ? { chests: room.chests.map((chest) => ({ kind: chest.kind, availability: chest.availability, ...(chest.refreshRound === undefined ? {} : { refreshRound: chest.refreshRound }) })) } : {}),
    ...(room.shop ? { shop: { publicOffers: structuredClone(room.shop.publicOffers), publicPurchasedBy: { ...room.shop.publicPurchasedBy }, order: [...room.shop.order], activeShopperIndex: room.shop.activeShopperIndex } } : {}),
    ...(room.overflows ? { overflows: room.overflows.map((choice) => ({ id: choice.id, playerId: choice.playerId, deadlineAt: choice.deadlineAt })) } : {}),
    ...(room.events ? { events: room.events.map((entry) => ({ id: entry.id, sequence: entry.sequence, at: entry.at, kind: entry.kind, publicText: entry.publicText, targetIds: [...entry.targetIds], ...(entry.actorId ? { actorId: entry.actorId } : {}), ...(entry.presentation ? { presentation: structuredClone(entry.presentation) } : {}) })) } : {}),
  };
}

export function projectPublicPlayer(player: PlayerState): PublicPlayerView {
  const objectiveCompleted = player.objective?.status === 'EXIT_READY' || player.objective?.status === 'BANKED';
  return {
    id: player.id,
    seat: player.seat,
    name: player.name,
    connection: player.connection,
    ...(player.roleId ? { roleId: player.roleId } : {}),
    ready: player.ready,
    hp: player.hp,
    visibleInventory: player.inventory.visible.map((item) => item ? { ...item } : null),
    pocketOccupancy: player.inventory.pockets.map((pocket) => pocket.item !== null),
    coins: player.inventory.coins,
    life: player.life,
    objectiveCompleted,
    score: player.score,
    ...(player.statuses ? { statuses: structuredClone(player.statuses) } : {}),
    ...(player.exitOrder === undefined ? {} : { exitOrder: player.exitOrder }),
    ...(player.objective?.revealed ? { revealedObjective: structuredClone(player.objective) } : {}),
  };
}

export function projectPrivatePlayer(player: PlayerState, room?: RoomState): PlayerPrivateView {
  return {
    playerId: player.id,
    pockets: player.inventory.pockets.map((pocket) => ({
      ...pocket,
      item: pocket.item ? { ...pocket.item } : null,
    })),
    ...(player.objective ? { objective: structuredClone(player.objective) } : {}),
    ...(room?.shop ? { blackMarket: structuredClone(room.shop.privateOffers[player.id] ?? []) } : {}),
    ...(room ? {
      inspections: (room.events ?? []).flatMap((entry) => entry.privatePayloads?.[player.id] === undefined ? [] : [{ eventId: entry.id, payload: structuredClone(entry.privatePayloads[player.id]) }]),
      overflows: structuredClone((room.overflows ?? []).filter((choice) => choice.playerId === player.id)),
      capabilities: playerCapabilities(room, player),
    } : {}),
  };
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
export function projectSpectatorRoom(room: RoomState, requesterId: string): import('./types.js').SpectatorView {
  const requester = room.players.find((candidate) => candidate.id === requesterId);
  if (!requester || (requester.life !== 'DEAD' && requester.life !== 'EXITED')) throw new RoomError('INVALID_SESSION', 'Spectator access requires permanent death or exit.');
  return {
    public: projectPublicRoom(room),
    players: room.players.map((player) => ({ public: projectPublicPlayer(player), private: { ...projectPrivatePlayer(player, room), capabilities: [] } })),
    chests: (room.chests ?? []).map((chest) => ({ kind: chest.kind, availability: chest.availability, loot: structuredClone(chest.loot), ...(chest.refreshRound === undefined ? {} : { refreshRound: chest.refreshRound }) })),
    ...(room.shop ? { shop: structuredClone(room.shop) } : {}),
    events: (room.events ?? []).map((entry) => ({ id: entry.id, sequence: entry.sequence, at: entry.at, kind: entry.kind, publicText: entry.publicText, targetIds: [...entry.targetIds], ...(entry.actorId ? { actorId: entry.actorId } : {}), ...(entry.presentation ? { presentation: structuredClone(entry.presentation) } : {}) })),
    capabilities: [],
  };
}
export function projectAuthorizedRoom(room: RoomState, requesterId: string): AuthorizedRoomView {
  const player = room.players.find((candidate) => candidate.id === requesterId);
  if (!player) throw new RoomError('INVALID_SESSION', 'Player is not in this room.');
  return { public: projectPublicRoom(room), private: projectPrivatePlayer(player, room) };
}


function playerCapabilities(room: RoomState, player: PlayerState): string[] {
  if (player.connection !== 'CONNECTED' || (player.life !== 'ACTIVE' && player.life !== 'DOWNED')) return [];
  if (room.status === 'LOBBY') return ['CHAT', 'CLAIM_ROLE', 'READY', ...(room.hostPlayerId === player.id ? ['START_MATCH'] : [])];
  if (room.status !== 'PLAYING') return room.hostPlayerId === player.id ? ['REMATCH'] : [];
  const capabilities = ['CHAT'];
  if (room.pendingTrade) return room.pendingTrade.targetId === player.id ? [...capabilities, 'RESPOND_TRADE'] : capabilities;
  if (room.pendingThreat) return room.pendingThreat.targetId === player.id ? [...capabilities, 'RESPOND_THREAT'] : capabilities;
  if (room.overflows?.length) return room.overflows.some((choice) => choice.playerId === player.id) ? [...capabilities, 'OVERFLOW_CHOICE'] : capabilities;
  if (room.round?.phase === 'INTERMISSION' && room.shop?.order[room.shop.activeShopperIndex] === player.id && player.life === 'ACTIVE') capabilities.push('BUY', 'SELL', 'POCKET', 'ASSIGN_SAFE', 'REROLL_MARKET', 'FINISH_SHOPPING');
  if (room.turn?.activeSeat === player.seat) {
    capabilities.push('END_TURN');
    if (!room.turn.primaryUsed) {
      capabilities.push('USE_ITEM');
      if (player.life === 'ACTIVE' && !room.turn.startedDowned && !player.statuses?.some((status) => status.kind === 'HANDCUFFED' && status.appliedTurn < room.turn!.serial)) capabilities.push('TRADE', 'THREAT');
    }
    if (player.life === 'ACTIVE' && !room.turn.startedDowned && !room.turn.downedInteractionUsed) capabilities.push('DOWNED_INTERACTION');
    if (canLeave(room, player)) capabilities.push('LEAVE_TABLE', 'STAY');
  }
  if (room.turn?.immediateLoot?.playerId === player.id) capabilities.push('LOOT_DOWNED');
  if (player.life === 'ACTIVE' && player.roleId === 'locksmith' && player.abilities?.locksmithRound !== room.round?.number && room.chests?.some((chest) => chest.kind === 'STANDARD' && chest.availability === 'AVAILABLE')) capabilities.push('INSPECT_CHEST');
  return capabilities;
}
