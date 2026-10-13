export type Rarity = 'COMMON' | 'UNCOMMON' | 'RARE' | 'SPECIAL' | 'ARTIFACT' | 'QUEST';
export type Consumption = 'ONE_USE' | 'REUSABLE' | 'PERSISTENT_UNTIL_TRIGGER';
export type ItemType = 'WEAPON' | 'AMMO' | 'HEALING' | 'DEFENSE' | 'UTILITY' | 'ARTIFACT' | 'QUEST';

export interface ItemDefinition {
  id: string;
  name: string;
  type: ItemType;
  basePrice: number | null;
  rarity: Rarity;
  consumption: Consumption;
  pocketEligible: boolean;
  maxStack: number;
  tags: readonly string[];
  effect: Readonly<Record<string, unknown>>;
}

export interface RoleDefinition {
  id: string;
  name: string;
  startingItems: readonly string[];
  startingCoins: number;
  ability: Readonly<Record<string, unknown>>;
}

export type ObjectiveMode = 'LATCHED' | 'SUSTAINED';
export interface ObjectiveDefinition {
  id: string;
  name: string;
  unlockRound: number;
  mode: ObjectiveMode;
  targeting: 'NONE' | 'ONE_OTHER_PLAYER' | 'TWO_OTHER_PLAYERS' | 'ROLE' | 'DEATH_SUCCESS';
  playerCount: readonly number[];
  contingency?: Readonly<Record<string, unknown>>;
  tags: readonly string[];
  completion: Readonly<Record<string, unknown>>;
  targetConstraint?: Readonly<Record<string, unknown>>;
  targetingByPlayerCount?: Readonly<Record<number, ObjectiveDefinition['targeting']>>;
}

const item = (id: string, name: string, type: ItemType, basePrice: number | null, rarity: Rarity, consumption: Consumption, pocketEligible: boolean, maxStack: number, tags: readonly string[], effect: Readonly<Record<string, unknown>> = {}): ItemDefinition => ({ id, name, type, basePrice, rarity, consumption, pocketEligible, maxStack, tags, effect });

export const ITEMS = {
  knife: item('knife', 'Knife', 'WEAPON', 4, 'UNCOMMON', 'ONE_USE', true, 1, ['weapon', 'adjacent'], { damage: 2 }),
  pistol: item('pistol', 'Pistol', 'WEAPON', 7, 'RARE', 'REUSABLE', true, 1, ['weapon', 'ranged'], { damage: 3, consumes: 'bullet' }),
  bullet: item('bullet', 'Bullet', 'AMMO', 2, 'COMMON', 'ONE_USE', true, 3, ['ammo'], { maxStack: 3 }),
  poison: item('poison', 'Poison', 'WEAPON', 4, 'UNCOMMON', 'ONE_USE', true, 1, ['status'], { damage: 1, ownerTurns: 3 }),
  antidote: item('antidote', 'Antidote', 'HEALING', 3, 'COMMON', 'ONE_USE', true, 1, ['status'], { removes: 'poison' }),
  medicine: item('medicine', 'Medicine', 'HEALING', 4, 'COMMON', 'ONE_USE', true, 1, ['revive', 'heal'], { heal: 2, reviveHp: 2 }),
  stimulant: item('stimulant', 'Stimulant', 'HEALING', 5, 'UNCOMMON', 'ONE_USE', true, 1, ['heal', 'recovery', 'defense', 'temporary-hp'], { heal: 2, temporaryHpCap: 2 }),
  armor: item('armor', 'Armor', 'DEFENSE', 5, 'UNCOMMON', 'PERSISTENT_UNTIL_TRIGGER', false, 1, ['blocks-hit'], { blocks: ['knife', 'pistol'] }),
  cloth: item('cloth', 'Cloth', 'UTILITY', 2, 'COMMON', 'ONE_USE', true, 1, ['threat']),
  bag: item('bag', 'Bag', 'UTILITY', 5, 'RARE', 'PERSISTENT_UNTIL_TRIGGER', false, 1, ['capacity'], { extraPockets: 1 }),
  safe: item('safe', 'Safe', 'UTILITY', 4, 'UNCOMMON', 'PERSISTENT_UNTIL_TRIGGER', false, 1, ['protection'], { protectsPocket: 1 }),
  spyglass: item('spyglass', 'Spyglass', 'UTILITY', 4, 'UNCOMMON', 'ONE_USE', true, 1, ['inspection']),
  pickpocket: item('pickpocket', 'Pickpocket', 'UTILITY', 4, 'UNCOMMON', 'ONE_USE', true, 1, ['steal']),
  key: item('key', 'Key', 'UTILITY', 3, 'COMMON', 'ONE_USE', true, 1, ['standard-chest']),
  lockpick: item('lockpick', 'Lockpick', 'UTILITY', 5, 'UNCOMMON', 'ONE_USE', true, 1, ['standard-chest']),
  crowbar: item('crowbar', 'Crowbar', 'UTILITY', 6, 'RARE', 'REUSABLE', true, 1, ['standard-chest'], { destroysRandomLootSlot: true }),
  blackKey: item('black-key', 'Black Key', 'UTILITY', 7, 'SPECIAL', 'ONE_USE', true, 1, ['black-chest']),
  handcuffs: item('handcuffs', 'Handcuffs', 'UTILITY', 5, 'UNCOMMON', 'ONE_USE', true, 1, ['control'], { targetTurnEffect: 'no-trade-or-threat' }),
  brassIdol: item('brass-idol', 'Brass Idol', 'ARTIFACT', null, 'ARTIFACT', 'REUSABLE', true, 1, ['artifact', 'black-market'], { rerollsBlackMarketOption: 1 }),
  glassEye: item('glass-eye', 'Glass Eye', 'ARTIFACT', null, 'ARTIFACT', 'REUSABLE', true, 1, ['artifact', 'inspection'], { weaponInspection: 'yes-no' }),
  redLedger: item('red-ledger', 'Red Ledger', 'ARTIFACT', null, 'ARTIFACT', 'REUSABLE', true, 1, ['artifact', 'shop'], { publicShopDiscount: 1 }),
  passageToken: item('passage-token', 'Passage Token', 'QUEST', null, 'QUEST', 'PERSISTENT_UNTIL_TRIGGER', true, 1, ['quest']),
} as const satisfies Record<string, ItemDefinition>;

export type ItemId = keyof typeof ITEMS;

/** Table events, deliberately separate from inventory items and market pools. */
export const WILDCARDS = [
  { id: 'seize', name: 'Seize', description: 'Take 1 visible item from another active player.', targeting: 'VISIBLE_ITEM' },
  { id: 'destroy', name: 'Destroy', description: 'Discard 1 visible item belonging to another active player.', targeting: 'VISIBLE_ITEM' },
  { id: 'supply-drop', name: 'Supply Drop', description: 'Every active player receives 1 random Common or Uncommon normal item.', targeting: 'NONE' },
  { id: 'shatter', name: 'Shatter', description: 'Every active player loses 1 random visible item.', targeting: 'NONE' },
  { id: 'forced-exchange', name: 'Forced Exchange', description: 'Swap 1 of your visible items with 1 visible item belonging to another active player.', targeting: 'EXCHANGE' },
  { id: 'search-warrant', name: 'Search Warrant', description: 'Reveal an occupied Pocket belonging to another active player to the table. Safe blocks this.', targeting: 'POCKET' },
  { id: 'windfall', name: 'Windfall', description: 'Every active player gains 2 Gold.', targeting: 'NONE' },
  { id: 'redistribution', name: 'Redistribution', description: 'The active player with the least Gold receives 1 Gold from every other active player who can pay. Ties are random.', targeting: 'NONE' },
  { id: 'scramble', name: 'Scramble', description: 'Every active player passes 1 random visible item to the next active seat clockwise.', targeting: 'NONE' },
  { id: 'second-chance', name: 'Second Chance', description: 'Every living active player heals 1 HP, up to maximum. Does not revive Downed players or remove Poison.', targeting: 'NONE' },
] as const;
export type WildcardId = (typeof WILDCARDS)[number]['id'];
export const TASK_REWARD = 2;
export const TASKS_PER_ROUND = 2;
export const TASKS = [
  { id: 'trade', name: 'Trade', description: 'Complete a Trade that transfers an item or Gold.', category: 'SOCIAL', weight: 3 },
  { id: 'damage', name: 'Damage', description: 'Deal direct damage to another player.', category: 'COMBAT', weight: 3 },
  { id: 'extort', name: 'Extort', description: 'Receive a demanded asset through a Threat.', category: 'SOCIAL', weight: 3 },
  { id: 'heal', name: 'Heal', description: 'Restore at least 1 normal HP to another living player. Temporary HP does not count.', category: 'SUPPORT', weight: 3 },
  { id: 'revive', name: 'Revive', description: 'Revive another Downed player.', category: 'SUPPORT', weight: 3 },
  { id: 'loot', name: 'Loot', description: 'Loot a visible item from a Downed player.', category: 'RESOURCE', weight: 3 },
  { id: 'open-chest', name: 'Open a Chest', description: 'Open either Chest yourself.', category: 'RESOURCE', weight: 3 },
  { id: 'inspect-pocket', name: 'Inspect a Pocket', description: 'Use a Spyglass to inspect another player’s Pocket.', category: 'INFORMATION', weight: 3 },
  { id: 'pickpocket', name: 'Pickpocket', description: 'Steal an item from another player’s Pocket.', category: 'INFORMATION', weight: 3 },
  { id: 'break-armor', name: 'Break Armor', description: 'Destroy another player’s Armor with a direct attack.', category: 'COMBAT', weight: 3 },
  { id: 'call-bluff', name: 'Call a Bluff', description: 'Refuse a Covered Threat and take no damage.', category: 'REACTIVE', weight: 1 },
  { id: 'bluff', name: 'Bluff Successfully', description: 'Get compliance with a harmless or invalid Covered Threat.', category: 'SOCIAL', weight: 3 },
  { id: 'wildcard', name: 'Use a Wildcard', description: 'Draw and Use a Wildcard. Burning does not count.', category: 'WILDCARD', weight: 3 },
  { id: 'receive-coins', name: 'Receive 2 Gold', description: 'Receive 2 Gold in one Trade or Threat.', category: 'RESOURCE', weight: 3 },
] as const;
export type TaskId = (typeof TASKS)[number]['id'];

export const ROUND_INCOME = 2;

export const ROLES = {
  enforcer: { id: 'enforcer', name: 'Enforcer', startingItems: ['pistol', 'bullet', 'cloth'], startingCoins: 2, ability: { id: 'quick-draw', name: 'Quick Draw', uses: 1, effect: 'fire-pistol-without-bullet' } },
  medic: { id: 'medic', name: 'Medic', startingItems: ['medicine', 'antidote', 'knife'], startingCoins: 3, ability: { id: 'field-dressing', name: 'Field Dressing', effect: 'revive-another-to-3-hp' } },
  smuggler: { id: 'smuggler', name: 'Smuggler', startingItems: ['cloth', 'bag', 'poison'], startingCoins: 4, ability: { id: 'private-stock', name: 'Private Stock', offers: 4 } },
  locksmith: { id: 'locksmith', name: 'Locksmith', startingItems: ['key', 'lockpick', 'knife'], startingCoins: 3, ability: { id: 'tumbler-sense', name: 'Tumbler Sense', uses: 'once-per-complete-round' } },
  broker: { id: 'broker', name: 'Broker', startingItems: ['spyglass', 'handcuffs', 'knife'], startingCoins: 5, ability: { id: 'margin', name: 'Margin', coins: 1, cap: 'base-price-minus-one' } },
  scavenger: { id: 'scavenger', name: 'Scavenger', startingItems: ['knife', 'medicine', 'crowbar'], startingCoins: 3, ability: { id: 'salvage', name: 'Salvage', coins: 1, frequency: 'once-per-intermission' } },
} as const satisfies Record<string, RoleDefinition>;

export const OBJECTIVES: readonly ObjectiveDefinition[] = [
  { id: 'escapist', name: 'Escapist', unlockRound: 3, mode: 'SUSTAINED', targeting: 'NONE', playerCount: [3, 4], tags: ['exit'], completion: { kind: 'POSSESS_ITEM_THEN_EXIT', itemId: 'passageToken', surviveToLaterTurn: true } },
  { id: 'collector', name: 'Collector', unlockRound: 2, mode: 'SUSTAINED', targeting: 'NONE', playerCount: [3, 4], tags: ['exit', 'artifact'], completion: { kind: 'POSSESS_DISTINCT_ITEMS', itemRarity: 'ARTIFACT', count: 2, thenExitLater: true } },
  { id: 'tycoon', name: 'Tycoon', unlockRound: 2, mode: 'SUSTAINED', targeting: 'NONE', playerCount: [3, 4], tags: ['exit', 'coins', 'trade'], completion: { kind: 'COINS_AND_SUCCESSFUL_TRADE', amount: 15, successfulTrades: 1, tradeLatched: true } },
  { id: 'executioner', name: 'Executioner', unlockRound: 1, mode: 'LATCHED', targeting: 'ONE_OTHER_PLAYER', playerCount: [3, 4], tags: ['target'], completion: { kind: 'PERSONALLY_CAUSE_PERMANENT_DEATH', targetCount: 1 }, contingency: { kind: 'EXTERNAL_TARGET_KILLED', response: 'KILL_KILLER', ifTargetExits: 'FAIL_NO_CONTINGENCY' } },
  { id: 'guardian', name: 'Guardian', unlockRound: 1, mode: 'LATCHED', targeting: 'ONE_OTHER_PLAYER', playerCount: [3, 4], tags: ['target', 'protect'], completion: { kind: 'TARGET_ALIVE_THROUGH_ROUND', round: 4, targetExitBeforeRoundCounts: true }, targetConstraint: { kind: 'TARGET_OBJECTIVE_EXCLUSION', excludedTags: ['death-objective'] }, contingency: { kind: 'EXTERNAL_TARGET_KILLED', response: 'KILL_KILLER' } },
  { id: 'kingmaker', name: 'Kingmaker', unlockRound: 2, mode: 'LATCHED', targeting: 'ONE_OTHER_PLAYER', playerCount: [3, 4], tags: ['target'], completion: { kind: 'TARGET_COMPLETES_OBJECTIVE_AND_EXITS' }, targetConstraint: { kind: 'TARGET_OBJECTIVE_EXCLUSION', excludedTags: ['death-objective'] }, contingency: { kind: 'EXTERNAL_TARGET_KILLED', response: 'KILL_KILLER_THEN_EXIT' } },
  { id: 'martyr', name: 'Martyr', unlockRound: 1, mode: 'LATCHED', targeting: 'DEATH_SUCCESS', playerCount: [3, 4], tags: ['death-objective'], completion: { kind: 'FIRST_PERMANENT_DEATH', deathIsSuccess: true } },
  { id: 'phoenix', name: 'Phoenix', unlockRound: 2, mode: 'LATCHED', targeting: 'NONE', playerCount: [3, 4], tags: ['revive'], completion: { kind: 'RECOVER_FROM_DOWNED_EVENTS', count: 2, separateEvents: true } },
  { id: 'betrayer', name: 'Betrayer', unlockRound: 2, mode: 'LATCHED', targeting: 'ONE_OTHER_PLAYER', playerCount: [3, 4], tags: ['target'], completion: { kind: 'TRADE_THEN_PERSONALLY_DOWN_SAME_PLAYER', sequencing: 'TRADE_RESOLVES_BEFORE_DOWN' } },
  { id: 'extortionist', name: 'Extortionist', unlockRound: 2, mode: 'LATCHED', targeting: 'TWO_OTHER_PLAYERS', playerCount: [3, 4], tags: ['target'], completion: { kind: 'SUCCESSFUL_THREATS', distinctTargetCount: 2, demandedAssetsReceived: true } },
  { id: 'con-artist', name: 'Con Artist', unlockRound: 2, mode: 'LATCHED', targeting: 'NONE', playerCount: [3, 4], tags: ['threat', 'bluff'], completion: { kind: 'COVERED_BLUFF_BOTH_OUTCOMES', compliantHarmless: 1, refusedRealWeapon: 1 } },
  { id: 'duelist', name: 'Duelist', unlockRound: 2, mode: 'LATCHED', targeting: 'TWO_OTHER_PLAYERS', playerCount: [3, 4], tags: ['target'], completion: { kind: 'PERSONALLY_DOWN_DISTINCT_PLAYERS', count: 2 } },
  { id: 'savior', name: 'Savior', unlockRound: 2, mode: 'LATCHED', targeting: 'TWO_OTHER_PLAYERS', playerCount: [3, 4], tags: ['target', 'revive'], completion: { kind: 'PERSONALLY_REVIVE_DISTINCT_PLAYERS', count: 2, selfReviveCounts: false } },
  { id: 'graverobber', name: 'Graverobber', unlockRound: 2, mode: 'LATCHED', targeting: 'TWO_OTHER_PLAYERS', playerCount: [3, 4], tags: ['target', 'death'], completion: { kind: 'LOOT_DOWNED_DISTINCT_PLAYERS', count: 2, visibleItemsAtLeast: 1 } },
  { id: 'poisoner', name: 'Poisoner', unlockRound: 2, mode: 'LATCHED', targeting: 'TWO_OTHER_PLAYERS', playerCount: [3, 4], tags: ['target'], completion: { kind: 'CAUSE_POISON_TICK_ON_DISTINCT_PLAYERS', count: 2 } },
  { id: 'chest-raider', name: 'Chest Raider', unlockRound: 3, mode: 'LATCHED', targeting: 'NONE', playerCount: [3, 4], tags: ['chest'], completion: { kind: 'PERSONALLY_OPEN_CHESTS', chestKinds: ['STANDARD', 'BLACK'] } },
  { id: 'merchant', name: 'Merchant', unlockRound: 2, mode: 'LATCHED', targeting: 'TWO_OTHER_PLAYERS', playerCount: [3, 4], tags: ['trade'], completion: { kind: 'SUCCESSFUL_TRADES', distinctTargetCount: 2 } },
  { id: 'hidden-hand', name: 'Hidden Hand', unlockRound: 2, mode: 'LATCHED', targeting: 'NONE', playerCount: [3, 4], tags: ['pocket'], completion: { kind: 'ACQUIRE_VIA_METHODS', methods: ['PICKPOCKET', 'DOWNED_LOOT'], sameSourceAllowed: true } },
  { id: 'survivor', name: 'Survivor', unlockRound: 3, mode: 'LATCHED', targeting: 'TWO_OTHER_PLAYERS', playerCount: [3, 4], tags: ['target', 'exit'], completion: { kind: 'REMAIN_ALIVE_AFTER_RESOLVED_PLAYERS', resolvedCount: 2, resolvedStates: ['EXITED', 'DEAD'] } },
  { id: 'arsenal', name: 'Arsenal', unlockRound: 2, mode: 'SUSTAINED', targeting: 'NONE', playerCount: [3, 4], tags: ['exit', 'weapons'], completion: { kind: 'POSSESS_ITEMS', itemIds: ['pistol', 'bullet', 'knife', 'armor'], bulletMinimum: 1, sustainedUntilExit: true } },
];

export const SHOP_WEIGHTS = {
  publicRarity: { COMMON: 50, UNCOMMON: 40, RARE: 10 },
  blackMarketRarity: { COMMON: 15, UNCOMMON: 50, RARE: 30, SPECIAL: 5 },
  publicSlots: { 3: 4, 4: 4 },
  privateOffers: { default: 3, smuggler: 4 },
  publicSlotPools: {
    supportUtility: ['medicine', 'antidote', 'key', 'bullet', 'cloth', 'stimulant'] as const,
    interactionCombat: ['knife', 'poison', 'spyglass', 'pickpocket', 'handcuffs', 'armor'] as const,
    remainingRarePool: ['pistol', 'bag', 'crowbar'] as const,
    excluded: ['blackKey', 'brassIdol', 'glassEye', 'redLedger', 'passageToken'] as const,
  },
  blackMarketEmphasizedPool: ['cloth', 'safe', 'pickpocket', 'poison', 'bag', 'lockpick', 'pistol', 'blackKey'] as const,
} as const;

export const STARTING_BONUS_POOL = ['knife', 'poison', 'spyglass', 'handcuffs', 'medicine', 'key', 'cloth', 'bullet'] as const;

export const CHEST_DISTRIBUTIONS = {
  openingStandard: {
    slotA: { commonItem: 60, uncommonItem: 40 },
    slotB: { coins2: 50, commonItem: 35, uncommonItem: 15 },
  },
  standard: {
    slotA: { outcomes: { coins3: 20, uncommonItem: 50, rareItem: 30 } },
    slotB: { outcomes: { coins4: 25, artifact: 35, uncommonOrRareItem: 25, blackKey: 15 } },
    avoidDuplicateArtifacts: true,
  },
  black: {
    premium: { slots: 2, outcomes: { coins5: 20, artifact: 30, rareItem: 40, blackKey: 10 }, addPassageTokenWhenRequired: true },
    avoidDuplicateArtifacts: true,
  },
} as const;

export const POOL_RETURN_RULES = {
  onPermanentDeath: { ordinaryInventory: 'LEAVE_PLAY', artifacts: 'RETURN_TO_POOL', passageToken: 'RETURN_TO_POOL' },
  passageTokenIfItWouldLeaveMatch: 'RETURN_TO_BLACK_CHEST_NEXT_REFRESH',
  noExactDuplicatePerOffering: true,
} as const;

export const GAME_CONSTANTS = {
  roundIncome: ROUND_INCOME,
  wildcardUnlockRound: 3,
  minimumPlayers: 3,
  maximumPlayers: 4,
  setupChoiceMs: 30_000,
  maxHp: 5,
  maxTemporaryHp: 2,
  visibleInventorySlots: 6,
  defaultPockets: 1,
  bagExtraPockets: 1,
  bulletMaxStack: 3,
  normalTurnMs: 60_000,
  interactionResponseMs: 30_000,
  acquisitionChoiceMs: 15_000,
  intermissionPrepMs: 10_000,
  publicShopDecisionMs: 30_000,
  privateMarketGraceMs: 30_000,
  readinessRewards: { first: 3, contingency: 2 },
  exitScores: { 3: [100, 65, 35], 4: [100, 70, 45, 25] },
  contingencyScorePercent: 80,
} as const;

/** Canonical immutable prototype balance data consumed by the rules engine. */
export const BALANCE = GAME_CONSTANTS;

export const DEATH_OBJECTIVE_TAG = 'death-objective';

export function validateContent(): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  for (const definition of Object.values(ITEMS)) {
    if (ids.has(definition.id)) errors.push(`duplicate item id: ${definition.id}`);
    ids.add(definition.id);
    if (definition.basePrice !== null && (!Number.isInteger(definition.basePrice) || definition.basePrice < 1)) errors.push(`invalid item price: ${definition.id}`);
  }
  for (const role of Object.values(ROLES)) for (const itemId of role.startingItems) if (!(itemId in ITEMS)) errors.push(`unknown starting item: ${role.id}/${itemId}`);
  const objectiveIds = new Set<string>();
  for (const objective of OBJECTIVES) {
    if (objectiveIds.has(objective.id)) errors.push(`duplicate objective id: ${objective.id}`);
    objectiveIds.add(objective.id);
    if (!objective.playerCount.every((count) => count >= 3 && count <= 4)) errors.push(`invalid objective player count: ${objective.id}`);
  }
  return errors;
}

export function objectivesForPlayerCount(playerCount: number): readonly ObjectiveDefinition[] {
  return OBJECTIVES.filter((objective) => objective.playerCount.includes(playerCount));
}

export function assignObjectives(playerCount: number, random: () => number): ObjectiveDefinition[] {
  if (!Number.isInteger(playerCount) || playerCount < 3 || playerCount > 4) throw new Error('player count must be 3–4');
  const eligible = objectivesForPlayerCount(playerCount);
  const shuffled = [...eligible];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.max(0, Math.min(0.999999, random())) * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex]!, shuffled[index]!];
  }
  const selected: ObjectiveDefinition[] = [];
  for (const objective of shuffled) {
    if (selected.length === playerCount) break;
    if (objective.tags.includes(DEATH_OBJECTIVE_TAG) && selected.some((candidate) => candidate.tags.includes(DEATH_OBJECTIVE_TAG))) continue;
    selected.push(objective);
  }
  if (selected.length !== playerCount) throw new Error('unable to assign objectives');
  return selected;
}
