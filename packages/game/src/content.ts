import { ITEMS, OBJECTIVES, BALANCE } from '@the-table/content';
export { ITEMS, ROLES, OBJECTIVES } from '@the-table/content';
export const ITEM_BY_ID = Object.fromEntries(Object.values(ITEMS).map((item) => [item.id, item]));
export const OBJECTIVE_BY_ID = Object.fromEntries(OBJECTIVES.map((objective) => [objective.id, objective]));
/** Engine terminology adapter; every balance value remains owned by content. */
export const RULES = {
  maxHp: BALANCE.maxHp, visibleSlots: BALANCE.visibleInventorySlots,
  turnMs: BALANCE.normalTurnMs, responseMs: BALANCE.interactionResponseMs, overflowMs: BALANCE.acquisitionChoiceMs,
  objectiveCoins: BALANCE.readinessRewards.first, contingencyCoins: BALANCE.readinessRewards.contingency,
  contingencyScoreMultiplier: BALANCE.contingencyScorePercent / 100,
  scoreByPlayerCount: BALANCE.exitScores as Record<number, readonly number[]>,
} as const;
