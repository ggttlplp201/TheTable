import {
  applyCommand, applyTimeout, getNextDeadline, projectAuthorizedRoom,
  projectSpectatorRoom, RoomError, RoomStore, setConnection, type RoomState,
} from '@the-table/game';
import { parseGameCommand } from './game-commands.js';
import { ProtocolError, type GameCommand } from './protocol.js';

export interface Deadline { id: string; at: number }
export interface Admission { room: RoomState; playerId: string }

/** The engine owns legality, atomic transitions, deadline defaults and allowlisted views. */
export interface GameAdapter {
  create(name: string, now: number): Admission;
  join(code: string, name: string, now: number): Admission;
  leaveLobby(code: string, playerId: string, now: number): RoomState | undefined | Promise<RoomState | undefined>;
  read(code: string): RoomState | undefined;
  command(code: string, actorId: string, command: GameCommand, now: number): void | Promise<void>;
  setConnected(code: string, playerId: string, connected: boolean, now: number): void | Promise<void>;
  project(code: string, playerId: string, spectator: boolean): unknown;
  deadlines(code: string): Deadline[];
  timeout(code: string, deadline: Deadline, now: number): void | Promise<void>;
  destroy(code: string): void;
}

/** The only transport-to-engine binding. Failed pure transitions never replace state. */
export class RoomStoreAdapter implements GameAdapter {
  constructor(readonly store = new RoomStore({ issueSessions: false }), private readonly seed?: () => number) {}
  create(name: string): Admission {
    const result = this.store.createRoom(name);
    return { room: result.room, playerId: result.player.id };
  }
  join(code: string, name: string): Admission {
    const result = this.store.joinRoom(code, name);
    // Lobby departures can leave a physical seat gap. Keep projections ordered
    // by seat when a later join fills that gap without renumbering anyone.
    result.room.players.sort((a, b) => a.seat - b.seat);
    return { room: result.room, playerId: result.player.id };
  }
  leaveLobby(code: string, playerId: string, now: number): RoomState | undefined {
    const room = this.requireRoom(code);
    if (room.status !== 'LOBBY') throw new RoomError('NOT_IN_LOBBY', 'Players can only leave their seat before the match starts.');
    if (!room.players.some(player => player.id === playerId)) throw new RoomError('INVALID_SESSION', 'Player is not in this room.');

    const next = structuredClone(room);
    next.players = next.players.filter(player => player.id !== playerId).sort((a, b) => a.seat - b.seat);
    if (next.players.length === 0) {
      this.store.rooms.delete(code);
      return undefined;
    }
    if (next.hostPlayerId === playerId) {
      next.hostPlayerId = next.players.find(player => player.connection === 'CONNECTED')?.id ?? next.players[0]!.id;
    }
    next.revision += 1;
    next.updatedAt = now;
    this.store.rooms.set(code, next);
    return next;
  }
  read(code: string): RoomState | undefined { return this.store.rooms.get(code); }
  command(code: string, actorId: string, command: GameCommand, now: number): void {
    const next = applyCommand(this.requireRoom(code), actorId, parseGameCommand(command, this.seed), now);
    this.store.rooms.set(code, next);
  }
  setConnected(code: string, playerId: string, connected: boolean, now: number): void {
    const room = this.requireRoom(code);
    const player = room.players.find(candidate => candidate.id === playerId);
    if (!player) throw new ProtocolError('INVALID_SESSION', 'Player is not in this room.');
    const connection = connected ? 'CONNECTED' : 'DISCONNECTED';
    if (player.connection === connection) return;
    this.store.rooms.set(code, setConnection(room, playerId, connection, now));
  }
  project(code: string, playerId: string, spectator: boolean): unknown {
    const room = this.requireRoom(code);
    return spectator ? projectSpectatorRoom(room, playerId) : projectAuthorizedRoom(room, playerId);
  }
  deadlines(code: string): Deadline[] {
    const at = getNextDeadline(this.requireRoom(code));
    return at === undefined ? [] : [{ id: `deadline:${at}`, at }];
  }
  timeout(code: string, deadline: Deadline, now: number): void {
    const room = this.requireRoom(code);
    if (getNextDeadline(room) !== deadline.at) return;
    this.store.rooms.set(code, applyTimeout(room, now));
  }
  destroy(code: string): void { this.store.rooms.delete(code); }
  private requireRoom(code: string): RoomState {
    const room = this.read(code);
    if (!room) throw new ProtocolError('ROOM_NOT_FOUND', 'Room not found or expired.');
    return room;
  }
}
