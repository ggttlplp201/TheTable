import { TASKS, TASK_REWARD, type TaskId } from '@the-table/content';
import { legalWeapon } from './combat.js';
import { event, living } from './internal.js';
import { heldItems } from './inventory.js';
import { SeededRandom } from './random.js';
import type { PlayerState, RoomState, RoundTask, RoundTasks } from './types.js';

const definition = (id: TaskId) => TASKS.find(task => task.id === id)!;
const interactionTask = (id: TaskId) => id !== 'open-chest' && id !== 'wildcard';
const opponents = (room: RoomState, actor: PlayerState) => room.players.filter(player => player.id !== actor.id && player.life === 'ACTIVE' && !player.conceded);
const has = (player: PlayerState, ...ids: string[]) => heldItems(player).some(item => ids.includes(item.itemId));
const attacks = (room: RoomState, actor: PlayerState, target: PlayerState) => heldItems(actor).some(item => legalWeapon(room, actor, target, item));
const canThreaten = (room: RoomState, actor: PlayerState, target: PlayerState) => actor.connection === 'CONNECTED' && target.connection === 'CONNECTED' && !actor.statuses?.some(status => status.kind === 'HANDCUFFED') && actor.inventory.visible.some(item => item && (legalWeapon(room, actor, target, item) || has(actor, 'cloth') && heldItems(actor).some(cloth => cloth.itemId === 'cloth' && cloth.instanceId !== item.instanceId)));

export function excludedTasks(room: RoomState, player: PlayerState): TaskId[] {
  if (player.objective?.status !== 'ACTIVE') return [];
  switch (player.objective?.objectiveId) {
    // DAMAGE has no specific target, so it cannot distinguish ordinary combat
    // from the attack the contract already requires.
    case 'executioner':
    case 'duelist': return ['damage'];
    case 'extortionist': return ['extort'];
    case 'savior': return ['revive'];
    case 'graverobber': return ['loot'];
    case 'chest-raider': return ['open-chest'];
    case 'hidden-hand': return ['pickpocket', 'loot'];
    case 'betrayer': return room.match!.history.trades.some(trade => {
      const partnerId = trade.actorId === player.id ? trade.targetId : trade.targetId === player.id ? trade.actorId : undefined;
      return room.players.some(partner => partner.id === partnerId && living(partner) && !partner.conceded);
    }) ? [] : ['trade'];
    // Con Artist's remaining compliant bluff step directly duplicates this job.
    // Calling someone else's bluff never duplicates its refused-real-weapon step.
    case 'con-artist': return room.match!.history.threats.some(threat => threat.actorId === player.id && threat.covered && threat.complied && !threat.validWeapon) ? [] : ['bluff'];
    default: return [];
  }
}
export function taskPlausible(room: RoomState, player: PlayerState, id: TaskId): boolean {
  const others = opponents(room, player);
  const downed = room.players.filter(other => other.id !== player.id && other.life === 'DOWNED');
  switch (id) {
    case 'trade': return others.some(other => other.connection === 'CONNECTED' && (player.inventory.visible.some(Boolean) || other.inventory.visible.some(Boolean) || player.inventory.coins + other.inventory.coins > 0));
    case 'damage': return others.some(other => attacks(room, player, other) && !has(other, 'armor'));
    case 'extort': return others.some(other => canThreaten(room, player, other) && (other.inventory.coins > 0 || other.inventory.visible.some(Boolean)));
    case 'heal': return has(player, 'medicine', 'stimulant') && others.some(other => other.hp < 5);
    case 'revive': return has(player, 'medicine') && downed.length > 0;
    case 'loot': return downed.some(other => other.inventory.visible.some(Boolean));
    case 'open-chest': return (room.chests ?? []).some(chest => chest.availability === 'AVAILABLE' && (chest.kind === 'BLACK' ? has(player, 'black-key') : has(player, 'key', 'lockpick', 'crowbar')));
    case 'inspect-pocket': return has(player, 'spyglass') && others.some(other => other.inventory.pockets.some(pocket => !pocket.protectedBySafe));
    case 'pickpocket': return has(player, 'pickpocket') && others.some(other => other.inventory.pockets.some(pocket => pocket.item && !pocket.protectedBySafe));
    case 'break-armor': return others.some(other => other.inventory.visible.some(item => item?.itemId === 'armor') && attacks(room, player, other));
    case 'call-bluff': return others.some(other => has(other, 'cloth') && canThreaten(room, other, player));
    case 'bluff': return has(player, 'cloth') && others.some(other => canThreaten(room, player, other) && player.inventory.visible.some(item => item && heldItems(player).some(cloth => cloth.itemId === 'cloth' && cloth.instanceId !== item.instanceId) && !legalWeapon(room, player, other, item)));
    case 'wildcard': return Boolean(room.round!.number >= 3 && room.wildcardUnlocked && room.wildcardDeck?.length && !room.wildcardDrawUsedByPlayer?.[player.id]);
    case 'receive-coins': return others.some(other => other.inventory.coins >= 2 && other.connection === 'CONNECTED');
  }
}
function prerequisites(room: RoomState, player: PlayerState, id: TaskId): string[] {
  if (id === 'open-chest') return (room.chests ?? []).filter(chest => chest.availability === 'AVAILABLE' && (chest.kind === 'BLACK' ? has(player, 'black-key') : has(player, 'key', 'lockpick', 'crowbar'))).map(chest => `chest:${chest.kind}`);
  if (id === 'revive' || id === 'loot') return room.players.filter(other => other.id !== player.id && other.life === 'DOWNED').map(other => `player:${other.id}`);
  if (id === 'break-armor') return opponents(room, player).flatMap(other => other.inventory.visible.filter(item => item?.itemId === 'armor').map(item => `item:${item!.instanceId}`));
  if (id === 'inspect-pocket' || id === 'pickpocket') return heldItems(player).filter(item => item.itemId === (id === 'inspect-pocket' ? 'spyglass' : 'pickpocket')).map(item => `item:${item.instanceId}`);
  return interactionTask(id) ? opponents(room, player).map(other => `player:${other.id}`) : [];
}
function job(room: RoomState, player: PlayerState, id: TaskId): RoundTask { return { id, status: 'ACTIVE', progress: 0, prerequisites: prerequisites(room, player, id) }; }
function choose(pool: TaskId[], random: SeededRandom): TaskId {
  let value = random.next() * pool.reduce((sum, id) => sum + definition(id).weight, 0);
  return pool.find(id => (value -= definition(id).weight) < 0) ?? pool[0]!;
}
export function eligibleTasks(room: RoomState, player: PlayerState): TaskId[] {
  const excluded = excludedTasks(room, player);
  return TASKS.map(task => task.id).filter(id => !excluded.includes(id) && taskPlausible(room, player, id));
}
export function assignTasks(room: RoomState, now: number): void {
  room.sideJobRoundId = room.round!.number;
  room.sideJobsByPlayer = {};
  // Independent random stream avoids perturbing item, chest, shop and Wildcard draws.
  const random = new SeededRandom(room.match!.seed ^ (room.round!.number * 0x5441534b));
  for (const player of room.players.filter(player => player.life === 'ACTIVE' && !player.conceded)) {
    const pool = eligibleTasks(room, player);
    // A depleted table can have fewer than two immediate opportunities. Keep
    // resource/negotiation goals rather than inventing unavailable items or Wildcards.
    for (const fallback of ['trade', 'receive-coins', 'damage'] as TaskId[]) if (pool.length < 2 && !pool.includes(fallback) && !excludedTasks(room, player).includes(fallback)) pool.push(fallback);
    const interactions = pool.filter(id => interactionTask(id) && taskPlausible(room, player, id));
    const first = choose(interactions.length ? interactions : pool, random);
    const remaining = pool.filter(id => id !== first);
    const diverse = remaining.filter(id => definition(id).category !== definition(first).category);
    const second = choose(diverse.length ? diverse : remaining, random);
    const tasks: RoundTasks = { round: room.round!.number, reward: TASK_REWARD, jobs: [job(room, player, first), job(room, player, second)], completed: false, replacementUsed: false, opportunityTaken: false };
    room.sideJobsByPlayer[player.id] = tasks;
    event(room, now, 'TASKS_ASSIGNED_PRIVATE', '', player.id, [], { [player.id]: { tasks: structuredClone(tasks), actionable: tasks.jobs.map(task => taskPlausible(room, player, task.id)) } });
  }
}
function permanentlyImpossible(room: RoomState, player: PlayerState, task: RoundTask): boolean {
  if (taskPlausible(room, player, task.id) || task.prerequisites.length === 0) return false;
  return task.prerequisites.every(key => {
    if (key.startsWith('chest:')) return room.chests?.find(chest => chest.kind === key.slice(6))?.availability === 'OPENED';
    if (key.startsWith('player:')) { const target = room.players.find(other => other.id === key.slice(7)); return !target || !living(target); }
    // Only destruction/removal, not a temporary transfer or Safe assignment.
    return !room.players.some(other => heldItems(other).some(item => item.instanceId === key.slice(5)));
  });
}
export function startTaskOpportunity(room: RoomState, player: PlayerState, now: number): void {
  const tasks = room.sideJobsByPlayer?.[player.id];
  if (!tasks || player.life !== 'ACTIVE' || tasks.round !== room.round!.number || tasks.opportunityTaken) return;
  if (!tasks.completed && !tasks.replacementUsed && tasks.jobs.every(task => permanentlyImpossible(room, player, task))) {
    const candidates = eligibleTasks(room, player).filter(id => !tasks.jobs.some(task => task.id === id));
    if (candidates.length) {
      const old = tasks.jobs[0]!;
      const next = job(room, player, choose(candidates, new SeededRandom(room.match!.seed ^ room.match!.turnSerial ^ 0x5245504c)));
      tasks.jobs[0] = next; tasks.replacementUsed = true;
      event(room, now, 'TASK_REPLACED', '', player.id, [], { [player.id]: { previous: old.id, task: structuredClone(next) } });
    }
  }
  tasks.opportunityTaken = true;
}
export function completeTask(room: RoomState, playerId: string | undefined, candidates: TaskId[], now: number): void {
  if (!playerId || room.status !== 'PLAYING' || room.round?.phase !== 'TURN') return;
  const player = room.players.find(player => player.id === playerId);
  const tasks = room.sideJobsByPlayer?.[playerId];
  if (!player || !living(player) || player.conceded || !tasks || tasks.round !== room.round.number || tasks.completed) return;
  const completed = tasks.jobs.find(task => task.status === 'ACTIVE' && candidates.includes(task.id));
  if (!completed) return;
  completed.status = 'COMPLETED'; completed.progress = 1; tasks.completed = true;
  player.inventory.coins += tasks.reward;
  event(room, now, 'TASK_COMPLETED', `${player.name.toUpperCase()} COMPLETED A TASK — +${tasks.reward} GOLD`, playerId, [], { [playerId]: { taskId: completed.id, reward: tasks.reward } }, { coinChanges: [{ playerId, amount: tasks.reward }] });
  for (const other of tasks.jobs.filter(task => task !== completed)) {
    other.status = 'CANCELLED';
    event(room, now, 'TASK_CANCELLED', '', playerId, [], { [playerId]: { taskId: other.id } });
  }
}
export function expireTasks(room: RoomState, now: number): void {
  for (const [playerId, tasks] of Object.entries(room.sideJobsByPlayer ?? {})) {
    const expired = tasks.jobs.filter(task => task.status === 'ACTIVE');
    if (!expired.length) continue;
    for (const task of expired) task.status = 'EXPIRED';
    event(room, now, 'TASKS_EXPIRED', '', playerId, [], { [playerId]: { round: tasks.round, taskIds: expired.map(task => task.id) } });
  }
}
/** Consume successful authoritative facts; failed commands never reach this hook. */
export function resolveTaskEvents(before: RoomState, room: RoomState, now: number): void {
  const lastSequence = before.events?.at(-1)?.sequence ?? 0;
  for (const fact of [...(room.events ?? [])].filter(entry => entry.sequence > lastSequence && entry.round === room.round?.number)) {
    const owner = fact.actorId; const target = fact.targetIds[0];
    const complete = (...ids: TaskId[]) => completeTask(room, owner, ids, now);
    switch (fact.kind) {
      case 'TRADE_ACCEPTED': {
        const trade = before.pendingTrade;
        if (!trade || !(trade.offeredItems.length || trade.requestedItems.length || trade.offeredCoins || trade.requestedCoins)) break;
        completeTask(room, trade.actorId, ['trade', ...(trade.requestedCoins >= 2 ? ['receive-coins' as const] : [])], now);
        completeTask(room, trade.targetId, ['trade', ...(trade.offeredCoins >= 2 ? ['receive-coins' as const] : [])], now);
        break;
      }
      case 'DAMAGE': if (owner !== target) complete('damage'); break;
      case 'ARMOR_BLOCKED': if (owner !== target) complete('break-armor'); break;
      case 'HEALED':
      case 'STIMULANT_USED':
        if (owner !== target && before.players.find(player => player.id === target)?.life === 'ACTIVE' && fact.presentation?.hpChanges?.some(change => change.playerId === target && change.amount > 0)) complete('heal');
        break;
      case 'REVIVED': if (owner !== target) complete('revive'); break;
      case 'LOOTED': complete('loot'); break;
      case 'CHEST_OPENED': complete('open-chest'); break;
      case 'POCKET_INSPECTED': {
        const payload = owner ? fact.privatePayloads?.[owner] as { item?: unknown; blocked?: boolean } | undefined : undefined;
        if (owner !== target && payload && 'item' in payload && !payload.blocked) complete('inspect-pocket');
        break;
      }
      case 'PICKPOCKET': if (room.match!.history.pickpockets.length > (before.match?.history.pickpockets.length ?? 0)) complete('pickpocket'); break;
      case 'THREAT_COMPLIED': {
        const threat = before.pendingThreat;
        if (!threat) break;
        const history = room.match!.history.threats.at(-1)!;
        complete(...(history.assetsReceived ? ['extort' as const] : []), ...(threat.demandedCoins >= 2 ? ['receive-coins' as const] : []), ...(history.covered && !history.validWeapon ? ['bluff' as const] : []));
        break;
      }
      case 'THREAT_REFUSED': {
        if (before.pendingThreat?.mode !== 'COVERED') break;
        const id = before.pendingThreat.targetId;
        if (!room.events!.some(entry => entry.sequence > lastSequence && entry.kind === 'DAMAGE' && entry.targetIds.includes(id))) completeTask(room, id, ['call-bluff'], now);
        break;
      }
      case 'WILDCARD_USED': complete('wildcard'); break;
    }
  }
}
