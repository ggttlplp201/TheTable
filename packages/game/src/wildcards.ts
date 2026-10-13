import { WILDCARDS } from '@the-table/content';
import { primary, requireTurn } from './actions.js';
import { ITEM_BY_ID, RULES } from './content.js';
import { withRandom } from './economy.js';
import { event, living, playerById, requireRule } from './internal.js';
import { acquire, owned, removeItem, returnToPool, stack, syncEquipment } from './inventory.js';
import type { ActionEventPresentation, GameCommand, ItemStack, PendingWildcard, PlayerState, RoomState, WildcardId } from './types.js';

const definition = (cardId: WildcardId) => WILDCARDS.find(card => card.id === cardId)!;
const activePlayers = (room: RoomState) => room.players.filter(player => living(player) && !player.conceded).sort((a, b) => a.seat - b.seat);
const opponents = (room: RoomState, actor: PlayerState) => room.players.filter(player => player.id !== actor.id && player.life === 'ACTIVE' && !player.conceded);
const visible = (player: PlayerState): ItemStack[] => player.inventory.visible.filter((item): item is ItemStack => item !== null);

export function grantRoundIncome(room: RoomState, now: number): void {
  const round = room.round!.number;
  if ((room.roundIncomeGrantedThrough ?? 0) >= round) return;
  const recipients = activePlayers(room);
  const amount = room.roundIncomeAmount ?? RULES.roundIncome;
  for (const player of recipients) player.inventory.coins += amount;
  room.roundIncomeGrantedThrough = round;
  event(room, now, 'ROUND_INCOME_GRANTED', `Round Income: all active players received ${amount} Gold.`, undefined, recipients.map(player => player.id), undefined,
    { roundIncomeAmount: amount, coinChanges: recipients.map(player => ({ playerId: player.id, amount })) });
}

export function unlockWildcards(room: RoomState, now: number): void {
  if (room.wildcardUnlocked || room.round!.number < RULES.wildcardUnlockRound) return;
  room.wildcardUnlocked = true;
  event(room, now, 'WILDCARD_DECK_UNLOCKED', 'The Wildcard Deck has entered play.');
}

export function drawWildcard(room: RoomState, actor: PlayerState, now: number): void {
  requireRule(room.wildcardUnlocked && room.round!.number >= RULES.wildcardUnlockRound, 'NOT_ELIGIBLE', 'Wildcards unlock at Round 3.');
  requireRule(!room.wildcardDrawUsedByPlayer?.[actor.id], 'NOT_ELIGIBLE', 'Your once-per-match Wildcard draw is spent.');
  requireRule(room.wildcardDeck?.length, 'NOT_ELIGIBLE', 'The Wildcard Deck is empty.');
  primary(room, actor);
  const cardId = room.wildcardDeck.shift()!;
  (room.wildcardDrawUsedByPlayer ??= {})[actor.id] = true;
  (room.pendingPrivateWildcardByPlayer ??= {})[actor.id] = { cardId, phase: 'DRAWN' };
  event(room, now, 'WILDCARD_DRAWN_PRIVATE', `${actor.name} drew a Wildcard.`, actor.id, [], { [actor.id]: { cardId } });
}

function pendingFor(room: RoomState, actor: PlayerState): PendingWildcard {
  requireTurn(room, actor);
  const pending = room.pendingPrivateWildcardByPlayer?.[actor.id];
  requireRule(pending, 'NOT_ELIGIBLE', 'You have no pending Wildcard.');
  return pending;
}
function discard(room: RoomState, actor: PlayerState, pending: PendingWildcard, burned: boolean): void {
  (room.wildcardDiscard ??= []).push({ cardId: pending.cardId, playerId: actor.id, burned });
  delete room.pendingPrivateWildcardByPlayer![actor.id];
}
export function burnWildcard(room: RoomState, actor: PlayerState, now: number, resolution: 'MANUAL' | 'TIMEOUT' | 'DISCONNECT' = 'MANUAL'): void {
  const pending = resolution === 'MANUAL' ? pendingFor(room, actor) : room.pendingPrivateWildcardByPlayer?.[actor.id];
  requireRule(pending?.phase === 'DRAWN', 'NOT_ELIGIBLE', 'A publicly played Wildcard cannot be burned.');
  discard(room, actor, pending, true);
  event(room, now, 'WILDCARD_BURNED', `${actor.name} burned a Wildcard.`, actor.id, [], { [actor.id]: { cardId: pending.cardId } }, { resolution });
}
function resolved(room: RoomState, actor: PlayerState, pending: PendingWildcard, now: number, text: string, facts: ActionEventPresentation, targetIds: string[] = []): void {
  discard(room, actor, pending, false);
  event(room, now, 'WILDCARD_RESOLVED', `${definition(pending.cardId).name}: ${text}`, actor.id, targetIds, undefined,
    { wildcardId: pending.cardId, wildcardOutcome: 'APPLIED', ...facts });
}
function hasLegalTarget(room: RoomState, actor: PlayerState, cardId: WildcardId): boolean {
  if (cardId === 'forced-exchange' && visible(actor).length === 0) return false;
  return opponents(room, actor).some(player => cardId === 'search-warrant' ? player.inventory.pockets.some(pocket => pocket.item) : visible(player).length > 0);
}
/** Use commits the public identity before any target choice; absence of targets never refunds it. */
export function useWildcard(room: RoomState, actor: PlayerState, now: number): void {
  const pending = pendingFor(room, actor);
  requireRule(pending.phase === 'DRAWN', 'NOT_ELIGIBLE', 'This Wildcard has already been played.');
  pending.phase = 'TARGETING';
  event(room, now, 'WILDCARD_USED', `${actor.name} played — ${definition(pending.cardId).name}.`, actor.id, [], undefined, { wildcardId: pending.cardId });
  if (definition(pending.cardId).targeting !== 'NONE') {
    if (!hasLegalTarget(room, actor, pending.cardId)) resolved(room, actor, pending, now, 'No legal target; spent without effect.', { wildcardOutcome: 'NO_LEGAL_TARGET' });
    return;
  }
  resolveGlobal(room, actor, pending, now);
}

export function expireWildcard(room: RoomState, playerId: string, now: number, resolution: 'TIMEOUT' | 'DISCONNECT'): void {
  const pending = room.pendingPrivateWildcardByPlayer?.[playerId];
  if (!pending) return;
  const actor = playerById(room, playerId);
  if (pending.phase === 'DRAWN') burnWildcard(room, actor, now, resolution);
  else resolved(room, actor, pending, now, 'Target selection expired; spent without effect.', { wildcardOutcome: 'EXPIRED', resolution });
}

export function resolveWildcard(room: RoomState, actor: PlayerState, command: Extract<GameCommand, { type: 'RESOLVE_WILDCARD' }>, now: number): void {
  const pending = pendingFor(room, actor);
  requireRule(pending.phase === 'TARGETING', 'NOT_ELIGIBLE', 'Choose Use before selecting a target.');
  if (!hasLegalTarget(room, actor, pending.cardId)) {
    resolved(room, actor, pending, now, 'No legal target remains; spent without effect.', { wildcardOutcome: 'NO_LEGAL_TARGET' });
    return;
  }
  const target = opponents(room, actor).find(player => player.id === command.targetId);
  requireRule(target, 'INVALID_TARGET', 'Choose another living non-Downed player.');
  const facts: ActionEventPresentation = {};
  let text: string;
  if (pending.cardId === 'search-warrant') {
    requireRule(Number.isInteger(command.pocketIndex), 'INVALID_TARGET', 'Choose an occupied Pocket.');
    const pocket = target.inventory.pockets[command.pocketIndex!];
    requireRule(pocket?.item, 'INVALID_TARGET', 'Choose an occupied Pocket.');
    if (pocket.protectedBySafe) {
      facts.wildcardOutcome = 'BLOCKED';
      text = `${target.name}'s Safe blocked the Search Warrant.`;
    } else {
      facts.revealedPocket = { playerId: target.id, pocketIndex: command.pocketIndex!, item: { ...pocket.item } };
      text = `${target.name}'s Pocket ${command.pocketIndex! + 1} contains ${ITEM_BY_ID[pocket.item.itemId]!.name} ×${pocket.item.quantity}.`;
    }
  } else {
    requireRule(['seize', 'destroy', 'forced-exchange'].includes(pending.cardId), 'INVALID_STATE', 'This Wildcard does not select a target.');
    requireRule(typeof command.instanceId === 'string', 'INVALID_TARGET', 'Choose a visible item.');
    const incoming = owned(target, command.instanceId, true);
    // Validate every leg before removing either side. applyCommand also clones transactionally.
    const outgoing = pending.cardId === 'forced-exchange' ? owned(actor, command.ownInstanceId ?? '', true) : undefined;
    removeItem(target, incoming.instanceId);
    if (outgoing) removeItem(actor, outgoing.instanceId);
    if (pending.cardId === 'destroy') {
      returnToPool(room, incoming);
      facts.itemsDestroyed = [{ instanceId: incoming.instanceId, itemId: incoming.itemId, quantity: incoming.quantity, playerId: target.id }];
      text = `${actor.name} destroyed ${target.name}'s ${ITEM_BY_ID[incoming.itemId]!.name}.`;
    } else {
      facts.itemsTransferred = [{ instanceId: incoming.instanceId, itemId: incoming.itemId, quantity: incoming.quantity, fromPlayerId: target.id, toPlayerId: actor.id }];
      acquire(room, actor, incoming, now, true);
      if (outgoing) {
        facts.itemsTransferred.push({ instanceId: outgoing.instanceId, itemId: outgoing.itemId, quantity: outgoing.quantity, fromPlayerId: actor.id, toPlayerId: target.id });
        acquire(room, target, outgoing, now, true);
      }
      text = outgoing ? `${actor.name} and ${target.name} exchanged visible items.` : `${actor.name} took ${target.name}'s ${ITEM_BY_ID[incoming.itemId]!.name}.`;
    }
    syncEquipment(room, actor, now); syncEquipment(room, target, now);
  }
  event(room, now, 'WILDCARD_TARGET_SELECTED', `${actor.name} selected ${target.name}.`, actor.id, [target.id], undefined, { wildcardId: pending.cardId });
  resolved(room, actor, pending, now, text, facts, [target.id]);
}

function resolveGlobal(room: RoomState, actor: PlayerState, pending: PendingWildcard, now: number): void {
  const players = activePlayers(room);
  const facts: ActionEventPresentation = {};
  switch (pending.cardId) {
    case 'supply-drop': {
      const pool = Object.values(ITEM_BY_ID).filter(item => item.rarity === 'COMMON' || item.rarity === 'UNCOMMON');
      facts.itemsGranted = [];
      for (const player of players) {
        const item = stack(room, withRandom(room, random => random.pick(pool)).id);
        facts.itemsGranted.push({ instanceId: item.instanceId, itemId: item.itemId, quantity: item.quantity, playerId: player.id });
        acquire(room, player, item, now);
      }
      break;
    }
    case 'shatter': {
      // Snapshot all choices before any lost Bag ejects previously private contents.
      const selected = players.flatMap(player => {
        const items = visible(player);
        return items.length ? [{ player, item: withRandom(room, random => random.pick(items)) }] : [];
      });
      facts.itemsDestroyed = selected.map(({ player, item }) => ({ instanceId: item.instanceId, itemId: item.itemId, quantity: item.quantity, playerId: player.id }));
      for (const { player, item } of selected) { removeItem(player, item.instanceId); returnToPool(room, item); }
      for (const player of players) syncEquipment(room, player, now);
      break;
    }
    case 'scramble': {
      const selected = players.flatMap((player, index) => {
        const items = visible(player);
        return items.length ? [{ player, target: players[(index + 1) % players.length]!, item: withRandom(room, random => random.pick(items)) }] : [];
      });
      facts.itemsTransferred = selected.map(({ player, target, item }) => ({ instanceId: item.instanceId, itemId: item.itemId, quantity: item.quantity, fromPlayerId: player.id, toPlayerId: target.id }));
      for (const { player, item } of selected) removeItem(player, item.instanceId);
      for (const { target, item } of selected) acquire(room, target, item, now, true);
      for (const player of players) syncEquipment(room, player, now);
      break;
    }
    case 'windfall':
      facts.coinChanges = players.map(player => { player.inventory.coins += 2; return { playerId: player.id, amount: 2 }; });
      break;
    case 'redistribution': {
      const minimum = Math.min(...players.map(player => player.inventory.coins));
      const recipient = withRandom(room, random => random.pick(players.filter(player => player.inventory.coins === minimum)));
      const payers = players.filter(player => player !== recipient && player.inventory.coins > 0);
      facts.coinChanges = payers.map(player => { player.inventory.coins -= 1; return { playerId: player.id, amount: -1 }; });
      recipient.inventory.coins += payers.length;
      facts.coinChanges.push({ playerId: recipient.id, amount: payers.length });
      break;
    }
    case 'second-chance':
      facts.hpChanges = players.filter(player => player.life === 'ACTIVE').map(player => {
        const amount = Math.min(1, RULES.maxHp - player.hp); player.hp += amount; return { playerId: player.id, amount };
      });
      break;
    default: requireRule(false, 'INVALID_STATE', 'Targeted Wildcards need a target.');
  }
  resolved(room, actor, pending, now, definition(pending.cardId).description, facts, players.map(player => player.id));
}
