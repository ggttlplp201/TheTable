import { GameError, type ActionEvent, type ActionEventPresentation, type PlayerState, type RoomState } from './types.js';
export function requireRule(condition: unknown, code: GameError['code'], message: string): asserts condition {
  if (!condition) throw new GameError(code, message);
}
export function playerById(room: RoomState, id: string): PlayerState {
  const player = room.players.find((candidate) => candidate.id === id);
  requireRule(player, 'NOT_FOUND', 'Player does not belong to this room.');
  return player;
}
export function living(player: PlayerState): boolean { return player.life === 'ACTIVE' || player.life === 'DOWNED'; }
export function id(room: RoomState, prefix: string): string {
  return `${room.id}:match-${room.matchSerial ?? 0}:${prefix}:${room.match!.nextId++}`;
}
export function event(room: RoomState, now: number, kind: string, publicText: string, actorId?: string, targetIds: string[] = [], privatePayloads?: Record<string, unknown>, presentation?: ActionEventPresentation): ActionEvent {
  const result: ActionEvent = {
    id: id(room, 'event'), sequence: (room.events?.at(-1)?.sequence ?? 0) + 1,
    at: now, kind, publicText, targetIds,
    ...(actorId === undefined ? {} : { actorId }),
    ...(privatePayloads === undefined ? {} : { privatePayloads }),
    ...(presentation === undefined ? {} : { presentation }),
  };
  (room.events ??= []).push(result);
  return result;
}
