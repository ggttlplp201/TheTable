import { ITEM_BY_ID, OBJECTIVE_BY_ID, RULES } from './content.js';
import { requireRule } from './internal.js';
import type { ItemStack, RoomState } from './types.js';

export function assertRoomInvariants(room: RoomState): void {
  const check = (condition: unknown, message: string) => requireRule(condition, 'INVALID_STATE', message);
  check(room.players.length >= 1 && room.players.length <= 4, 'Invalid player count.');
  check(new Set(room.players.map((player) => player.id)).size === room.players.length, 'Duplicate player IDs.');
  check(new Set(room.players.map((player) => player.seat)).size === room.players.length, 'Duplicate seats.');
  const roles = room.players.flatMap((player) => player.roleId ? [player.roleId] : []);
  check(new Set(roles).size === roles.length, 'Duplicate Roles.');
  const instances = new Set<string>();
  const artifacts = new Set<string>();
  const inspect = (item: ItemStack) => {
    check(!instances.has(item.instanceId), 'Duplicate item instance ownership.'); instances.add(item.instanceId);
    const definition = ITEM_BY_ID[item.itemId]; check(definition, `Unknown item ${item.itemId}.`);
    check(Number.isInteger(item.quantity) && item.quantity > 0 && item.quantity <= definition!.maxStack, 'Invalid item stack quantity.');
    if (definition!.rarity === 'ARTIFACT' || definition!.rarity === 'QUEST') { check(!artifacts.has(item.itemId), 'Duplicate unique Artifact/quest possession.'); artifacts.add(item.itemId); }
  };
  for (const player of room.players) {
    check(Number.isInteger(player.seat) && player.seat >= 0 && player.seat <= 3, 'Invalid seat.');
    check(Number.isInteger(player.hp) && player.hp >= 0 && player.hp <= RULES.maxHp, 'HP out of range.');
    check(player.life !== 'DOWNED' || (player.hp === 0 && player.downed), 'Downed player lacks a rescue deadline.');
    check(player.life !== 'ACTIVE' || player.hp > 0, 'Active player has no HP.');
    check(player.life === 'DOWNED' || !player.downed, 'Stale Downed metadata.');
    check(player.inventory.visible.length === RULES.visibleSlots, 'Visible inventory has wrong slot count.');
    check(Number.isSafeInteger(player.inventory.coins) && player.inventory.coins >= 0, 'Coins must be nonnegative integers.');
    const bag = player.inventory.visible.some((item) => item?.itemId === 'bag');
    check(player.inventory.pockets.length === (bag ? 2 : 1), 'Pocket count does not match visible Bag.');
    for (const item of player.inventory.visible) if (item) inspect(item);
    for (const pocket of player.inventory.pockets) if (pocket.item) { inspect(pocket.item); check(ITEM_BY_ID[pocket.item.itemId]!.pocketEligible, 'Visible equipment is illegally Pocketed.'); }
    if (room.match) {
      check(player.objective && OBJECTIVE_BY_ID[player.objective.objectiveId], 'Missing or unknown objective.');
      if (player.objective?.targetPlayerId) check(player.objective.targetPlayerId !== player.id && room.players.some((target) => target.id === player.objective!.targetPlayerId), 'Invalid objective target.');
      check(player.objective?.status !== 'BANKED' || player.exitOrder, 'Banked objective lacks exit order.');
    }
  }
  for (const chest of room.chests ?? []) for (const loot of chest.loot) if (loot.kind === 'ITEM') inspect(loot.stack); else check(Number.isSafeInteger(loot.amount) && loot.amount > 0, 'Invalid chest Coins.');
  for (const choice of room.overflows ?? []) { inspect(choice.incoming); check(room.players.some((player) => player.id === choice.playerId), 'Overflow owner missing.'); }
  if (!room.match) return;
  const objectives = room.players.map((player) => player.objective!.objectiveId);
  check(new Set(objectives).size === objectives.length, 'Duplicate assigned objective.');
  for (const artifact of room.match.artifactPool) check(!artifacts.has(artifact), 'Artifact is both pooled and possessed.');
  check(new Set(room.match.artifactPool).size === room.match.artifactPool.length, 'Duplicate pooled Artifact.');
  check(!room.match.passageTokenAvailable || !artifacts.has('passage-token'), 'Passage Token is both pooled and possessed.');
  check(!(room.pendingTrade && room.pendingThreat), 'More than one pending response.');
  if (room.status === 'PLAYING') {
    check(room.round, 'Match lacks round state.');
    if (room.round?.phase === 'TURN') check(room.turn && room.players.some((player) => player.seat === room.turn!.activeSeat && (player.life === 'ACTIVE' || player.life === 'DOWNED')), 'Normal turn has no living owner.');
    if (room.round?.phase === 'INTERMISSION') check(!room.turn && room.shop, 'Intermission state is inconsistent.');
    if (room.pendingTrade || room.pendingThreat) check(room.turn?.pausedRemainingMs !== undefined, 'Response did not pause the turn.');
    check(new Set(room.round!.seatsOwedTurn).size === room.round!.seatsOwedTurn.length, 'Duplicate remaining turn opportunities.');
  }
  if (room.status === 'RESULTS') check(!room.turn && !room.pendingTrade && !room.pendingThreat && !room.overflows?.length, 'Results retains a gameplay deadline.');
}
