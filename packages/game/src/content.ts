import { ITEMS, OBJECTIVES, BALANCE } from '@the-table/content';
export { ITEMS, ROLES, OBJECTIVES, WILDCARDS, ROUND_INCOME } from '@the-table/content';
export const ITEM_BY_ID = Object.fromEntries(Object.values(ITEMS).map((item) => [item.id, item]));
export const OBJECTIVE_BY_ID = Object.fromEntries(OBJECTIVES.map((objective) => [objective.id, objective]));
/** Engine terminology adapter; every balance value remains owned by content. */
export const RULES = {
  roundIncome: BALANCE.roundIncome, wildcardUnlockRound: BALANCE.wildcardUnlockRound,
  minimumPlayers: BALANCE.minimumPlayers, maximumPlayers: BALANCE.maximumPlayers, setupMs: BALANCE.setupChoiceMs,
  maxHp: BALANCE.maxHp, maxTemporaryHp: BALANCE.maxTemporaryHp, visibleSlots: BALANCE.visibleInventorySlots,
  turnMs: BALANCE.normalTurnMs, responseMs: BALANCE.interactionResponseMs, overflowMs: BALANCE.acquisitionChoiceMs,
  intermissionPrepMs: BALANCE.intermissionPrepMs, publicShopDecisionMs: BALANCE.publicShopDecisionMs, privateMarketGraceMs: BALANCE.privateMarketGraceMs,
  objectiveCoins: BALANCE.readinessRewards.first, contingencyCoins: BALANCE.readinessRewards.contingency,
  contingencyScoreMultiplier: BALANCE.contingencyScorePercent / 100,
  scoreByPlayerCount: BALANCE.exitScores as Record<number, readonly number[]>,
} as const;
