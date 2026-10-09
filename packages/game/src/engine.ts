import { STARTING_BONUS_POOL } from '@the-table/content';
import { ROLES, ITEM_BY_ID, RULES } from './content.js';
import { downedInteraction, initiateThreat, initiateTrade, primary, requireTurn, resolveThreat, resolveTrade, resumeTurn, shopAction, useItem } from './actions.js';
import { concedePlayer, expireRescueWindows, loot, startPoisonTicks } from './combat.js';
import { beginIntermission, refreshChests, withRandom } from './economy.js';
import { event, living, playerById, requireRule } from './internal.js';
import { disposeInventory, owned, removeItem, resolveOverflow, stack, syncEquipment } from './inventory.js';
import { assertRoomInvariants } from './invariants.js';
import { advanceIntermission, finishIntermissionPlayer } from './intermission.js';
import { assignCompatibleObjectives, bankObjective, evaluateObjectives, failObjective } from './objectives.js';
import { SeededRandom } from './random.js';
import { ROLE_IDS, type ConnectionState, type GameCommand, type PlayerState, type RoleId, type RoomState } from './types.js';

/** Desktop opening: 10.4s seated arrival followed by the 6s private contract. */
export const MATCH_OPENING_PRESENTATION_MS = 16_400;

function timestamp(room: RoomState, now: number): void {
  requireRule(Number.isFinite(now) && now >= room.updatedAt, 'INVALID_COMMAND', 'Command time must be finite and monotonic.');
}
function commit(room: RoomState, now: number): RoomState {
  room.updatedAt = now; room.revision += 1;
  assertRoomInvariants(room);
  return room;
}
function finishIfRequired(room: RoomState, now: number): boolean {
  evaluateObjectives(room, now);
  const livingPlayers = room.players.filter(living);
  // Hub resolves section 16's ambiguity: ready objectives participate in forced closure.
  const allResolved = room.players.every((player) => player.objective!.status !== 'ACTIVE');
  if (livingPlayers.length > 1 && !allResolved) return false;
  while (true) {
    evaluateObjectives(room, now);
    const ready = room.players.filter((player) => living(player) && player.objective!.status === 'EXIT_READY').sort((a, b) => a.objective!.firstReadyAt! - b.objective!.firstReadyAt! || a.seat - b.seat);
    if (!ready.length) break;
    const next = ready[0]!;
    bankObjective(room, next, now); disposeInventory(room, next);
  }
  for (const player of room.players) if (player.objective!.status !== 'BANKED') { failObjective(room, player, 'The match ended before this objective could be banked.', now); player.score = 0; }
  // A match-end result cannot retain a live command or timer.
  room.status = 'RESULTS'; room.round!.phase = 'RESULTS'; room.round!.seatsOwedTurn = [];
  delete room.turn; delete room.pendingTrade; delete room.pendingThreat;
  for (const pending of room.overflows ?? []) resolveOverflow(room, pending.id, now);
  room.overflows = [];
  event(room, now, 'MATCH_ENDED', 'The match has ended.');
  return true;
}
function beginRound(room: RoomState, now: number): void {
  room.round!.number += 1; room.round!.phase = 'TURN';
  room.round!.seatsOwedTurn = [...room.match!.fixedSeats];
  delete room.shop;
  refreshChests(room, now); evaluateObjectives(room, now);
  nextTurn(room, now);
}
function nextTurn(room: RoomState, now: number): void {
  delete room.turn;
  while (room.round!.seatsOwedTurn.length) {
    const seat = room.round!.seatsOwedTurn.shift()!;
    expireRescueWindows(room, seat, now);
    if (finishIfRequired(room, now)) return;
    const player = room.players.find((candidate) => candidate.seat === seat)!;
    if (!living(player)) continue;
    player.turnsStarted = (player.turnsStarted ?? 0) + 1;
    const serial = ++room.match!.turnSerial;
    room.turn = { activeSeat: seat, serial, startedAt: now, deadlineAt: now + RULES.turnMs, primaryUsed: false, downedInteractionUsed: false, exitDeclined: false, startedDowned: player.life === 'DOWNED' };
    event(room, now, 'TURN_STARTED', `${player.name}'s turn begins.`, player.id);
    startPoisonTicks(room, player, now);
    if (player.life === 'DOWNED') room.turn.startedDowned = true;
    evaluateObjectives(room, now);
    finishIfRequired(room, now);
    return;
  }
  evaluateObjectives(room, now, true);
  if (finishIfRequired(room, now)) return;
  beginIntermission(room, now);
  advanceDisconnectedShoppers(room, now);
}
/** All phase progression is authoritative; private decisions never block the public queue. */
function advanceDisconnectedShoppers(room: RoomState, now: number): void {
  if (advanceIntermission(room, now)) beginRound(room, now);
}
function endTurn(room: RoomState, now: number): void {
  const active = room.players.find((player) => player.seat === room.turn!.activeSeat)!;
  active.statuses = (active.statuses ?? []).filter((status) => status.kind !== 'HANDCUFFED' || status.appliedTurn >= room.turn!.serial);
  event(room, now, 'TURN_ENDED', `${active.name}'s turn ended.`, active.id);
  nextTurn(room, now);
}
export function startMatch(input: RoomState, options: { seed: number; now: number }): RoomState {
  timestamp(input, options.now);
  requireRule(input.status === 'LOBBY', 'WRONG_PHASE', 'A match can only start in the lobby.');
  requireRule(input.players.length >= RULES.minimumPlayers && input.players.length <= RULES.maximumPlayers, 'NOT_ELIGIBLE', 'A match needs three or four connected players.');
  requireRule(input.players.every((player) => player.ready && player.roleId && player.connection === 'CONNECTED'), 'NOT_ELIGIBLE', 'Every player must be connected, have a Role, and be ready.');
  requireRule(new Set(input.players.map((player) => player.roleId)).size === input.players.length, 'INVALID_STATE', 'Roles must be unique.');
  const room = structuredClone(input);
  const random = new SeededRandom(options.seed);
  const players = [...room.players].sort((a, b) => a.seat - b.seat);
  const objectives = assignCompatibleObjectives(players, random);
  room.matchSerial = (input.matchSerial ?? 0) + 1;
  room.status = 'PLAYING'; room.events = []; room.overflows = [];
  room.match = {
    seed: options.seed, rngState: random.state, nextId: 1, turnSerial: 0, playerCount: players.length,
    fixedSeats: players.map((player) => player.seat), artifactPool: Object.values(ITEM_BY_ID).filter((item) => item.rarity === 'ARTIFACT').map((item) => item.id),
    passageTokenAvailable: true, blackKeyObtainable: false, exits: [],
    history: { trades: [], downs: [], revives: [], loots: [], poisonTicks: [], threats: [], pickpockets: [], chests: [], deaths: [] },
  };
  for (const player of players) {
    const role = ROLES[player.roleId!];
    player.hp = RULES.maxHp; player.life = 'ACTIVE'; player.score = 0; player.statuses = []; player.turnsStarted = 0;
    player.abilities = { quickDrawUsed: false }; player.safeAssignments = {};
    delete player.downed; delete player.exitOrder; delete player.bankedAt; delete player.conceded;
    player.inventory = { visible: Array<null>(RULES.visibleSlots).fill(null), pockets: [{ item: null, protectedBySafe: false, source: 'DEFAULT' }], coins: role.startingCoins };
    for (const [index, itemId] of role.startingItems.entries()) player.inventory.visible[index] = stack(room, itemId);
    syncEquipment(room, player, options.now);
    player.objective = objectives[player.id]!;
  }
  room.round = { number: 0, phase: 'SETUP', seatsOwedTurn: [] };
  const bonusPlayer = withRandom(room, random => random.pick(players));
  const bonusItem = stack(room, withRandom(room, random => random.pick(STARTING_BONUS_POOL)));
  bonusPlayer.inventory.visible[ROLES[bonusPlayer.roleId!].startingItems.length] = bonusItem;
  room.setup = { deadlineAt: options.now + RULES.setupMs, lockedPlayerIds: [], bonusPlayerId: bonusPlayer.id, bonusItemInstanceId: bonusItem.instanceId };
  room.chests = [{ kind: 'STANDARD', availability: 'HIDDEN', loot: [] }, { kind: 'BLACK', availability: 'HIDDEN', loot: [] }];
  delete room.turn; delete room.shop; delete room.pendingTrade; delete room.pendingThreat;
  event(room, options.now, 'SETUP_STARTED', 'Choose your starting Pocket item privately.');
  return commit(room, options.now);
}
function lockSetupItem(room: RoomState, actor: PlayerState, instanceId: string): void {
  requireRule(room.setup && room.round?.phase === 'SETUP', 'WRONG_PHASE', 'Starting Pocket choices are only available during setup.');
  requireRule(!room.setup.lockedPlayerIds.includes(actor.id), 'LOCKED', 'Your starting Pocket choice is already locked. Wait for the other players.');
  const item = owned(actor, instanceId, true);
  requireRule(ITEM_BY_ID[item.itemId]!.pocketEligible, 'NOT_ELIGIBLE', `${ITEM_BY_ID[item.itemId]!.name} must remain visible and cannot go into a Pocket.`);
  const pocket = actor.inventory.pockets.find(pocket => pocket.source === 'DEFAULT')!;
  requireRule(!pocket.item, 'LOCKED', 'Your starting Pocket is already filled.');
  pocket.item = removeItem(actor, instanceId);
  room.setup.lockedPlayerIds.push(actor.id);
}
function revealStartingInventories(room: RoomState, now: number): void {
  delete room.setup;
  room.round = { number: 1, phase: 'TURN', seatsOwedTurn: [...room.match!.fixedSeats] };
  event(room, now, 'MATCH_STARTED', 'Starting inventories are revealed. Round 1 begins.');
  refreshChests(room, now);
  nextTurn(room, now);
  room.turn!.deadlineAt += MATCH_OPENING_PRESENTATION_MS;
}
export function resetMatch(input: RoomState, now: number): RoomState {
  timestamp(input, now);
  requireRule(input.status === 'RESULTS', 'WRONG_PHASE', 'Rematch is only available after results.');
  const room = structuredClone(input);
  room.status = 'LOBBY';
  delete room.setup; delete room.match; delete room.turn; delete room.round; delete room.shop; delete room.chests; delete room.events; delete room.overflows; delete room.pendingTrade; delete room.pendingThreat;
  for (const player of room.players) {
    player.ready = false; player.life = 'ACTIVE'; player.hp = RULES.maxHp; player.score = 0;
    player.inventory = { visible: Array<null>(RULES.visibleSlots).fill(null), pockets: [{ item: null, protectedBySafe: false, source: 'DEFAULT' }], coins: 0 };
    delete player.objective; delete player.downed; delete player.statuses; delete player.turnsStarted; delete player.abilities; delete player.exitOrder; delete player.bankedAt; delete player.safeAssignments; delete player.conceded;
  }
  return commit(room, now);
}
export function applyCommand(input: RoomState, actorId: string, command: GameCommand, now: number): RoomState {
  timestamp(input, now);
  requireRule(command && typeof command.type === 'string', 'INVALID_COMMAND', 'A typed command is required.');
  const initialActor = playerById(input, actorId);
  requireRule(initialActor.connection === 'CONNECTED', 'NOT_ELIGIBLE', 'Reconnect before sending gameplay commands.');
  if (command.type === 'START_MATCH' || command.type === 'REMATCH') {
    requireRule(actorId === input.hostPlayerId, 'NOT_HOST', 'Only the host can start or rematch.');
    return command.type === 'START_MATCH' ? startMatch(input, { seed: command.seed, now }) : resetMatch(input, now);
  }
  const room = structuredClone(input); const actor = playerById(room, actorId);
  if (command.type === 'READY' || command.type === 'SET_READY' || command.type === 'CLAIM_ROLE') {
    requireRule(room.status === 'LOBBY', 'WRONG_PHASE', 'Lobby settings cannot change during a match.');
    if (command.type === 'CLAIM_ROLE') {
      requireRule(ROLE_IDS.includes(command.roleId as RoleId), 'ROLE_UNKNOWN', 'Unknown Role.');
      requireRule(!room.players.some((player) => player.id !== actorId && player.roleId === command.roleId), 'ROLE_TAKEN', 'Role is already claimed.');
      actor.roleId = command.roleId as RoleId; actor.ready = false;
    } else { requireRule(typeof command.ready === 'boolean' && actor.roleId, 'NOT_ELIGIBLE', 'Claim a Role before becoming ready.'); actor.ready = command.ready; }
    return commit(room, now);
  }
  requireRule(room.status === 'PLAYING' && living(actor), 'NOT_ELIGIBLE', 'Only living match players can act.');
  const deadline = getNextDeadline(room);
  requireRule(deadline === undefined || now < deadline, 'DEADLINE_EXPIRED', 'The authoritative deadline has expired.');
  if (room.round?.phase === 'SETUP') {
    requireRule(command.type === 'LOCK_SETUP', 'WRONG_PHASE', 'Lock your starting Pocket choice and wait for everyone before taking game actions.');
    lockSetupItem(room, actor, command.instanceId);
    if (room.setup!.lockedPlayerIds.length === room.players.length) revealStartingInventories(room, now);
    return commit(room, now);
  }
  if (command.type === 'OVERFLOW_CHOICE') {
    const pending = room.overflows?.find((entry) => entry.id === command.overflowId && entry.playerId === actor.id);
    requireRule(pending, 'NOT_FOUND', 'This overflow decision is not yours.');
    resolveOverflow(room, pending.id, now, command.replaceInstanceId); resumeTurn(room, now); advanceDisconnectedShoppers(room, now);
  } else if (command.type === 'RESPOND_TRADE') {
    requireRule(room.pendingTrade?.targetId === actorId && typeof command.accept === 'boolean', 'NOT_ELIGIBLE', 'This Trade response is not yours.');
    resolveTrade(room, command.accept, now);
  } else if (command.type === 'RESPOND_THREAT') {
    requireRule(room.pendingThreat?.targetId === actorId && typeof command.comply === 'boolean', 'NOT_ELIGIBLE', 'This Threat response is not yours.');
    resolveThreat(room, command.comply, now);
  } else {
    const blockingOverflow = room.round?.phase === 'INTERMISSION' ? room.overflows?.some(choice => choice.playerId === actorId) : room.overflows?.length;
    requireRule(!room.pendingTrade && !room.pendingThreat && !blockingOverflow, 'LOCKED', 'Resolve the pending interaction first.');
    switch (command.type) {
      case 'END_TURN': requireTurn(room, actor); endTurn(room, now); break;
      case 'CONCEDE':
        requireTurn(room, actor);
        requireRule(actor.life === 'ACTIVE' && !room.turn!.startedDowned && actor.objective?.status === 'FAILED', 'NOT_ELIGIBLE', 'Concede is available for a failed objective on your own normal turn.');
        concedePlayer(room, actor, now);
        if (!finishIfRequired(room, now)) endTurn(room, now);
        break;
      case 'STAY': requireTurn(room, actor); requireRule(canLeave(room, actor), 'NOT_ELIGIBLE', leaveFailure(room, actor) ?? ''); room.turn!.exitDeclined = true; break;
      case 'LEAVE_TABLE':
        requireTurn(room, actor); evaluateObjectives(room, now);
        requireRule(canLeave(room, actor), 'NOT_ELIGIBLE', leaveFailure(room, actor) ?? '');
        bankObjective(room, actor, now); disposeInventory(room, actor);
        if (!finishIfRequired(room, now)) endTurn(room, now);
        break;
      case 'USE_ITEM': useItem(room, actor, command, now); if (room.turn?.startedDowned && actor.life === 'ACTIVE') endTurn(room, now); break;
      case 'TRADE': initiateTrade(room, actor, command, now); break;
      case 'THREAT': initiateThreat(room, actor, command, now); break;
      case 'DOWNED_INTERACTION': downedInteraction(room, actor, command, now); break;
      case 'LOOT_DOWNED': {
        const opportunity = room.turn?.immediateLoot;
        requireRule(opportunity?.playerId === actorId && opportunity.targetId === command.targetId, 'NOT_ELIGIBLE', 'No immediate attacker loot is available.');
        loot(room, actor, playerById(room, command.targetId), command.instanceId, now); delete room.turn!.immediateLoot; break;
      }
      case 'FINISH_SHOPPING':
        finishIntermissionPlayer(room, actor.id, now);
        advanceDisconnectedShoppers(room, now);
        break;
      case 'SKIP_PUBLIC_SHOP': case 'SELL': case 'BUY': case 'POCKET': case 'ASSIGN_SAFE': case 'REROLL_MARKET':
        shopAction(room, actor, command, now); advanceDisconnectedShoppers(room, now); break;
      case 'INSPECT_CHEST': {
        requireRule(actor.life === 'ACTIVE', 'NOT_ELIGIBLE', 'You cannot inspect a chest while Downed.');
        requireRule(actor.roleId === 'locksmith', 'NOT_ELIGIBLE', 'Only the Locksmith can use Tumbler Sense.');
        requireRule(actor.abilities!.locksmithRound !== room.round!.number, 'NOT_ELIGIBLE', 'You already used Tumbler Sense this round.');
        const chest = room.chests!.find((entry) => entry.kind === 'STANDARD')!;
        requireRule(chest.availability === 'AVAILABLE', 'NOT_ELIGIBLE', 'Standard Chest is unavailable.');
        actor.abilities!.locksmithRound = room.round!.number;
        event(room, now, 'CHEST_INSPECTED', `${actor.name} inspected Standard Chest.`, actor.id, [], { [actorId]: {
          artifact: chest.loot.some((entry) => entry.kind === 'ITEM' && ITEM_BY_ID[entry.stack.itemId]!.rarity === 'ARTIFACT'),
          rare: chest.loot.some((entry) => entry.kind === 'ITEM' && ITEM_BY_ID[entry.stack.itemId]!.rarity === 'RARE'),
        } }); break;
      }
      default: requireRule(false, 'INVALID_COMMAND', 'Unknown game command.');
    }
  }
  if (room.status === 'PLAYING') { evaluateObjectives(room, now); finishIfRequired(room, now); }
  return commit(room, now);
}
function leaveFailure(room: RoomState, player: PlayerState): string | undefined {
  if (room.status !== 'PLAYING' || room.round?.phase !== 'TURN') return 'You can leave only during a normal turn.';
  if (room.turn?.activeSeat !== player.seat) return 'Wait for your turn to leave the table.';
  if (player.life !== 'ACTIVE' || room.turn.startedDowned) return 'You must be active at the start of your turn to leave.';
  if (room.turn.exitDeclined) return 'You chose to stay or took an action. You can leave on your next normal turn.';
  if (room.turn.primaryUsed) return 'You already used your Primary Action. You can leave on your next normal turn.';
  if (player.objective?.status !== 'EXIT_READY') return 'Complete your private objective before leaving the table.';
  if ((player.turnsStarted ?? 0) < (player.objective.readyOnTurn ?? Infinity)) return 'Your objective is complete. Wait until your next normal turn to leave.';
  return undefined;
}
export function canLeave(room: RoomState, player: PlayerState): boolean {
  return leaveFailure(room, player) === undefined;
}
export function getNextDeadline(room: RoomState): number | undefined {
  if (room.status !== 'PLAYING') return undefined;
  if (room.setup) return room.setup.deadlineAt;
  const deadlines = (room.overflows ?? []).map((entry) => entry.deadlineAt);
  if (room.pendingTrade) deadlines.push(room.pendingTrade.deadlineAt);
  if (room.pendingThreat) deadlines.push(room.pendingThreat.deadlineAt);
  if (room.round?.phase === 'INTERMISSION' && room.shop) {
    const deadline = room.shop.phase === 'PREP' ? room.shop.prepDeadlineAt : room.shop.phase === 'PUBLIC' ? room.shop.publicDeadlineAt : room.shop.privateDeadlineAt;
    if (deadline !== undefined) deadlines.push(deadline);
  }
  if (room.turn && room.turn.pausedRemainingMs === undefined) deadlines.push(room.turn.deadlineAt);
  return deadlines.length ? Math.min(...deadlines) : undefined;
}
export function applyTimeout(input: RoomState, now: number): RoomState {
  timestamp(input, now);
  const deadline = getNextDeadline(input);
  if (deadline === undefined || now < deadline) return input;
  const room = structuredClone(input);
  if (room.setup) {
    for (const player of room.players) {
      if (room.setup.lockedPlayerIds.includes(player.id)) continue;
      const item = player.inventory.visible.find(item => item && ITEM_BY_ID[item.itemId]!.pocketEligible)!;
      lockSetupItem(room, player, item.instanceId);
    }
    revealStartingInventories(room, now);
    return commit(room, now);
  }
  // Process at the authoritative deadline, not scheduler latency; newly opened turns begin at now.
  for (const choice of [...(room.overflows ?? [])]) if (choice.deadlineAt <= now) resolveOverflow(room, choice.id, now);
  if (room.pendingTrade && room.pendingTrade.deadlineAt <= now) resolveTrade(room, false, now, playerById(room, room.pendingTrade.targetId).connection === 'DISCONNECTED', true);
  if (room.pendingThreat && room.pendingThreat.deadlineAt <= now) resolveThreat(room, true, now, playerById(room, room.pendingThreat.targetId).connection === 'DISCONNECTED', true);
  resumeTurn(room, now);
  advanceDisconnectedShoppers(room, now);
  if (room.turn && room.turn.pausedRemainingMs === undefined && room.turn.deadlineAt <= now) endTurn(room, now);
  if (room.status === 'PLAYING') { evaluateObjectives(room, now); finishIfRequired(room, now); }
  return commit(room, now);
}
export function setConnection(input: RoomState, playerId: string, connection: ConnectionState, now: number): RoomState {
  timestamp(input, now);
  requireRule(connection === 'CONNECTED' || connection === 'DISCONNECTED', 'INVALID_COMMAND', 'Unknown connection state.');
  const room = structuredClone(input); playerById(room, playerId).connection = connection;
  if (connection === 'DISCONNECTED') {
    if (room.pendingTrade?.targetId === playerId) resolveTrade(room, false, now, true);
    if (room.pendingThreat?.targetId === playerId) resolveThreat(room, false, now, true);
  }
  advanceDisconnectedShoppers(room, now);
  if (room.status === 'PLAYING') finishIfRequired(room, now);
  return commit(room, now);
}
/** Convenience transport-independent envelope adapter. */
export function transition(room: RoomState, command: GameCommand & { actorId: string }, now: number): RoomState {
  return applyCommand(room, command.actorId, command, now);
}
