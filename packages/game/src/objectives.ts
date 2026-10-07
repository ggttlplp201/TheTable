import { OBJECTIVES, OBJECTIVE_BY_ID, ITEM_BY_ID, RULES } from './content.js';
import { event, living, playerById, requireRule } from './internal.js';
import { SeededRandom } from './random.js';
import type { ObjectiveState, PlayerState, RoomState } from './types.js';

const targeted = new Set(['executioner', 'guardian', 'kingmaker']);
const twoPlayerExcluded = new Set(['guardian', 'kingmaker', 'duelist', 'savior', 'graverobber', 'poisoner', 'extortionist']);
const deathObjectives = new Set(['martyr']);

/** Backtracking over a seeded ordering avoids retry limits and unlucky assignment failure. */
export function assignCompatibleObjectives(players: readonly PlayerState[], random: SeededRandom): Record<string, ObjectiveState> {
  const eligible = OBJECTIVES.filter((objective) => objective.playerCount.includes(players.length) && !(players.length === 2 && twoPlayerExcluded.has(objective.id)));
  const ordering = players.map(() => random.shuffle(eligible));
  const selected: string[] = [];
  let result: Record<string, ObjectiveState> | undefined;
  function assignTargets(): boolean {
    const states: Record<string, ObjectiveState> = Object.fromEntries(players.map((player, index) => [player.id, { objectiveId: selected[index]!, status: 'ACTIVE', progress: {}, rewardGranted: false }]));
    const targetOwners = players.filter((player) => targeted.has(states[player.id]!.objectiveId));
    function visitTarget(index: number): boolean {
      if (index === targetOwners.length) {
        // A Kingmaker cannot leave if their assigned Executioner must first kill them.
        return !players.some((player) => {
          const state = states[player.id]!;
          if (state.objectiveId !== 'kingmaker') return false;
          const target = states[state.targetPlayerId!]!;
          return target.objectiveId === 'executioner' && target.targetPlayerId === player.id;
        });
      }
      const player = targetOwners[index]!; const state = states[player.id]!;
      const candidates = players.filter((candidate) => candidate.id !== player.id && !((state.objectiveId === 'guardian' || state.objectiveId === 'kingmaker') && deathObjectives.has(states[candidate.id]!.objectiveId)));
      for (const candidate of random.shuffle(candidates)) {
        state.targetPlayerId = candidate.id;
        if (visitTarget(index + 1)) return true;
      }
      delete state.targetPlayerId;
      return false;
    }
    if (!visitTarget(0)) return false;
    result = states;
    return true;
  }
  function visit(index: number): boolean {
    if (index === players.length) return assignTargets();
    for (const objective of ordering[index]!) {
      if (selected.includes(objective.id)) continue;
      if (targeted.has(objective.id) && selected.filter((candidate) => targeted.has(candidate)).length >= (players.length === 4 ? 2 : 1)) continue;
      if (deathObjectives.has(objective.id) && selected.some((candidate) => deathObjectives.has(candidate))) continue;
      // No v13 role kit completes any objective outright; independence needs no invented exclusions.
      selected.push(objective.id);
      if (visit(index + 1)) return true;
      selected.pop();
    }
    return false;
  }
  requireRule(players.length >= 2 && players.length <= 4 && visit(0), 'INVALID_STATE', 'No compatible objective assignment exists.');
  return result!;
}

function possessions(player: PlayerState): string[] {
  return [...player.inventory.visible, ...player.inventory.pockets.map((pocket) => pocket.item)].flatMap((stack) => stack ? Array<string>(stack.quantity).fill(stack.itemId) : []);
}
const distinct = (values: string[]) => new Set(values).size;

/** Rebuild progress from authoritative history; callers cannot submit objective credit. */
export function objectiveCondition(room: RoomState, player: PlayerState, endOfRound = false): boolean {
  const state = player.objective!;
  const history = room.match!.history;
  const held = possessions(player);
  const own = player.id;
  const objectiveId = state.objectiveId;
  if (state.contingencyTargetId) {
    const death = history.deaths.find((entry) => entry.playerId === state.contingencyTargetId);
    state.progress = { contingencyTargetId: state.contingencyTargetId, killed: death?.killerId === own };
    if (death && death.killerId !== own) state.status = 'FAILED';
    if (playerById(room, state.contingencyTargetId).life === 'EXITED') state.status = 'FAILED';
    return death?.killerId === own;
  }
  switch (objectiveId) {
    case 'escapist': state.progress = { passageToken: held.includes('passage-token') }; return held.includes('passage-token');
    case 'collector': { const count = held.filter((item) => ITEM_BY_ID[item]?.rarity === 'ARTIFACT').length; state.progress = { artifacts: count, required: 2 }; return count >= 2; }
    case 'tycoon': state.progress = { coins: player.inventory.coins, required: 12 }; return player.inventory.coins >= 12;
    case 'arsenal': state.progress = Object.fromEntries(['pistol', 'bullet', 'knife', 'armor'].map((item) => [item, held.includes(item)])); return Object.values(state.progress).every(Boolean);
    case 'executioner':
    case 'guardian':
    case 'kingmaker': {
      const target = playerById(room, state.targetPlayerId!);
      const death = history.deaths.find((entry) => entry.playerId === target.id);
      state.progress = { targetLife: target.life, throughRound: Math.max(0, room.round!.number - (endOfRound ? 0 : 1)) };
      if (objectiveId === 'executioner' && death?.killerId === own) return true;
      if (death) {
        const killer = playerById(room, death.killerId);
        if (killer.id !== own && living(killer)) {
          state.contingency = true;
          state.contingencyTargetId = killer.id;
          return objectiveCondition(room, player, endOfRound);
        }
        state.status = 'FAILED';
        return false;
      }
      if (target.life === 'EXITED') {
        if (objectiveId !== 'executioner') return true;
        state.status = 'FAILED'; return false;
      }
      return objectiveId === 'guardian' && living(target) && (room.round!.number > 4 || (room.round!.number === 4 && endOfRound));
    }
    case 'martyr':
      if (history.deaths.length && history.deaths[0]!.playerId !== own) state.status = 'FAILED';
      return history.deaths[0]?.playerId === own;
    case 'phoenix': { const count = history.downs.filter((entry) => entry.targetId === own && entry.recovered).length; state.progress = { recoveredDownEvents: count, required: 2 }; return count >= 2; }
    case 'betrayer': {
      const betrayed = history.downs.filter((down) => down.actorId === own && history.trades.some((trade) => trade.sequence < down.sequence && ((trade.actorId === own && trade.targetId === down.targetId) || (trade.targetId === own && trade.actorId === down.targetId)))).map((down) => down.targetId);
      state.progress = { betrayedPlayerIds: [...new Set(betrayed)] }; return betrayed.length > 0;
    }
    case 'extortionist': { const targets = history.threats.filter((entry) => entry.actorId === own && entry.complied && entry.assetsReceived).map((entry) => entry.targetId); state.progress = { distinctTargets: distinct(targets), required: 2 }; return distinct(targets) >= 2; }
    case 'con-artist': {
      const threats = history.threats.filter((entry) => entry.actorId === own && entry.covered);
      const bluffCompliance = threats.some((entry) => entry.complied && !entry.validWeapon);
      const armedRefusal = threats.some((entry) => !entry.complied && entry.validWeapon);
      state.progress = { bluffCompliance, armedRefusal }; return bluffCompliance && armedRefusal;
    }
    case 'duelist': { const count = distinct(history.downs.filter((entry) => entry.actorId === own && entry.targetId !== own).map((entry) => entry.targetId)); state.progress = { distinctDowns: count, required: 2 }; return count >= 2; }
    case 'savior': { const count = distinct(history.revives.filter((entry) => entry.actorId === own && entry.targetId !== own).map((entry) => entry.targetId)); state.progress = { distinctRevives: count, required: 2 }; return count >= 2; }
    case 'graverobber': { const count = distinct(history.loots.filter((entry) => entry.actorId === own).map((entry) => entry.targetId)); state.progress = { distinctLoots: count, required: 2 }; return count >= 2; }
    case 'poisoner': { const count = distinct(history.poisonTicks.filter((entry) => entry.actorId === own && entry.targetId !== own).map((entry) => entry.targetId)); state.progress = { poisonedPlayers: count, required: 2 }; return count >= 2; }
    case 'chest-raider': { const opened = [...new Set(history.chests.filter((entry) => entry.actorId === own).map((entry) => entry.kind))]; state.progress = { opened }; return opened.length === 2; }
    case 'merchant': {
      const trades = history.trades.filter((entry) => entry.actorId === own || entry.targetId === own);
      const count = room.players.length === 2 ? new Set(trades.map((entry) => entry.round)).size : distinct(trades.map((entry) => entry.actorId === own ? entry.targetId : entry.actorId));
      state.progress = { completed: count, required: 2, differentRounds: room.players.length === 2 }; return count >= 2;
    }
    case 'hidden-hand': { const pickpocket = history.pickpockets.some((entry) => entry.actorId === own); const loot = history.loots.some((entry) => entry.actorId === own); state.progress = { pickpocket, loot }; return pickpocket && loot; }
    case 'survivor': { const count = room.players.filter((entry) => entry.id !== own && !living(entry)).length; const required = Math.min(2, room.players.length - 1); state.progress = { departedPlayers: count, required }; return living(player) && count >= required; }
    default: throw new Error(`Unknown objective ${objectiveId}`);
  }
}

export function evaluateObjectives(room: RoomState, now: number, endOfRound = false): void {
  for (const player of room.players) {
    const state = player.objective;
    if (!state || state.status === 'BANKED' || state.status === 'FAILED' || !living(player)) continue;
    const definition = OBJECTIVE_BY_ID[state.objectiveId]!;
    if (state.status === 'EXIT_READY' && definition.mode === 'LATCHED') continue;
    const condition = objectiveCondition(room, player, endOfRound);
    // Survivor's explicit 2P forced-end exception must work before the generic unlock round.
    const unlocked = room.round!.number >= definition.unlockRound || (state.objectiveId === 'survivor' && room.players.length === 2);
    if (condition && unlocked && (state as ObjectiveState).status !== 'FAILED') {
      if (state.status !== 'EXIT_READY') {
        state.status = 'EXIT_READY';
        // Losing a sustained requirement locks exit; restoring it retains the original wait.
        state.readyOnTurn ??= (player.turnsStarted ?? 0) + 1;
        state.firstReadyAt ??= now;
        if (!state.rewardGranted) {
          player.inventory.coins += state.contingency ? RULES.contingencyCoins : RULES.objectiveCoins;
          state.rewardGranted = true;
        }
        event(room, now, 'OBJECTIVE_READY', `${player.name} is ready to leave.`, player.id);
      }
    } else if (state.status === 'EXIT_READY' && definition.mode === 'SUSTAINED') {
      state.status = 'ACTIVE';
      event(room, now, 'OBJECTIVE_LOCKED', `${player.name} is no longer ready to leave.`, player.id);
    }
  }
}

export function bankObjective(room: RoomState, player: PlayerState, now: number, throughDeath = false): void {
  const state = player.objective!;
  state.status = 'BANKED'; state.revealed = true;
  state.firstReadyAt ??= now;
  player.bankedAt = now;
  room.match!.exits.push(player.id);
  room.match!.exits.sort((firstId, secondId) => {
    const first = playerById(room, firstId); const second = playerById(room, secondId);
    return first.bankedAt! - second.bankedAt! || first.objective!.firstReadyAt! - second.objective!.firstReadyAt! || first.seat - second.seat;
  });
  for (const [index, exitedId] of room.match!.exits.entries()) {
    const exited = playerById(room, exitedId);
    exited.exitOrder = index + 1;
    const base = RULES.scoreByPlayerCount[room.match!.playerCount]![index]!;
    exited.score = Math.round(base * (exited.objective!.contingency ? RULES.contingencyScoreMultiplier : 1));
  }
  player.life = throughDeath ? 'DEAD' : 'EXITED';
  delete player.downed;
  event(room, now, throughDeath ? 'DEATH_OBJECTIVE_BANKED' : 'EXIT', `${player.name} completed ${OBJECTIVE_BY_ID[state.objectiveId]!.name} and banked their exit.`, player.id);
}
