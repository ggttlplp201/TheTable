import { ITEM_BY_ID, RULES } from './content.js';
import { event, id, requireRule } from './internal.js';
import type { ItemStack, PlayerState, RoomState } from './types.js';

export function heldItems(player: PlayerState): ItemStack[] {
  return [...player.inventory.visible, ...player.inventory.pockets.map((pocket) => pocket.item)].filter((item): item is ItemStack => item !== null);
}
export function owned(player: PlayerState, instanceId: string, visibleOnly = false): ItemStack {
  const stack = (visibleOnly ? player.inventory.visible : heldItems(player)).find((item) => item?.instanceId === instanceId);
  requireRule(stack, 'NOT_FOUND', 'Item is not in the eligible inventory.');
  return stack;
}
export function stack(room: RoomState, itemId: string, quantity = 1): ItemStack {
  requireRule(ITEM_BY_ID[itemId], 'INVALID_STATE', `Unknown item ${itemId}.`);
  return { instanceId: id(room, 'item'), itemId, quantity };
}
export function removeItem(player: PlayerState, instanceId: string): ItemStack {
  const index = player.inventory.visible.findIndex((item) => item?.instanceId === instanceId);
  if (index >= 0) { const item = player.inventory.visible[index]!; player.inventory.visible[index] = null; return item; }
  const pocket = player.inventory.pockets.find((entry) => entry.item?.instanceId === instanceId);
  requireRule(pocket?.item, 'NOT_FOUND', 'Item is not owned.');
  const item = pocket.item; pocket.item = null; return item;
}
export function returnToPool(room: RoomState, item: ItemStack): void {
  if (ITEM_BY_ID[item.itemId]!.rarity === 'ARTIFACT') {
    if (!room.match!.artifactPool.includes(item.itemId)) room.match!.artifactPool.push(item.itemId);
  } else if (item.itemId === 'passage-token') room.match!.passageTokenAvailable = true;
}
export function consume(room: RoomState, player: PlayerState, item: ItemStack, now: number): void {
  if (item.quantity > 1) item.quantity -= 1;
  else { removeItem(player, item.instanceId); returnToPool(room, item); }
  syncEquipment(room, player, now);
}
export function acquire(room: RoomState, player: PlayerState, incoming: ItemStack, now: number): void {
  const max = ITEM_BY_ID[incoming.itemId]!.maxStack;
  if (max > 1) {
    for (const existing of player.inventory.visible) {
      if (existing?.itemId !== incoming.itemId || existing.quantity >= max) continue;
      const amount = Math.min(max - existing.quantity, incoming.quantity);
      existing.quantity += amount; incoming.quantity -= amount;
      if (incoming.quantity === 0) return;
    }
  }
  const free = player.inventory.visible.indexOf(null);
  if (free >= 0) {
    player.inventory.visible[free] = incoming;
    syncEquipment(room, player, now);
  } else {
    (room.overflows ??= []).push({ id: id(room, 'overflow'), playerId: player.id, incoming, deadlineAt: now + RULES.overflowMs });
    if (room.turn && room.turn.pausedRemainingMs === undefined) room.turn.pausedRemainingMs = Math.max(0, room.turn.deadlineAt - now);
    event(room, now, 'OVERFLOW', `${player.name} must choose an inventory replacement.`, player.id);
  }
}
export function syncEquipment(room: RoomState, player: PlayerState, now: number): void {
  const hasBag = player.inventory.visible.some((item) => item?.itemId === 'bag');
  if (hasBag && player.inventory.pockets.length === 1) player.inventory.pockets.push({ item: null, protectedBySafe: false, source: 'BAG' });
  if (!hasBag && player.inventory.pockets.length > 1) {
    const extra = player.inventory.pockets.pop()!;
    if (extra.item) acquire(room, player, extra.item, now);
  }
  const safes = player.inventory.visible.filter((item) => item?.itemId === 'safe');
  const assignments = player.safeAssignments ??= {};
  for (const key of Object.keys(assignments)) if (!safes.some((safe) => safe!.instanceId === key) || assignments[key]! >= player.inventory.pockets.length) delete assignments[key];
  for (const safe of safes) {
    if (assignments[safe!.instanceId] === undefined) {
      const free = player.inventory.pockets.findIndex((_, index) => !Object.values(assignments).includes(index));
      if (free >= 0) assignments[safe!.instanceId] = free;
    }
  }
  player.inventory.pockets.forEach((pocket, index) => { pocket.protectedBySafe = Object.values(assignments).includes(index); });
}
export function disposeInventory(room: RoomState, player: PlayerState): void {
  for (const item of heldItems(player)) returnToPool(room, item);
  for (const choice of room.overflows ?? []) if (choice.playerId === player.id) returnToPool(room, choice.incoming);
  room.overflows = (room.overflows ?? []).filter((choice) => choice.playerId !== player.id);
  player.inventory.visible = Array<null>(RULES.visibleSlots).fill(null);
  player.inventory.pockets = [{ item: null, protectedBySafe: false, source: 'DEFAULT' }];
  player.inventory.coins = 0;
  player.safeAssignments = {};
}
export function resolveOverflow(room: RoomState, choiceId: string, now: number, replaceInstanceId?: string): void {
  const choice = room.overflows!.find((entry) => entry.id === choiceId)!;
  const player = room.players.find((entry) => entry.id === choice.playerId)!;
  const incoming = choice.incoming;
  room.overflows = room.overflows!.filter((entry) => entry.id !== choiceId);
  let discarded = incoming;
  if (replaceInstanceId) {
    owned(player, replaceInstanceId, true);
    discarded = removeItem(player, replaceInstanceId);
    // Put incoming in the newly free slot before losing Bag can eject a Pocket item.
    player.inventory.visible[player.inventory.visible.indexOf(null)] = incoming;
    syncEquipment(room, player, now);
  }
  returnToPool(room, discarded);
  if (player.roleId === 'scavenger' && room.round?.phase === 'INTERMISSION' && player.abilities!.salvageRound !== room.round.number) {
    player.inventory.coins += 1; player.abilities!.salvageRound = room.round.number;
  }
  event(room, now, 'OVERFLOW_RESOLVED', `${player.name} resolved their inventory overflow.`, player.id);
}
