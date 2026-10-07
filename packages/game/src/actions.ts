import { ITEM_BY_ID, RULES } from './content.js';
import { attack, applyStatus, legalWeapon, loot, revive } from './combat.js';
import { generateBlackOffer, resalePrice, withRandom } from './economy.js';
import { event, id, living, playerById, requireRule } from './internal.js';
import { acquire, consume, heldItems, owned, removeItem, returnToPool, syncEquipment } from './inventory.js';
import type { GameCommand, PlayerState, RoomState } from './types.js';

export function requireTurn(room: RoomState, actor: PlayerState): void {
  requireRule(room.round?.phase === 'TURN' && room.turn, 'WRONG_PHASE', 'This action requires a normal turn.');
  requireRule(room.turn.activeSeat === actor.seat, 'NOT_YOUR_TURN', 'It is not your turn.');
  requireRule(!room.pendingTrade && !room.pendingThreat && !room.overflows?.length, 'LOCKED', 'Resolve the pending interaction first.');
}
export function primary(room: RoomState, actor: PlayerState): void {
  requireTurn(room, actor);
  requireRule(actor.life === 'ACTIVE' && !room.turn!.startedDowned && !room.turn!.primaryUsed, 'NOT_ELIGIBLE', 'No Primary Action is available.');
  room.turn!.primaryUsed = true; room.turn!.exitDeclined = true;
  delete room.turn!.immediateLoot;
}
export function pauseTurn(room: RoomState, now: number, interactionId: string): void {
  room.turn!.pausedRemainingMs = Math.max(0, room.turn!.deadlineAt - now);
  room.turn!.pendingInteractionId = interactionId;
}
export function resumeTurn(room: RoomState, now: number): void {
  if (room.turn && !room.pendingTrade && !room.pendingThreat && !room.overflows?.length && room.turn.pausedRemainingMs !== undefined) {
    room.turn.deadlineAt = now + room.turn.pausedRemainingMs;
    delete room.turn.pausedRemainingMs; delete room.turn.pendingInteractionId;
  }
}
function otherActive(room: RoomState, actor: PlayerState, targetId: string): PlayerState {
  const target = playerById(room, targetId);
  requireRule(target.id !== actor.id && target.life === 'ACTIVE', 'INVALID_TARGET', 'Choose another living non-Downed player.');
  return target;
}
function socialTarget(room: RoomState, actor: PlayerState, targetId: string): PlayerState {
  const target = otherActive(room, actor, targetId);
  requireRule(target.connection === 'CONNECTED', 'INVALID_TARGET', 'Disconnected players cannot receive Trade or Threat.');
  requireRule(!actor.statuses?.some((status) => status.kind === 'HANDCUFFED' && status.appliedTurn < room.turn!.serial), 'NOT_ELIGIBLE', 'Handcuffs prevent Trade and Threat this turn.');
  return target;
}
function validateAssets(player: PlayerState, items: string[], coins: number): void {
  requireRule(Array.isArray(items) && items.every((entry) => typeof entry === 'string') && new Set(items).size === items.length, 'INVALID_COMMAND', 'Selected items must be unique.');
  requireRule(Number.isSafeInteger(coins) && coins >= 0 && coins <= player.inventory.coins, 'INSUFFICIENT_COINS', 'Coin amount is invalid or unavailable.');
  for (const item of items) owned(player, item, true);
}
function transfer(room: RoomState, first: PlayerState, second: PlayerState, firstItems: string[], firstCoins: number, secondItems: string[], secondCoins: number, now: number): void {
  validateAssets(first, firstItems, firstCoins); validateAssets(second, secondItems, secondCoins);
  const outgoingFirst = firstItems.map((instanceId) => removeItem(first, instanceId));
  const outgoingSecond = secondItems.map((instanceId) => removeItem(second, instanceId));
  first.inventory.coins += secondCoins - firstCoins; second.inventory.coins += firstCoins - secondCoins;
  for (const item of outgoingFirst) acquire(room, second, item, now);
  for (const item of outgoingSecond) acquire(room, first, item, now);
  syncEquipment(room, first, now); syncEquipment(room, second, now);
}
export function initiateTrade(room: RoomState, actor: PlayerState, command: Extract<GameCommand, { type: 'TRADE' }>, now: number): void {
  primary(room, actor);
  const target = socialTarget(room, actor, command.targetId);
  validateAssets(actor, command.offeredItems, command.offeredCoins); validateAssets(target, command.requestedItems, command.requestedCoins);
  room.pendingTrade = { ...command, id: id(room, 'trade'), actorId: actor.id, status: 'PENDING', deadlineAt: now + RULES.responseMs };
  pauseTurn(room, now, room.pendingTrade.id);
  event(room, now, 'TRADE_OFFERED', `${actor.name} offered a Trade to ${target.name}.`, actor.id, [target.id]);
}
export function resolveTrade(room: RoomState, accept: boolean, now: number, cancelled = false): void {
  const proposal = room.pendingTrade!;
  const actor = playerById(room, proposal.actorId); const target = playerById(room, proposal.targetId);
  if (accept && !cancelled) {
    transfer(room, actor, target, proposal.offeredItems, proposal.offeredCoins, proposal.requestedItems, proposal.requestedCoins, now);
    const resolved = event(room, now, 'TRADE_ACCEPTED', `${target.name} accepted ${actor.name}'s Trade.`, actor.id, [target.id]);
    room.match!.history.trades.push({ actorId: actor.id, targetId: target.id, round: room.round!.number, sequence: resolved.sequence });
  } else event(room, now, cancelled ? 'TRADE_CANCELLED' : 'TRADE_DECLINED', cancelled ? 'Trade cancelled because the target disconnected.' : `${target.name} declined the Trade.`, actor.id, [target.id]);
  delete room.pendingTrade;
  resumeTurn(room, now);
}
export function initiateThreat(room: RoomState, actor: PlayerState, command: Extract<GameCommand, { type: 'THREAT' }>, now: number): void {
  primary(room, actor);
  const target = socialTarget(room, actor, command.targetId);
  requireRule(command.mode === 'OPEN' || command.mode === 'COVERED', 'INVALID_COMMAND', 'Unknown Threat mode.');
  const committed = owned(actor, command.committedItemId, true);
  validateAssets(target, command.demandedItems, command.demandedCoins);
  if (command.mode === 'OPEN') requireRule(legalWeapon(room, actor, target, committed, command.useQuickDraw), 'INVALID_TARGET', 'Open Threat requires a valid weapon against this target.');
  else {
    const cloth = owned(actor, command.clothItemId ?? '');
    requireRule(cloth.itemId === 'cloth' && cloth.instanceId !== committed.instanceId, 'INVALID_COMMAND', 'Covered Threat needs separate Cloth and one visible item.');
    consume(room, actor, cloth, now);
  }
  room.pendingThreat = {
    id: id(room, 'threat'), actorId: actor.id, targetId: target.id, mode: command.mode,
    committedItemId: committed.instanceId, committedItemType: committed.itemId,
    demandedItems: command.demandedItems, demandedCoins: command.demandedCoins,
    useQuickDraw: command.useQuickDraw ?? false, status: 'PENDING', deadlineAt: now + RULES.responseMs,
  };
  pauseTurn(room, now, room.pendingThreat.id);
  event(room, now, 'THREAT_OFFERED', `${actor.name} made a ${command.mode.toLowerCase()} Threat against ${target.name}.`, actor.id, [target.id]);
}
export function resolveThreat(room: RoomState, comply: boolean, now: number, cancelled = false): void {
  const proposal = room.pendingThreat!;
  const actor = playerById(room, proposal.actorId); const target = playerById(room, proposal.targetId);
  const committed = owned(actor, proposal.committedItemId, true);
  const validWeapon = legalWeapon(room, actor, target, committed, proposal.useQuickDraw);
  if (!cancelled) {
    if (comply) transfer(room, target, actor, proposal.demandedItems, proposal.demandedCoins, [], 0, now);
    else if (validWeapon) attack(room, actor, target, committed, now, proposal.useQuickDraw);
    room.match!.history.threats.push({ actorId: actor.id, targetId: target.id, complied: comply, covered: proposal.mode === 'COVERED', validWeapon, assetsReceived: comply && (proposal.demandedItems.length > 0 || proposal.demandedCoins > 0) });
  }
  event(room, now, cancelled ? 'THREAT_CANCELLED' : comply ? 'THREAT_COMPLIED' : 'THREAT_REFUSED', `${cancelled ? 'Threat cancelled.' : `${target.name} ${comply ? 'complied' : 'refused'}.`}${proposal.mode === 'COVERED' ? ` The covered item was ${ITEM_BY_ID[committed.itemId]!.name}.` : ''}`, actor.id, [target.id]);
  delete room.pendingThreat; resumeTurn(room, now);
}

export function useItem(room: RoomState, actor: PlayerState, command: Extract<GameCommand, { type: 'USE_ITEM' }>, now: number): void {
  const item = owned(actor, command.instanceId);
  const target = command.targetId ? playerById(room, command.targetId) : actor;
  if (actor.life === 'DOWNED') {
    requireTurn(room, actor);
    requireRule(target.id === actor.id && item.itemId === 'medicine' && !room.turn!.primaryUsed, 'NOT_ELIGIBLE', 'A Downed player may only self-revive with Medicine.');
    revive(room, actor, actor, item, now);
    room.turn!.primaryUsed = true; room.turn!.exitDeclined = true;
    return;
  }
  primary(room, actor);
  if (item.itemId === 'glass-eye') {
    requireRule(actor.abilities!.glassEyeRound !== room.round!.number, 'NOT_ELIGIBLE', 'Glass Eye was already used this round.');
    actor.abilities!.glassEyeRound = room.round!.number;
  }
  switch (item.itemId) {
    case 'knife': case 'pistol': attack(room, actor, target, item, now, command.useQuickDraw); return;
    case 'medicine':
      if (target.life === 'DOWNED') revive(room, actor, target, item, now);
      else {
        requireRule(target.life === 'ACTIVE' && target.hp < RULES.maxHp, 'INVALID_TARGET', 'Medicine needs a wounded living target.');
        consume(room, actor, item, now); target.hp = Math.min(RULES.maxHp, target.hp + Number(ITEM_BY_ID.medicine!.effect.heal));
        event(room, now, 'HEALED', `${actor.name} healed ${target.name}.`, actor.id, [target.id]);
      }
      return;
    case 'antidote':
      requireRule(living(target) && target.statuses?.some((status) => status.kind === 'POISON'), 'INVALID_TARGET', 'Antidote needs a living Poisoned target.');
      consume(room, actor, item, now); target.statuses = (target.statuses ?? []).filter((status) => status.kind !== 'POISON');
      event(room, now, 'POISON_CURED', `${actor.name} cured ${target.name}'s Poison.`, actor.id, [target.id]); return;
    case 'poison': case 'handcuffs':
      otherActive(room, actor, target.id);
      consume(room, actor, item, now); applyStatus(room, actor, target, item.itemId === 'poison' ? 'POISON' : 'HANDCUFFED');
      event(room, now, item.itemId === 'poison' ? 'POISON_APPLIED' : 'HANDCUFFED', `${actor.name} used ${ITEM_BY_ID[item.itemId]!.name} on ${target.name}.`, actor.id, [target.id]); return;
    case 'spyglass': case 'glass-eye': case 'pickpocket': {
      otherActive(room, actor, target.id);
      requireRule(Number.isInteger(command.pocketIndex) && command.pocketIndex! >= 0, 'INVALID_COMMAND', 'Choose a Pocket index.');
      const pocket = target.inventory.pockets[command.pocketIndex!];
      requireRule(pocket, 'INVALID_TARGET', 'Pocket does not exist.');
      const blocked = pocket.protectedBySafe;
      if (item.itemId === 'pickpocket') {
        if (!blocked && pocket.item) {
          const stolen = pocket.item; pocket.item = null;
          consume(room, actor, item, now); acquire(room, actor, stolen, now);
          room.match!.history.pickpockets.push({ actorId: actor.id, targetId: target.id });
        } else consume(room, actor, item, now);
        event(room, now, 'PICKPOCKET', `${actor.name} used Pickpocket on ${target.name}.`, actor.id, [target.id]);
      } else {
        const payload = blocked ? { blocked: true } : item.itemId === 'glass-eye' ? { weapon: pocket.item?.itemId === 'knife' || pocket.item?.itemId === 'pistol' } : { item: structuredClone(pocket.item) };
        if (item.itemId === 'spyglass') consume(room, actor, item, now);
        event(room, now, 'POCKET_INSPECTED', `${actor.name} inspected a Pocket.`, actor.id, [target.id], { [actor.id]: { targetId: target.id, pocketIndex: command.pocketIndex, ...payload } });
      }
      return;
    }
    case 'key': case 'lockpick': case 'crowbar': case 'black-key': {
      const kind = item.itemId === 'black-key' ? 'BLACK' : 'STANDARD';
      const chest = room.chests!.find((entry) => entry.kind === kind)!;
      requireRule(chest.availability === 'AVAILABLE', 'NOT_ELIGIBLE', 'This chest is not available.');
      if (item.itemId === 'crowbar' && chest.loot.length) {
        const removed = chest.loot.splice(withRandom(room, (random) => random.int(chest.loot.length)), 1)[0]!;
        if (removed.kind === 'ITEM') returnToPool(room, removed.stack);
      } else if (item.itemId !== 'crowbar') consume(room, actor, item, now);
      const contents = chest.loot; chest.loot = []; chest.availability = 'OPENED'; chest.refreshRound = room.round!.number + (kind === 'STANDARD' ? 1 : 2);
      for (const entry of contents) if (entry.kind === 'COINS') actor.inventory.coins += entry.amount; else acquire(room, actor, entry.stack, now);
      room.match!.history.chests.push({ actorId: actor.id, kind });
      event(room, now, 'CHEST_OPENED', `${actor.name} opened the ${kind === 'STANDARD' ? 'Standard' : 'Black'} Chest.`, actor.id); return;
    }
    default: requireRule(false, 'INVALID_COMMAND', 'This item has no normal-turn use.');
  }
}

export function downedInteraction(room: RoomState, actor: PlayerState, command: Extract<GameCommand, { type: 'DOWNED_INTERACTION' }>, now: number): void {
  requireTurn(room, actor);
  const target = playerById(room, command.targetId);
  requireRule(actor.life === 'ACTIVE' && !room.turn!.startedDowned && !room.turn!.downedInteractionUsed && target.life === 'DOWNED' && target.id !== actor.id && target.downed!.aggressorId !== actor.id, 'NOT_ELIGIBLE', 'No extra Downed Interaction is available.');
  if (command.kind === 'LOOT') loot(room, actor, target, command.instanceId, now);
  else {
    requireRule(command.kind === 'REVIVE' || command.kind === 'HELP', 'INVALID_COMMAND', 'Unknown Downed Interaction.');
    const item = owned(actor, command.instanceId);
    if (command.kind === 'HELP' && item.itemId === 'antidote') {
      requireRule(target.statuses?.some((status) => status.kind === 'POISON'), 'INVALID_TARGET', 'Antidote requires existing Poison.');
      consume(room, actor, item, now);
      target.statuses = (target.statuses ?? []).filter((status) => status.kind !== 'POISON');
      event(room, now, 'POISON_CURED', `${actor.name} cured ${target.name}'s Poison.`, actor.id, [target.id]);
    } else revive(room, actor, target, item, now);
  }
  room.turn!.downedInteractionUsed = true;
}
export function requireShopper(room: RoomState, actor: PlayerState): void {
  requireRule(room.round?.phase === 'INTERMISSION' && actor.life === 'ACTIVE', 'WRONG_PHASE', 'Shopping requires Intermission and a living non-Downed player.');
  requireRule(room.shop?.order[room.shop.activeShopperIndex] === actor.id, 'NOT_YOUR_TURN', 'Wait for your shopping opportunity.');
  requireRule(!room.overflows?.length, 'LOCKED', 'Resolve inventory overflow first.');
}
export function shopAction(room: RoomState, actor: PlayerState, command: GameCommand, now: number): void {
  requireShopper(room, actor);
  const shop = room.shop!;
  switch (command.type) {
    case 'BUY': {
      requireRule(command.market === 'PUBLIC' || command.market === 'BLACK', 'INVALID_COMMAND', 'Unknown market.');
      const publicBuy = command.market === 'PUBLIC';
      const offers = publicBuy ? shop.publicOffers : shop.privateOffers[actor.id]!;
      const purchases = publicBuy ? shop.publicPurchasedBy : shop.privatePurchasedBy;
      requireRule(!purchases[actor.id], 'NOT_ELIGIBLE', 'You already purchased from this market.');
      const offer = offers.find((entry) => entry.id === command.offerId && !entry.purchasedBy);
      requireRule(offer, 'NOT_FOUND', 'Offer is no longer available.');
      let price = offer.price;
      if (command.useRedLedger) {
        requireRule(publicBuy && heldItems(actor).some((item) => item.itemId === 'red-ledger') && actor.abilities!.redLedgerRound !== room.round!.number, 'NOT_ELIGIBLE', 'Red Ledger discount is unavailable.');
        price = Math.max(0, price - 1); actor.abilities!.redLedgerRound = room.round!.number;
      }
      requireRule(actor.inventory.coins >= price, 'INSUFFICIENT_COINS', 'Not enough Coins.');
      actor.inventory.coins -= price; purchases[actor.id] = true; shop.boughtBy[actor.id] = true;
      offer.purchasedBy = actor.id;
      if (publicBuy) shop.publicOffers = shop.publicOffers.filter((entry) => entry.id !== offer.id);
      acquire(room, actor, stackForOffer(room, offer.itemId), now);
      event(room, now, 'PURCHASE', `${actor.name} purchased ${ITEM_BY_ID[offer.itemId]!.name}.`, actor.id); return;
    }
    case 'SELL': {
      requireRule(!shop.boughtBy[actor.id], 'NOT_ELIGIBLE', 'Sell before making purchases.');
      const item = owned(actor, command.instanceId, true);
      requireRule(ITEM_BY_ID[item.itemId]!.basePrice !== null, 'NOT_ELIGIBLE', 'Artifacts and Passage Token cannot be sold.');
      actor.inventory.coins += resalePrice(item.itemId, actor.roleId === 'broker') * item.quantity;
      removeItem(actor, item.instanceId); syncEquipment(room, actor, now);
      event(room, now, 'SOLD', `${actor.name} sold ${ITEM_BY_ID[item.itemId]!.name}.`, actor.id); return;
    }
    case 'POCKET': {
      const item = owned(actor, command.instanceId, true);
      const pocket = actor.inventory.pockets[command.pocketIndex];
      requireRule(Number.isInteger(command.pocketIndex) && pocket && !pocket.item && ITEM_BY_ID[item.itemId]!.pocketEligible, 'NOT_ELIGIBLE', 'Pocket placement is not legal.');
      pocket.item = removeItem(actor, item.instanceId);
      event(room, now, 'POCKET_FILLED', `${actor.name} filled a Pocket.`, actor.id); return;
    }
    case 'ASSIGN_SAFE': {
      const safe = owned(actor, command.instanceId, true);
      requireRule(safe.itemId === 'safe' && Number.isInteger(command.pocketIndex) && actor.inventory.pockets[command.pocketIndex], 'NOT_ELIGIBLE', 'Choose a visible Safe and an existing Pocket.');
      actor.safeAssignments![safe.instanceId] = command.pocketIndex; syncEquipment(room, actor, now); return;
    }
    case 'REROLL_MARKET': {
      requireRule(heldItems(actor).some((item) => item.itemId === 'brass-idol') && actor.abilities!.brassIdolRound !== room.round!.number, 'NOT_ELIGIBLE', 'Brass Idol reroll is unavailable.');
      const offers = shop.privateOffers[actor.id]!;
      const index = offers.findIndex((offer) => offer.id === command.offerId && !offer.purchasedBy);
      requireRule(index >= 0 && !shop.privatePurchasedBy[actor.id], 'NOT_ELIGIBLE', 'Offer cannot be rerolled.');
      const previousKey = offers[index]!.itemId === 'black-key';
      // Preserve the first guaranteed opportunity if its owner deliberately rerolls it.
      offers[index] = generateBlackOffer(room, offers.map((offer) => offer.itemId));
      if (previousKey && !room.players.some((player) => heldItems(player).some((item) => item.itemId === 'black-key'))) room.match!.blackKeyObtainable = false;
      actor.abilities!.brassIdolRound = room.round!.number;
      event(room, now, 'MARKET_REROLLED', `${actor.name} rerolled a private market offer.`, actor.id); return;
    }
    default: requireRule(false, 'INVALID_COMMAND', 'Unknown shopping action.');
  }
}
import { stack as stackForOffer } from './inventory.js';
