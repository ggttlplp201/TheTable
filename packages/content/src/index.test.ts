import { describe, expect, it } from 'vitest';
import { AUDIO, CHEST_DISTRIBUTIONS, DECK_EXCLUSIONS_2P, GAME_CONSTANTS, ITEMS, OBJECTIVES, ROLES, SHOP_WEIGHTS, assignObjectives, validateContent } from './index.js';

describe('content', () => {
  it('passes internal validation and excludes removed prototype content', () => {
    expect(validateContent()).toEqual([]);
    expect('counterfeit' in ITEMS).toBe(false);
    expect('extra-pocket' in ITEMS).toBe(false);
    expect(ITEMS.bag.effect.extraPockets).toBe(1);
    expect(Object.values(ITEMS).filter((item) => item.rarity === 'ARTIFACT')).toHaveLength(3);
    expect(['brassIdol', 'glassEye', 'redLedger'].every((id) => ITEMS[id as keyof typeof ITEMS].type === 'ARTIFACT')).toBe(true);
    expect(['brassIdol', 'glassEye', 'redLedger'].every((id) => ITEMS[id as keyof typeof ITEMS].consumption === 'REUSABLE')).toBe(true);
    expect(ITEMS.knife.rarity).toBe('UNCOMMON');
    expect(ITEMS.pistol.rarity).toBe('RARE');
    expect(ITEMS.bag.rarity).toBe('RARE');
    expect(ITEMS.blackKey.rarity).toBe('SPECIAL');
  });

  it('matches every role kit and coin total', () => {
    expect(ROLES.enforcer).toMatchObject({ startingItems: ['pistol', 'bullet'], startingCoins: 2 });
    expect(ROLES.medic).toMatchObject({ startingItems: ['medicine', 'antidote'], startingCoins: 3 });
    expect(ROLES.smuggler).toMatchObject({ startingItems: ['cloth', 'bag'], startingCoins: 4 });
    expect(ROLES.locksmith).toMatchObject({ startingItems: ['key', 'lockpick'], startingCoins: 3 });
    expect(ROLES.broker).toMatchObject({ startingItems: ['spyglass'], startingCoins: 6 });
    expect(ROLES.scavenger).toMatchObject({ startingItems: ['knife', 'medicine'], startingCoins: 3 });
  });

  it('assigns unique objectives, applies 2P exclusions, and caps death objectives', () => {
    for (const playerCount of [2, 3, 4]) {
      const result = assignObjectives(playerCount, () => 0.5);
      expect(result).toHaveLength(playerCount);
      expect(new Set(result.map((objective) => objective.id)).size).toBe(playerCount);
      expect(result.filter((objective) => objective.tags.includes('death-objective')).length).toBeLessThanOrEqual(1);
      if (playerCount === 2) expect(result.every((objective) => !DECK_EXCLUSIONS_2P.includes(objective.id as typeof DECK_EXCLUSIONS_2P[number]))).toBe(true);
    }
    expect(OBJECTIVES.find((objective) => objective.id === 'guardian')?.targetConstraint).toEqual({ kind: 'TARGET_OBJECTIVE_EXCLUSION', excludedTags: ['death-objective'] });
    expect(OBJECTIVES.find((objective) => objective.id === 'kingmaker')?.targetConstraint).toEqual({ kind: 'TARGET_OBJECTIVE_EXCLUSION', excludedTags: ['death-objective'] });
    expect(OBJECTIVES.find((objective) => objective.id === 'executioner')?.contingency).toEqual({ kind: 'EXTERNAL_TARGET_KILLED', response: 'KILL_KILLER', ifTargetExits: 'FAIL_NO_CONTINGENCY' });
    expect(OBJECTIVES.find((objective) => objective.id === 'guardian')?.contingency).toEqual({ kind: 'EXTERNAL_TARGET_KILLED', response: 'KILL_KILLER' });
    expect(OBJECTIVES.find((objective) => objective.id === 'kingmaker')?.contingency).toEqual({ kind: 'EXTERNAL_TARGET_KILLED', response: 'KILL_KILLER_THEN_EXIT' });
    expect(OBJECTIVES.find((objective) => objective.id === 'martyr')?.playerCount).toEqual([2, 3, 4]);
    expect(OBJECTIVES.filter((objective) => ['extortionist', 'duelist', 'savior', 'graverobber', 'poisoner'].includes(objective.id)).every((objective) => objective.targeting === 'TWO_OTHER_PLAYERS')).toBe(true);
    expect(OBJECTIVES.find((objective) => objective.id === 'con-artist')?.tags).toEqual(['threat', 'bluff']);
    expect(OBJECTIVES.find((objective) => objective.id === 'survivor')?.targeting).toBe('TWO_OTHER_PLAYERS');
    expect(OBJECTIVES.find((objective) => objective.id === 'survivor')?.targetingByPlayerCount).toEqual({ 2: 'ONE_OTHER_PLAYER' });
  });

  it('exposes exact market weights and semantic audio keys', () => {
    expect(SHOP_WEIGHTS.publicRarity).toEqual({ COMMON: 50, UNCOMMON: 40, RARE: 10 });
    expect(SHOP_WEIGHTS.blackMarketRarity).toEqual({ COMMON: 15, UNCOMMON: 50, RARE: 30, SPECIAL: 5 });
    expect(SHOP_WEIGHTS.publicSlotPools.supportUtility).toEqual(['medicine', 'antidote', 'key', 'bullet', 'cloth']);
    expect(SHOP_WEIGHTS.publicSlotPools.interactionCombat).toEqual(['knife', 'poison', 'spyglass', 'pickpocket', 'handcuffs', 'armor']);
    expect(SHOP_WEIGHTS.blackMarketEmphasizedPool).toEqual(['cloth', 'safe', 'pickpocket', 'poison', 'bag', 'lockpick', 'pistol', 'blackKey']);
    expect(CHEST_DISTRIBUTIONS.standard.slotA.outcomes).toEqual({ coins3: 20, uncommonItem: 50, rareItem: 30 });
    expect(CHEST_DISTRIBUTIONS.standard.slotB.outcomes).toEqual({ coins4: 25, artifact: 35, uncommonOrRareItem: 25, blackKey: 15 });
    expect(CHEST_DISTRIBUTIONS.black.premium).toMatchObject({ slots: 2, outcomes: { coins5: 20, artifact: 30, rareItem: 40, blackKey: 10 } });
    expect(GAME_CONSTANTS.exitScores).toEqual({ 2: [100, 50], 3: [100, 65, 35], 4: [100, 70, 45, 25] });
    expect(SHOP_WEIGHTS.publicSlotPools.supportUtility).toContain('medicine');
    expect(SHOP_WEIGHTS.publicSlotPools.remainingRarePool).toEqual(['pistol', 'bag', 'crowbar']);
    expect(SHOP_WEIGHTS.publicSlotPools.excluded).toEqual(['blackKey', 'brassIdol', 'glassEye', 'redLedger', 'passageToken']);
    expect(AUDIO.event).toMatchObject({ trade: 'event.trade', threat: 'event.threat', death: 'event.death' });
    expect(ROLES.medic.ability.id).toBe('field-dressing');
    expect(ROLES.smuggler.ability.id).toBe('private-stock');
    expect(ROLES.locksmith.ability.id).toBe('tumbler-sense');
    expect(ROLES.broker.ability.id).toBe('margin');
    expect(ROLES.scavenger.ability.id).toBe('salvage');
    expect(OBJECTIVES).toHaveLength(20);
  });
});
