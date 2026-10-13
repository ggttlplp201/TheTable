import { ITEMS, OBJECTIVES } from '@the-table/content';
import type { ItemStack, PublicRoomView } from '@the-table/game';
import { isSpectatorView, type AnyRoomView, type CommandPayload, type PlayerCommand, type RoomView } from './protocol';

export const ITEM_BY_ID = Object.fromEntries(Object.values(ITEMS).map(item => [item.id, item]));
export const OBJECTIVE_BY_ID = Object.fromEntries(OBJECTIVES.map(objective => [objective.id, objective]));
export function words(value: string): string {
  return value.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]/g, ' ').toLowerCase().replace(/^./, letter => letter.toUpperCase());
}
export const itemName = (id: string) => ITEM_BY_ID[id]?.name ?? words(id);
export const stackName = (item: ItemStack) => `${itemName(item.itemId)}${item.quantity > 1 ? ` ×${item.quantity}` : ''}`;
export const presentItems = (items: Array<ItemStack | null>): ItemStack[] => items.filter((item): item is ItemStack => item !== null);
export const ownItems = (room: RoomView): ItemStack[] => [
  ...presentItems(room.public.players.find(player => player.id === room.private.playerId)?.visibleInventory ?? []),
  ...room.private.pockets.flatMap(pocket => pocket.item ? [pocket.item] : []),
];
export function hasCapability(room: AnyRoomView, type: string): boolean {
  return !isSpectatorView(room) && (room.private.capabilities?.includes(type) ?? false);
}
export function canRematch(room: AnyRoomView, viewerId: string): boolean {
  // Lifecycle authorization is public host identity; spectators never receive gameplay capabilities.
  return room.public.status === 'RESULTS' && room.public.hostPlayerId === viewerId;
}
export function commandEnvelope(command: PlayerCommand, room: PublicRoomView, key: string): CommandPayload {
  const { type, ...payload } = command;
  return { type, payload, roomId: room.id, expectedRevision: room.revision, idempotencyKey: key } as CommandPayload;
}
export function remainingSeconds(deadline: number, now: number): number {
  return Math.max(0, Math.ceil((deadline - now) / 1000));
}
export function playerName(room: PublicRoomView, id?: string): string {
  return room.players.find(player => player.id === id)?.name ?? 'Unknown player';
}
export function assetNames(room: PublicRoomView, ids: string[]): string[] {
  const visible = room.players.flatMap(player => presentItems(player.visibleInventory));
  return ids.map(id => {
    const item = visible.find(candidate => candidate.instanceId === id);
    return item ? stackName(item) : 'Selected item';
  });
}

/** Rules copy explains the selected object; it never determines command legality. */
export const ITEM_HELP: Record<string, string> = {
  knife: 'One use. Deals 2 damage to an adjacent player.',
  pistol: 'Reusable. Deals 3 damage. Uses one Bullet, or Enforcer’s once-per-match Quick Draw.',
  bullet: 'Ammunition for a Pistol. Up to three Bullets share one slot.',
  poison: 'Deals 1 damage at the start of the next three living turns. Pauses while Downed.',
  antidote: 'Removes Poison. Can also help a Downed player without reviving them.',
  medicine: 'Heals 2 HP, or revives to 2 HP. A Medic revives another player to 3 HP.',
  stimulant: 'Restores 2 HP. Healing above 5 becomes Temporary HP, up to +2. Cannot revive a Downed player.',
  armor: 'Visible equipment. Blocks one entire Knife or Pistol hit, then is consumed.',
  cloth: 'Consumed to cover one committed visible item in a Threat.',
  bag: 'Visible equipment. Grants a second Pocket.',
  safe: 'Visible equipment. Protects one assigned Pocket from theft and inspection.',
  spyglass: 'Privately inspects the exact contents of a chosen unprotected Pocket.',
  pickpocket: 'Steals from a chosen unprotected Pocket; otherwise fails harmlessly.',
  key: 'One use. Opens the Standard Chest as your Primary Action.',
  lockpick: 'One use. Opens the Standard Chest as your Primary Action.',
  crowbar: 'Reusable Standard Chest access. Destroys one random loot slot.',
  'black-key': 'One use. Opens the Black Chest as your Primary Action.',
  handcuffs: 'Prevents the target initiating Trade or Threat on their next normal turn.',
  'brass-idol': 'Rerolls one private Black Market offer once per Intermission.',
  'glass-eye': 'Privately checks one unprotected Pocket for a weapon once per round.',
  'red-ledger': 'Discounts one Public Shop purchase by 1 Gold once per Intermission.',
  'passage-token': 'Keep this quest item for Escapist. Cannot be sold.',
};
export const OBJECTIVE_HELP: Record<string, string> = {
  escapist: 'Possess the Passage Token and survive until a later turn to leave.',
  collector: 'Hold two distinct Artifacts and keep them until you leave.',
  tycoon: 'Hold at least 15 Gold and complete a successful Trade before you leave.',
  executioner: 'Personally cause your assigned target’s permanent death.',
  guardian: 'Keep your assigned target alive through Round 4. Their earlier successful exit also counts.',
  kingmaker: 'Your assigned target must complete their objective and successfully exit.',
  martyr: 'Be the first player to permanently die. This objective banks through death.',
  phoenix: 'Recover from two separate Downed events.',
  betrayer: 'Complete a Trade, then personally Down that same player.',
  extortionist: 'Receive demanded assets through successful Threats against two different players.',
  'con-artist': 'Get compliance with a harmless covered bluff, and a refusal against a covered real weapon.',
  duelist: 'Personally Down two different players.',
  savior: 'Personally revive two different other players.',
  graverobber: 'Loot at least one visible item from each of two different Downed players.',
  poisoner: 'Cause Poison to tick on two different players.',
  'chest-raider': 'Personally open both the Standard Chest and the Black Chest.',
  merchant: 'Complete Trades with two different players. ',
  'hidden-hand': 'Acquire an item through Pickpocket and an item through Downed loot.',
  survivor: 'Remain alive after two others exit or permanently die. ',
  arsenal: 'Hold a Pistol, at least one Bullet, a Knife, and Armor until you leave.',
};

const NORMAL_USE_ITEMS = new Set(['knife', 'pistol', 'poison', 'handcuffs', 'spyglass', 'pickpocket', 'glass-eye', 'medicine', 'stimulant', 'antidote', 'key', 'lockpick', 'crowbar', 'black-key']);
const OPPONENT_ITEMS = new Set(['knife', 'pistol', 'poison', 'handcuffs', 'spyglass', 'pickpocket', 'glass-eye']);
const CHEST_ITEMS = new Set(['key', 'lockpick', 'crowbar', 'black-key']);
export const needsOpponent = (itemId: string) => OPPONENT_ITEMS.has(itemId);
export const usesChest = (itemId: string) => CHEST_ITEMS.has(itemId);
export function useItemOptions(room: RoomView): ItemStack[] {
  const player = room.public.players.find(candidate => candidate.id === room.private.playerId);
  return ownItems(room).filter(item => NORMAL_USE_ITEMS.has(item.itemId) && (player?.life !== 'DOWNED' || item.itemId === 'medicine'));
}
/** Only intrinsic item input shapes and public seat/life facts narrow the picker.
 * Ammo, spent abilities, locks, rescue eligibility and final legality stay server-owned.
 */
export function useItemTargets(room: RoomView, itemId: string) {
  const owner = room.public.players.find(player => player.id === room.private.playerId)!;
  const seats = [...room.public.players].sort((a, b) => a.seat - b.seat).map(player => player.id);
  return room.public.players.filter(player => {
    if (player.id === owner.id || usesChest(itemId) || owner.life === 'DOWNED' || player.connection !== 'CONNECTED') return false;
    if (itemId === 'stimulant' && player.life !== 'ACTIVE') return false;
    if (needsOpponent(itemId) && player.life !== 'ACTIVE') return false;
    if (!needsOpponent(itemId) && player.life !== 'ACTIVE' && player.life !== 'DOWNED') return false;
    if (itemId !== 'knife') return true;
    const distance = Math.abs(seats.indexOf(owner.id) - seats.indexOf(player.id));
    return distance === 1 || distance === seats.length - 1;
  });
}
export function useItemCommand(item: ItemStack, targetId: string, pocketIndex?: number, quickDraw = false): Extract<PlayerCommand, { type: 'USE_ITEM' }> {
  return { type: 'USE_ITEM', instanceId: item.instanceId,
    ...(!usesChest(item.itemId) && targetId !== 'self' ? { targetId } : {}),
    ...(pocketIndex !== undefined ? { pocketIndex } : {}),
    ...(quickDraw ? { useQuickDraw: true } : {}),
  };
}
