import type { PublicRoomView } from '@the-table/game';
import { matchPresentationKey } from './table-presentation';

/** Contact beats shared with the public weapon animation, in seconds. */
export const WEAPON_CONTACT = { pistol: 1.5, knife: .9 } as const;
export const DOWNED_FALL_DURATION = .85;
export function downedFallProgress(seconds: number): number {
  const t = Math.max(0, Math.min(1, seconds / DOWNED_FALL_DURATION));
  return 1 - (1 - t * t) ** 2;
}
export interface PendingDowned { playerId: string; hp: number; until: number }
export interface DownedPresentationState { room: PublicRoomView; animate: boolean; pending: PendingDowned[] }
export function createDownedPresentation(room: PublicRoomView, animate: boolean): DownedPresentationState {
  return { room, animate, pending: [] };
}

/** Only health presentation waits. Commands, capabilities, deadlines and inventories remain authoritative. */
export function updateDownedPresentation(previous: DownedPresentationState, room: PublicRoomView, now: number, animate: boolean): DownedPresentationState {
  if (!animate || room.status !== 'PLAYING' || matchPresentationKey(previous.room) !== matchPresentationKey(room)) return createDownedPresentation(room, animate);
  const pending = previous.pending.filter(delay => delay.until > now && room.players.find(player => player.id === delay.playerId)?.life === 'DOWNED');
  if (room.revision > previous.room.revision) {
    const sequence = Math.max(0, ...(previous.room.events ?? []).map(event => event.sequence));
    const fresh = (room.events ?? []).filter(event => event.sequence > sequence && Math.abs(now - event.at) <= 5000);
    for (const down of fresh.filter(event => event.kind === 'DOWNED')) {
      for (const playerId of down.targetIds) {
        const before = previous.room.players.find(player => player.id === playerId);
        if (before?.life !== 'ACTIVE' || room.players.find(player => player.id === playerId)?.life !== 'DOWNED') continue;
        const damage = [...fresh].reverse().find(event => event.sequence < down.sequence && event.targetIds.includes(playerId) && (event.kind === 'DAMAGE' || event.kind === 'POISON_DAMAGE'));
        if (damage?.kind !== 'DAMAGE') continue;
        const weapon = [...fresh].reverse().find(event => event.kind === 'WEAPON_USED' && event.sequence < damage.sequence && event.actorId === down.actorId && event.targetIds.includes(playerId));
        const item = weapon?.presentation?.itemId;
        if (item !== 'pistol' && item !== 'knife') continue;
        pending.push({ playerId, hp: before.hp, until: now + WEAPON_CONTACT[item] * 1000 });
      }
    }
  }
  return { room, animate, pending };
}

export function presentedHealth(room: PublicRoomView, pending: readonly PendingDowned[]): PublicRoomView {
  if (!pending.length) return room;
  return { ...room, players: room.players.map(player => {
    const delay = pending.find(value => value.playerId === player.id);
    return delay && player.life === 'DOWNED' ? { ...player, hp: delay.hp, life: 'ACTIVE' } : player;
  }) };
}
