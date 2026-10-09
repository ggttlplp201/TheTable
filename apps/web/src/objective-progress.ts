import type { ObjectiveState, PublicRoomView } from '@the-table/game';

export interface ObjectiveProgressItem {
  label: string;
  value: string;
  complete: boolean;
}

const count = (value: unknown): number => typeof value === 'number' && Number.isFinite(value) ? value : 0;
const flag = (value: unknown): boolean => value === true;
const ids = (value: unknown): string[] => Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];
const required = (progress: Record<string, unknown>, fallback = 2) => count(progress.required) || fallback;
const playerName = (room: PublicRoomView, id: string) => room.players.find(player => player.id === id)?.name ?? 'Unknown player';
const playerNames = (room: PublicRoomView, value: unknown) => ids(value).map(id => playerName(room, id));
const namedList = (names: string[]) => names.length ? names.join(', ') : 'None yet';
const lifeText = (value: unknown, conceded = false) => {
  if (conceded) return 'conceded';
  if (value === 'EXITED') return 'successfully exited';
  if (value === 'DEAD') return 'permanently died';
  if (value === 'DOWNED') return 'is Downed';
  return 'is still at the table';
};

function distinctTargetProgress(
  objective: ObjectiveState,
  room: PublicRoomView,
  countKey: string,
  label: string,
  singular: string,
): ObjectiveProgressItem[] {
  const completed = count(objective.progress[countKey]);
  const target = required(objective.progress);
  const names = playerNames(room, objective.progress.qualifiedPlayerIds);
  return [
    { label, value: `${completed} / ${target}`, complete: completed >= target },
    { label: 'Qualified players', value: namedList(names), complete: names.length >= target },
    ...(completed < target ? [{ label: 'Still required', value: `${target - completed} different ${target - completed === 1 ? singular : 'players'}`, complete: false }] : []),
  ];
}

/** Converts only server-authoritative objective.progress into player-facing copy. */
export function objectiveProgressItems(objective: ObjectiveState, room: PublicRoomView): ObjectiveProgressItem[] {
  const progress = objective.progress;
  const target = objective.targetPlayerId ? playerName(room, objective.targetPlayerId) : 'Unknown player';
  const targetConceded = room.players.find(player => player.id === objective.targetPlayerId)?.conceded;
  if (objective.contingencyTargetId) {
    const name = playerName(room, objective.contingencyTargetId);
    return [{ label: 'Contingency target', value: `Personally kill ${name}`, complete: flag(progress.killed) }];
  }
  switch (objective.objectiveId) {
    case 'escapist':
      return [{ label: 'Passage Token', value: flag(progress.passageToken) ? 'In your possession' : 'Not in your possession', complete: flag(progress.passageToken) }];
    case 'collector': {
      const current = count(progress.artifacts); const targetCount = required(progress);
      return [{ label: 'Artifacts held', value: `${current} / ${targetCount}`, complete: current >= targetCount }];
    }
    case 'tycoon': {
      const current = count(progress.coins); const targetCount = count(progress.required) || 12;
      return [{ label: 'Coins held', value: `${current} / ${targetCount}`, complete: current >= targetCount }];
    }
    case 'arsenal':
      return ['pistol', 'bullet', 'knife', 'armor'].map(item => ({ label: item[0]!.toUpperCase() + item.slice(1), value: flag(progress[item]) ? 'Held' : 'Still needed', complete: flag(progress[item]) }));
    case 'executioner':
      return [{ label: 'Assigned target', value: target, complete: false }, { label: 'Target status', value: `${target} ${lifeText(progress.targetLife, targetConceded)}`, complete: objective.status === 'EXIT_READY' || objective.status === 'BANKED' }];
    case 'guardian': {
      const throughRound = count(progress.throughRound);
      return [{ label: 'Protected player', value: target, complete: false }, { label: 'Survival progress', value: progress.targetLife === 'EXITED' ? `${target} successfully exited` : `Through Round ${throughRound} / 4`, complete: progress.targetLife === 'EXITED' || throughRound >= 4 }];
    }
    case 'kingmaker':
      return [{ label: 'Supported player', value: target, complete: false }, { label: 'Exit status', value: `${target} ${lifeText(progress.targetLife, targetConceded)}`, complete: progress.targetLife === 'EXITED' }];
    case 'martyr': {
      const firstDeath = typeof progress.firstDeathPlayerId === 'string' ? playerName(room, progress.firstDeathPlayerId) : undefined;
      return [{ label: 'First permanent death', value: firstDeath ?? 'No permanent deaths yet', complete: firstDeath !== undefined && objective.status !== 'FAILED' }];
    }
    case 'phoenix': {
      const current = count(progress.recoveredDownEvents); const targetCount = required(progress);
      return [{ label: 'Downed recoveries', value: `${current} / ${targetCount}`, complete: current >= targetCount }];
    }
    case 'betrayer': {
      const traded = playerNames(room, progress.tradedPlayerIds);
      const eligible = playerNames(room, progress.eligibleTargetIds);
      const betrayed = playerNames(room, progress.betrayedPlayerIds);
      return [
        { label: 'Step 1 — Complete a Trade', value: traded.length ? `Traded with ${traded.join(', ')}` : 'No completed Trade yet', complete: traded.length > 0 },
        { label: 'Step 2 — Personally Down that player', value: betrayed.length ? `Downed ${betrayed.join(', ')}` : eligible.length ? `Down ${eligible.join(' or ')}` : 'Complete a Trade first', complete: betrayed.length > 0 },
        ...(eligible.length > 1 ? [{ label: 'Eligible targets', value: eligible.join(', '), complete: false }] : []),
      ];
    }
    case 'extortionist': return distinctTargetProgress(objective, room, 'distinctTargets', 'Successful Threat payments', 'player');
    case 'con-artist':
      return [
        { label: 'Harmless covered bluff', value: flag(progress.bluffCompliance) ? 'Target complied' : 'Compliance still required', complete: flag(progress.bluffCompliance) },
        { label: 'Covered real weapon', value: flag(progress.armedRefusal) ? 'Target refused' : 'Refusal still required', complete: flag(progress.armedRefusal) },
      ];
    case 'duelist': return distinctTargetProgress(objective, room, 'distinctDowns', 'Distinct players Downed', 'player');
    case 'savior': return distinctTargetProgress(objective, room, 'distinctRevives', 'Distinct players revived', 'player');
    case 'graverobber': return distinctTargetProgress(objective, room, 'distinctLoots', 'Distinct Downed players looted', 'player');
    case 'poisoner': return distinctTargetProgress(objective, room, 'poisonedPlayers', 'Distinct players damaged by Poison', 'player');
    case 'chest-raider': {
      const opened = new Set(ids(progress.opened));
      return [
        { label: 'Standard Chest', value: opened.has('STANDARD') ? 'Opened' : 'Still required', complete: opened.has('STANDARD') },
        { label: 'Black Chest', value: opened.has('BLACK') ? 'Opened' : 'Still required', complete: opened.has('BLACK') },
      ];
    }
    case 'merchant': return distinctTargetProgress(objective, room, 'completed', 'Distinct Trade partners', 'player');
    case 'hidden-hand':
      return [
        { label: 'Pickpocket', value: flag(progress.pickpocket) ? 'Item acquired' : 'Acquire an item', complete: flag(progress.pickpocket) },
        { label: 'Downed loot', value: flag(progress.loot) ? 'Item acquired' : 'Acquire an item', complete: flag(progress.loot) },
      ];
    case 'survivor': {
      const current = count(progress.departedPlayers); const targetCount = required(progress);
      return [{ label: 'Other players gone', value: `${current} / ${targetCount}`, complete: current >= targetCount }];
    }
    default:
      return [{ label: 'Progress', value: 'Awaiting an update from the table', complete: false }];
  }
}
