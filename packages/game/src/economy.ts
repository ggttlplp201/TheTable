import { SHOP_WEIGHTS, CHEST_DISTRIBUTIONS } from '@the-table/content';
import { ITEM_BY_ID, RULES } from './content.js';
import { event, id } from './internal.js';
import { heldItems, stack } from './inventory.js';
import { SeededRandom } from './random.js';
import type { ChestLoot, ChestState, RoomState, ShopOffer, ShopState } from './types.js';

export function withRandom<T>(room: RoomState, run: (random: SeededRandom) => T): T {
  const random = new SeededRandom(room.match!.rngState);
  const result = run(random);
  room.match!.rngState = random.state;
  return result;
}
function weighted<T extends string>(weights: Readonly<Record<T, number>>, random: SeededRandom): T {
  const entries = Object.entries(weights) as Array<[T, number]>;
  let remaining = random.next() * entries.reduce((sum, [, weight]) => sum + weight, 0);
  for (const [key, weight] of entries) { remaining -= weight; if (remaining < 0) return key; }
  return entries.at(-1)![0];
}
function itemOfRarity(room: RoomState, rarity: string, random: SeededRandom, excluded: string[] = []): string {
  const candidates = Object.values(ITEM_BY_ID).filter((item) => item.rarity === rarity && item.basePrice !== null && !excluded.includes(item.id));
  if (candidates.length) return random.pick(candidates).id;
  const fallback = Object.values(ITEM_BY_ID).filter((item) => item.basePrice !== null && !excluded.includes(item.id) && item.rarity !== 'SPECIAL');
  return random.pick(fallback).id;
}
function offer(room: RoomState, itemId: string, black: boolean): ShopOffer {
  if (itemId === 'black-key') room.match!.blackKeyObtainable = true;
  return { id: id(room, 'offer'), itemId, price: ITEM_BY_ID[itemId]!.basePrice! + (black ? 1 : 0) };
}
export function generateBlackOffer(room: RoomState, excluded: string[] = []): ShopOffer {
  return withRandom(room, (random) => {
    const rarity = weighted(SHOP_WEIGHTS.blackMarketRarity, random);
    return offer(room, itemOfRarity(room, rarity, random, excluded), true);
  });
}
export function beginIntermission(room: RoomState, now: number): void {
  room.round!.phase = 'INTERMISSION';
  delete room.turn;
  const eligible = room.players.filter((player) => player.life === 'ACTIVE').sort((a, b) => a.seat - b.seat);
  let orderReveal: ShopState['orderReveal'];
  const order = withRandom(room, (random) => {
    if (!eligible.length) return [];
    const start = random.int(eligible.length);
    const direction = random.int(2) === 0 ? 1 : -1;
    orderReveal = { startedAt: now, firstPlayerId: eligible[start]!.id, direction: direction === 1 ? 'ASCENDING' : 'DESCENDING', eligiblePlayerIds: eligible.map(player => player.id), selectedIndex: start };
    return eligible.map((_, index) => eligible[(start + direction * index + eligible.length) % eligible.length]!.id);
  });
  const publicOffers = withRandom(room, (random) => {
    const result: ShopOffer[] = [];
    result.push(offer(room, random.pick(SHOP_WEIGHTS.publicSlotPools.supportUtility), false));
    result.push(offer(room, random.pick(SHOP_WEIGHTS.publicSlotPools.interactionCombat), false));
    while (result.length < SHOP_WEIGHTS.publicSlots[room.players.length as 3 | 4]) {
      const rarity = weighted(SHOP_WEIGHTS.publicRarity, random);
      result.push(offer(room, itemOfRarity(room, rarity, random, result.map((entry) => entry.itemId)), false));
    }
    return result;
  });
  room.shop = {
    id: `${room.id}:match-${room.matchSerial ?? 0}:intermission:${room.round!.number}`,
    phase: 'PREP', prepDeadlineAt: now + RULES.intermissionPrepMs,
    privateUnlockedBy: {}, finishedBy: {},
    publicOffers, privateOffers: {}, publicPurchasedBy: {}, publicSkippedBy: {}, privatePurchasedBy: {}, boughtBy: {},
    order, activeShopperIndex: 0, ...(orderReveal ? { orderReveal } : {}),
  };
  for (const player of eligible) {
    const offers: ShopOffer[] = [];
    for (let index = 0; index < (player.roleId === 'smuggler' ? SHOP_WEIGHTS.privateOffers.smuggler : SHOP_WEIGHTS.privateOffers.default); index += 1) offers.push(generateBlackOffer(room, offers.map((entry) => entry.itemId)));
    room.shop.privateOffers[player.id] = offers;
  }
  if (room.round!.number >= 3 && !room.match!.blackKeyObtainable && room.players.some((player) => ['escapist', 'chest-raider'].includes(player.objective!.objectiveId)) && eligible.length) {
    const chosen = withRandom(room, (random) => random.pick(eligible));
    const offers = room.shop.privateOffers[chosen.id]!;
    offers[offers.length - 1] = offer(room, 'black-key', true);
  }
  for (const player of eligible) {
    if (player.objective?.objectiveId !== 'phoenix' || player.phoenixMedicineOfferSeen) continue;
    player.phoenixMedicineOfferSeen = true;
    if (heldItems(player).some(item => item.itemId === 'medicine')) continue;
    const offers = room.shop.privateOffers[player.id]!;
    const existing = offers.find(entry => entry.itemId === 'medicine');
    if (existing) existing.price = ITEM_BY_ID.medicine!.basePrice!;
    else offers[0] = offer(room, 'medicine', false);
  }
  event(room, now, 'INTERMISSION', 'Intermission begins; both markets refresh.');
  event(room, now, 'INTERMISSION_PREP_STARTED', 'Preparation begins. Sell eligible items and fill empty Pockets.');
}
function artifact(room: RoomState, random: SeededRandom): ChestLoot {
  if (!room.match!.artifactPool.length) throw new Error('Artifact outcome selected with an empty pool.');
  const selected = random.int(room.match!.artifactPool.length);
  const itemId = room.match!.artifactPool.splice(selected, 1)[0]!;
  return { kind: 'ITEM', stack: stack(room, itemId) };
}
function regularLoot(room: RoomState, rarity: string, random: SeededRandom, accessibleWithoutBlackKey = true): ChestLoot {
  const itemId = itemOfRarity(room, rarity, random);
  // A key locked inside the Black Chest cannot be the first access opportunity.
  if (itemId === 'black-key' && accessibleWithoutBlackKey) room.match!.blackKeyObtainable = true;
  return { kind: 'ITEM', stack: stack(room, itemId) };
}
function generateChest(room: RoomState, chest: ChestState): void {
  chest.loot = withRandom(room, (random) => {
    if (chest.kind === 'STANDARD') {
      if (room.round!.number === 1) {
        const a = weighted(CHEST_DISTRIBUTIONS.openingStandard.slotA, random);
        const b = weighted(CHEST_DISTRIBUTIONS.openingStandard.slotB, random);
        return [regularLoot(room, a === 'commonItem' ? 'COMMON' : 'UNCOMMON', random), b === 'coins2' ? { kind: 'COINS', amount: 2 } : regularLoot(room, b === 'commonItem' ? 'COMMON' : 'UNCOMMON', random)] as ChestLoot[];
      }
      const a = weighted(CHEST_DISTRIBUTIONS.standard.slotA.outcomes, random);
      const b = weighted({ ...CHEST_DISTRIBUTIONS.standard.slotB.outcomes, artifact: room.match!.artifactPool.length ? CHEST_DISTRIBUTIONS.standard.slotB.outcomes.artifact : 0 }, random);
      return [
        a === 'coins3' ? { kind: 'COINS', amount: 3 } : regularLoot(room, a === 'uncommonItem' ? 'UNCOMMON' : 'RARE', random),
        b === 'coins4' ? { kind: 'COINS', amount: 4 } : b === 'artifact' ? artifact(room, random) : b === 'uncommonOrRareItem' ? regularLoot(room, random.int(2) === 0 ? 'UNCOMMON' : 'RARE', random) : regularLoot(room, 'SPECIAL', random),
      ] as ChestLoot[];
    }
    const result: ChestLoot[] = [];
    for (let index = 0; index < CHEST_DISTRIBUTIONS.black.premium.slots; index += 1) {
      const resultKind = weighted({ ...CHEST_DISTRIBUTIONS.black.premium.outcomes, artifact: room.match!.artifactPool.length ? CHEST_DISTRIBUTIONS.black.premium.outcomes.artifact : 0 }, random);
      result.push(resultKind === 'coins5' ? { kind: 'COINS', amount: 5 } : resultKind === 'artifact' ? artifact(room, random) : regularLoot(room, resultKind === 'rareItem' ? 'RARE' : 'SPECIAL', random, false));
    }
    if (room.match!.passageTokenAvailable && room.players.some((player) => player.objective?.objectiveId === 'escapist')) {
      result.push({ kind: 'ITEM', stack: stack(room, 'passage-token') });
      room.match!.passageTokenAvailable = false;
    }
    return result;
  });
  chest.availability = 'AVAILABLE';
  delete chest.refreshRound;
}
export function refreshChests(room: RoomState, now: number): void {
  for (const chest of room.chests!) {
    const unlock = chest.kind === 'STANDARD' ? 1 : 3;
    if ((chest.availability === 'HIDDEN' && room.round!.number >= unlock) || (chest.availability === 'OPENED' && room.round!.number >= chest.refreshRound!)) {
      generateChest(room, chest);
      event(room, now, 'CHEST_REFRESHED', `${chest.kind === 'STANDARD' ? 'Standard' : 'Black'} Chest is available.`, undefined, [], undefined, { chestKind: chest.kind });
    }
  }
}
export function resalePrice(itemId: string, broker = false): number {
  const base = ITEM_BY_ID[itemId]!.basePrice;
  if (base === null) return 0;
  const normal = Math.max(1, Math.floor(base / 2));
  return broker ? Math.min(normal + 1, base - 1) : normal;
}
export { RULES };

export function publicShopComplete(shop: Pick<ShopState, 'publicPurchasedBy' | 'publicSkippedBy'>, playerId: string): boolean {
  return Boolean(shop.publicPurchasedBy[playerId] || shop.publicSkippedBy?.[playerId]);
}
