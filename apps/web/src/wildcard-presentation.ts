import { WILDCARDS, type WildcardId } from '@the-table/content';
import type { ActionEventPresentation, PublicRoomView } from '@the-table/game';
import { hasCapability, itemName, playerName, presentItems } from './gameplay';
import type { PlayerCommand, RoomView } from './protocol';

export const wildcardDefinition = (id: string) => WILDCARDS.find(card => card.id === id);

/** Public targets only. Equipped items, Artifacts and Passage Token transfer normally. */
export function wildcardTargets(room: PublicRoomView, ownerId: string, cardId: WildcardId) {
  const card = wildcardDefinition(cardId)!;
  const ownItems = presentItems(room.players.find(player => player.id === ownerId)?.visibleInventory ?? []);
  const opponents = room.players.filter(player => player.id !== ownerId && player.life === 'ACTIVE' && !player.conceded);
  const players = opponents.filter(player => card.targeting === 'POCKET' ? player.pocketOccupancy.some(Boolean)
    : card.targeting === 'EXCHANGE' ? ownItems.length > 0 && presentItems(player.visibleInventory).length > 0
    : card.targeting === 'VISIBLE_ITEM' ? presentItems(player.visibleInventory).length > 0 : false);
  return { players, ownItems, hasTargets: players.length > 0 };
}

export interface WildcardTargetDraft { targetId: string; instanceId: string; ownInstanceId: string; pocketIndex: string }

/** Revalidate the preserved draft against the latest projection at submission time. */
export function wildcardResolutionCommand(room: RoomView, draft: WildcardTargetDraft): Extract<PlayerCommand, { type: 'RESOLVE_WILDCARD' }> | undefined {
  const pending = room.private.pendingWildcard;
  if (pending?.phase !== 'TARGETING' || !hasCapability(room, 'RESOLVE_WILDCARD')) return;
  const card = wildcardDefinition(pending.cardId)!;
  const options = wildcardTargets(room.public, room.private.playerId, pending.cardId);
  if (!options.hasTargets) return { type: 'RESOLVE_WILDCARD' };
  const target = options.players.find(player => player.id === draft.targetId);
  if (!target) return;
  if (card.targeting === 'POCKET') {
    const index = Number(draft.pocketIndex);
    if (!draft.pocketIndex || !Number.isInteger(index) || target.pocketOccupancy[index] !== true) return;
    return { type: 'RESOLVE_WILDCARD', targetId: target.id, pocketIndex: index };
  }
  if (!presentItems(target.visibleInventory).some(item => item.instanceId === draft.instanceId)) return;
  if (card.targeting === 'EXCHANGE' && !options.ownItems.some(item => item.instanceId === draft.ownInstanceId)) return;
  return { type: 'RESOLVE_WILDCARD', targetId: target.id, instanceId: draft.instanceId, ...(card.targeting === 'EXCHANGE' ? { ownInstanceId: draft.ownInstanceId } : {}) };
}

export const WILDCARD_RESULT_DURATION = 1_000;
export const WILDCARD_PUBLIC_BANNER_DELAY = 250;
export const WILDCARD_RESOLUTION_DURATION = 1_000;

function publicEffectSummaries(room: PublicRoomView, facts: ActionEventPresentation | undefined) {
  const effectItem = (item: { itemId: string; quantity: number }) => `${itemName(item.itemId)}${item.quantity > 1 ? ` ×${item.quantity}` : ''}`;
  return [
    ...(facts?.itemsTransferred ?? []).map(item => `${playerName(room, item.fromPlayerId)} → ${playerName(room, item.toPlayerId)} · ${effectItem(item)}`),
    ...(facts?.itemsDestroyed ?? []).map(item => `${playerName(room, item.playerId)} · ${effectItem(item)} discarded`),
    ...(facts?.itemsGranted ?? []).map(item => `${playerName(room, item.playerId)} + ${effectItem(item)}`),
    ...(facts?.coinChanges ?? []).filter(change => change.amount !== 0).map(change => `${playerName(room, change.playerId)} ${change.amount > 0 ? '+' : '−'}${Math.abs(change.amount)} Gold`),
    ...(facts?.hpChanges ?? []).filter(change => change.amount > 0).map(change => `${playerName(room, change.playerId)} +${change.amount} HP`),
  ];
}

/** Resolution has its own presentation window; targets may resolve long after the face reveal. */
export function wildcardResolutionFeedback(room: PublicRoomView, now: number) {
  const event = [...(room.events ?? [])].reverse().find(entry => entry.kind === 'WILDCARD_RESOLVED');
  if (!event || now < event.at || now - event.at >= WILDCARD_RESOLUTION_DURATION) return;
  const facts = event.presentation;
  const card = facts?.wildcardId ? wildcardDefinition(facts.wildcardId) : undefined;
  const name = card?.name ?? 'Wildcard';
  const outcome = facts?.wildcardOutcome;
  const base = { id: event.id, at: event.at, details: [] as string[] };
  // Failure branches deliberately never inspect Pocket/item effect metadata.
  if (outcome === 'BLOCKED') return { ...base, text: `${name}: ${card?.id === 'search-warrant' ? 'Safe blocked the reveal' : 'effect blocked'}. Wildcard spent.` };
  if (outcome === 'NO_LEGAL_TARGET') return { ...base, text: `${name}: no legal targets. Spent without an effect.` };
  if (outcome === 'EXPIRED') return { ...base, text: `${name}: target selection expired. Spent without an effect.` };
  const pocket = outcome === 'APPLIED' && card?.id === 'search-warrant' ? facts?.revealedPocket : undefined;
  if (pocket) return { ...base, text: `${playerName(room, pocket.playerId)}’s Pocket ${pocket.pocketIndex + 1}: ${itemName(pocket.item.itemId)} ×${pocket.item.quantity}.`, details: ['Revealed to everyone · the item stays in the Pocket.'] };
  return { ...base, text: event.publicText, details: outcome === 'APPLIED' ? publicEffectSummaries(room, facts) : [] };
}
/** Read public events only, even for a god-view spectator or the player who burned. */
export function wildcardPublicResult(room: PublicRoomView, now: number) {
  const events = [...(room.events ?? [])].reverse();
  const reveal = events.find(entry => entry.kind === 'WILDCARD_BURNED' || entry.kind === 'WILDCARD_USED');
  if (!reveal || now < reveal.at || now - reveal.at >= WILDCARD_RESULT_DURATION) return;
  const event = reveal.kind === 'WILDCARD_USED' ? events.find(entry => entry.kind === 'WILDCARD_RESOLVED' && entry.actorId === reveal.actorId && entry.sequence > reveal.sequence && entry.presentation?.wildcardId === reveal.presentation?.wildcardId) ?? reveal : reveal;
  const burned = event.kind === 'WILDCARD_BURNED';
  // Burn must not read card metadata, including from an incorrectly overbroad projection.
  const card = !burned && event.presentation?.wildcardId ? wildcardDefinition(event.presentation.wildcardId) : undefined;
  const facts = burned ? undefined : event.presentation;
  const effects = publicEffectSummaries(room, facts);
  return { id: reveal.id, at: reveal.at, burned, card, effects, actorName: playerName(room, event.actorId), targetName: event.targetIds.length === 1 ? playerName(room, event.targetIds[0]) : undefined, text: burned ? `${room.players.find(player => player.id === event.actorId)?.name ?? 'A player'} burned a Wildcard.` : event.publicText };
}
