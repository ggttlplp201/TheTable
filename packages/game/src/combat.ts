import { ITEM_BY_ID, RULES } from './content.js';
import { event, id, living, playerById, requireRule } from './internal.js';
import { acquire, consume, disposeInventory, heldItems, owned, removeItem, syncEquipment } from './inventory.js';
import { bankObjective, failObjective } from './objectives.js';
import type { ItemStack, PlayerState, RoomState } from './types.js';

export function adjacent(room: RoomState, first: PlayerState, second: PlayerState): boolean {
  const seats = room.match!.fixedSeats;
  const distance = Math.abs(seats.indexOf(first.seat) - seats.indexOf(second.seat));
  return first.id !== second.id && (distance === 1 || distance === seats.length - 1);
}
/** Shared by direct attacks and open threats so both explain the same rule failure. */
export function weaponFailure(room: RoomState, actor: PlayerState, target: PlayerState, weapon: ItemStack, quickDraw = false): string | undefined {
  if (actor.life !== 'ACTIVE') return 'You cannot use a weapon while Downed, dead, or outside the table.';
  if (actor.id === target.id) return 'You cannot attack or threaten yourself.';
  if (target.life !== 'ACTIVE') return `${target.name} is ${target.life.toLowerCase()} and cannot be attacked or threatened.`;
  if (weapon.itemId === 'knife') return adjacent(room, actor, target) ? undefined : 'A Knife can only reach a player seated directly beside you.';
  if (weapon.itemId !== 'pistol') return `${ITEM_BY_ID[weapon.itemId]!.name} is not a weapon. Use a Knife or Pistol for an Open Threat.`;
  const canQuickDraw = actor.roleId === 'enforcer' && !actor.abilities!.quickDrawUsed;
  if (quickDraw && !canQuickDraw) return actor.roleId === 'enforcer' ? 'Quick Draw has already been used this match. Uncheck Quick Draw to use a Bullet.' : 'Only the Enforcer can use Quick Draw.';
  if (!heldItems(actor).some(item => item.itemId === 'bullet') && !canQuickDraw) return actor.roleId === 'enforcer' ? 'Your Pistol needs a Bullet. You have none, and Quick Draw has already been used this match.' : 'Your Pistol needs a Bullet. You have no ammunition.';
  return undefined;
}
export function legalWeapon(room: RoomState, actor: PlayerState, target: PlayerState, weapon: ItemStack, quickDraw = false): boolean {
  return weaponFailure(room, actor, target, weapon, quickDraw) === undefined;
}
export function damage(room: RoomState, actor: PlayerState, target: PlayerState, amount: number, now: number, direct: boolean): void {
  requireRule(target.life === 'ACTIVE', 'INVALID_TARGET', 'Damage requires a living non-Downed target.');
  if (direct) {
    const armor = target.inventory.visible.find((item) => item?.itemId === 'armor');
    if (armor) { consume(room, target, armor, now); event(room, now, 'ARMOR_BLOCKED', `${target.name}'s Armor blocked the entire hit.`, actor.id, [target.id]); return; }
  }
  target.hp = Math.max(0, target.hp - amount);
  event(room, now, direct ? 'DAMAGE' : 'POISON_DAMAGE', `${target.name} took ${amount} damage.`, actor.id, [target.id]);
  if (target.hp > 0) return;
  target.life = 'DOWNED';
  const down = event(room, now, 'DOWNED', `${target.name} is Downed.`, actor.id, [target.id]);
  target.downed = {
    aggressorId: actor.id, downedAt: now, eventId: down.id,
    expiresRound: room.round!.number + (actor.seat <= room.turn!.activeSeat ? 1 : 0), expiresSeat: actor.seat,
  };
  room.match!.history.downs.push({ actorId: actor.id, targetId: target.id, eventId: down.id, sequence: down.sequence, recovered: false });
  if (actor.id !== target.id && actor.life === 'ACTIVE') room.turn!.immediateLoot = { playerId: actor.id, targetId: target.id, downEventId: down.id };
}
export function attack(room: RoomState, actor: PlayerState, target: PlayerState, weapon: ItemStack, now: number, quickDraw = false): void {
  const failure = weaponFailure(room, actor, target, weapon, quickDraw);
  requireRule(!failure, 'INVALID_TARGET', failure ?? '');
  if (weapon.itemId === 'knife') consume(room, actor, weapon, now);
  else {
    const bullet = heldItems(actor).find((item) => item.itemId === 'bullet');
    if (quickDraw || !bullet) actor.abilities!.quickDrawUsed = true;
    else consume(room, actor, bullet, now);
  }
  event(room, now, 'WEAPON_USED', `${actor.name} used ${ITEM_BY_ID[weapon.itemId]!.name}.`, actor.id, [target.id], undefined, { itemId: weapon.itemId });
  damage(room, actor, target, Number(ITEM_BY_ID[weapon.itemId]!.effect.damage), now, true);
}
export function revive(room: RoomState, actor: PlayerState, target: PlayerState, medicine: ItemStack, now: number): void {
  requireRule(target.life === 'DOWNED' && medicine.itemId === 'medicine', 'INVALID_TARGET', 'A Downed player and Medicine are required.');
  const downEvent = target.downed!.eventId;
  consume(room, actor, medicine, now);
  target.life = 'ACTIVE';
  target.hp = Number(ITEM_BY_ID.medicine!.effect.reviveHp) + (actor.roleId === 'medic' && actor.id !== target.id ? 1 : 0);
  delete target.downed;
  const history = room.match!.history.downs.find((entry) => entry.eventId === downEvent)!;
  history.recovered = true;
  room.match!.history.revives.push({ actorId: actor.id, targetId: target.id, eventId: downEvent });
  if (room.turn?.immediateLoot?.downEventId === downEvent) delete room.turn.immediateLoot;
  event(room, now, 'REVIVED', `${actor.name} revived ${target.name} to ${target.hp} HP.`, actor.id, [target.id]);
}
export function loot(room: RoomState, actor: PlayerState, target: PlayerState, instanceId: string, now: number): void {
  requireRule(target.life === 'DOWNED' && actor.life === 'ACTIVE' && actor.id !== target.id, 'INVALID_TARGET', 'Loot requires another Downed player.');
  owned(target, instanceId, true);
  const item = removeItem(target, instanceId);
  syncEquipment(room, target, now);
  acquire(room, actor, item, now);
  room.match!.history.loots.push({ actorId: actor.id, targetId: target.id, eventId: target.downed!.eventId });
  event(room, now, 'LOOTED', `${actor.name} looted ${ITEM_BY_ID[item.itemId]!.name} from ${target.name}.`, actor.id, [target.id]);
}
export function permanentlyDie(room: RoomState, player: PlayerState, now: number): void {
  const killerId = player.downed!.aggressorId;
  player.life = 'DEAD'; player.hp = 0; player.score = 0;
  delete player.downed;
  player.statuses = [];
  room.match!.history.deaths.push({ playerId: player.id, killerId, at: now });
  disposeInventory(room, player);
  event(room, now, 'DEATH', `${player.name} permanently died.`, killerId, [player.id]);
  if (player.objective!.objectiveId === 'martyr' && room.match!.history.deaths.length === 1) bankObjective(room, player, now, true);
  else failObjective(room, player, 'You permanently died before banking a successful exit.', now);
}
/** Concession is a departure with no killer and no permanent-death objective credit. */
export function concedePlayer(room: RoomState, player: PlayerState, now: number): void {
  requireRule(player.life === 'ACTIVE' && player.objective?.status === 'FAILED', 'NOT_ELIGIBLE', 'Only an active player with a failed contract may concede.');
  player.life = 'DEAD'; player.conceded = true; player.hp = 0; player.score = 0;
  player.statuses = [];
  delete player.downed;
  disposeInventory(room, player);
  if (room.turn?.immediateLoot && (room.turn.immediateLoot.playerId === player.id || room.turn.immediateLoot.targetId === player.id)) delete room.turn.immediateLoot;
  event(room, now, 'PLAYER_CONCEDED', `${player.name} conceded and left the table.`, player.id);
}
export function expireRescueWindows(room: RoomState, seat: number, now: number): void {
  // A departed aggressor retains their fixed scheduling position for rescue deadlines.
  const boundary = room.round!.number * 4 + seat;
  const due = room.players.filter((player) => player.life === 'DOWNED' && player.downed!.expiresRound * 4 + player.downed!.expiresSeat <= boundary).sort((a, b) => a.downed!.downedAt - b.downed!.downedAt || a.seat - b.seat);
  for (const player of due) permanentlyDie(room, player, now);
}
export function startPoisonTicks(room: RoomState, player: PlayerState, now: number): void {
  if (player.life !== 'ACTIVE') return;
  for (const status of player.statuses ?? []) {
    if (status.kind !== 'POISON' || status.remainingTurns <= 0 || player.life !== 'ACTIVE') continue;
    status.remainingTurns -= 1;
    const source = playerById(room, status.sourcePlayerId);
    room.match!.history.poisonTicks.push({ actorId: source.id, targetId: player.id });
    damage(room, source, player, Number(ITEM_BY_ID.poison!.effect.damage), now, false);
  }
  player.statuses = (player.statuses ?? []).filter((status) => status.remainingTurns > 0);
}
export function applyStatus(room: RoomState, actor: PlayerState, target: PlayerState, kind: 'POISON' | 'HANDCUFFED'): void {
  target.statuses ??= [];
  if (kind === 'HANDCUFFED') target.statuses = target.statuses.filter((status) => status.kind !== kind);
  target.statuses.push({ id: id(room, 'status'), kind, sourcePlayerId: actor.id, remainingTurns: kind === 'POISON' ? Number(ITEM_BY_ID.poison!.effect.ownerTurns) : 1, appliedTurn: room.match!.turnSerial });
}
export function mayCommunicate(player: PlayerState): boolean { return living(player); }
export { RULES };
