import type { RoundTask } from '@the-table/game';
type TaskId = RoundTask['id'];
import { taskPlausible, ITEM_BY_ID, RoomStore, type PlayerState, type RoomState } from '@the-table/game';
import { RoomStoreAdapter, type Deadline } from './game-adapter.js';
import type { GameCommand } from './protocol.js';

export interface PlayerTelemetry {
  playerId: string;
  role: string | null;
  seat: number;
  objective: string | null;
  exitPlacement: number | null;
  score: number;
  coinsEarned: number;
  coinsSpent: number;
  roundIncomeReceived: number;
  intermissionCoins: Array<{ round: number; coins: number; affordableItems: number; afterCoins?: number }>;
  intermissionsWithNoAffordableItems: number;
  coinsUnspentAtMatchEnd: number | null;
  objectiveCompletedRound: number | null;
  objectiveFailedRound: number | null;
  objectiveFailureReason: string | null;
  conceded: boolean;
  publicPurchases: number;
  blackMarketPurchases: number;
  itemsSold: number;
  chestOpenings: number;
  damageByItem: Record<string, number>;
  downs: number;
  revives: number;
  deaths: number;
  medicineUses: number;
  armorUses: number;
  pocketItemUses: number;
  turnsWithNoGameplayAction: number;
  intermissionIdleMs: number;
  readinessToExitMs: number | null;
  threats: { open: number; covered: number; manualComplied: number; manualRefused: number; timeoutComplied: number; cancelled: number };
}
export interface WildcardTelemetry {
  playerId: string;
  cardId: string;
  round: number;
  drawnAt: number;
  usedAt?: number;
  burnedAt?: number;
  resolvedAt?: number;
  outcome?: string;
  targetIds: string[];
  itemsTransferred: number;
  itemsDestroyed: number;
  itemsGranted: number;
  coinsTransferred: number;
  coinsGained: number;
  hpHealed: number;
  objectiveReadinessChanged: string[];
  precededDown: boolean;
  precededExit: boolean;
}
export interface TaskTelemetry { playerId: string; taskId: TaskId; round: number; assignedAt: number; actionable: boolean; replacedAt?: number; completedAt?: number; reward: number }
export interface StimulantTelemetry {
  publicOffers: number;
  privateOffers: number;
  purchases: number;
  uses: number;
  normalHpRestored: number;
  temporaryHpGenerated: number;
  temporaryHpAbsorbed: number;
}
export interface MatchTelemetry {
  pacingPatch: 'compact-tasks-tutorial-v2';
  averageDecisionMs: number;
  passTurnCount: number;
  normalTurnTimeoutCount: number;
  meaningfulActionRate: number;
  failedCommandCount: number;
  matchDurationMs: number;
  roundDurations: Array<{ round: number; startedAt: number; durationMs: number }>;
  decisions: Array<{ playerId: string; round: number; elapsedMs: number; passed: boolean; timedOut: boolean; meaningful: boolean; normalTurn: boolean }>;

  tasks: TaskTelemetry[];
  taskCompletionByType: Partial<Record<TaskId, { assigned: number; completed: number; rate: number }>>;
  stimulant: StimulantTelemetry;
  medicinePurchases: number;
  schemaVersion: 'v14';
  rulesPatch: 'round-income-wildcards';
  roomId: string;
  roomCode: string;
  matchSerial: number;
  status: RoomState['status'];
  round: number;
  phase: string;
  players: PlayerTelemetry[];
  trades: { proposed: number; manualAccepted: number; manualDeclined: number; timeoutDeclined: number; cancelled: number };
  threats: { open: number; covered: number; manualComplied: number; manualRefused: number; timeoutComplied: number; cancelled: number };
  chestOpeningsBySeat: Record<string, number>;
  intermissionDurationMs: number;
  /** Idle means time after finishing shopping until the next round starts. */
  idleDefinition: 'finished-shopping-until-next-round';
  coinsDefinition: 'observed-balance-deltas-excluding-departure-cleanup';
  coinsCoverage: string;
  wildcardDraws: number;
  wildcardUses: number;
  wildcardBurns: number;
  wildcards: WildcardTelemetry[];
  wildcardEffectDefinition: 'stack-counts-and-gross-coin-effects';
  wildcardPrecedenceDefinition: 'same-or-next-gameplay-resolution-not-causation';
}
interface RecordedMatch {
  report: MatchTelemetry;
  revision: number;
  activeTurn?: { playerId: string; meaningful: boolean; normalTurn: boolean; committedAt?: number; startedAt: number; round: number };
  intermission?: { startedAt: number; finishedAt: Map<string, number> };
  precedingWildcard?: WildcardTelemetry;
}
const usedItemEvents = new Set(['WEAPON_USED', 'HEALED', 'STIMULANT_USED', 'REVIVED', 'POISON_APPLIED', 'POISON_CURED', 'HANDCUFFED', 'POCKET_INSPECTED', 'PICKPOCKET', 'THREAT_OFFERED', 'CHEST_OPENED']);
const gameplayEvents = new Set([...usedItemEvents, 'TRADE_OFFERED', 'LOOTED', 'EXIT', 'PLAYER_CONCEDED', 'WILDCARD_DRAWN_PRIVATE', 'WILDCARD_USED', 'WILDCARD_BURNED', 'WILDCARD_RESOLVED']);
const completedGameplayEvents = new Set(['WEAPON_USED', 'HEALED', 'STIMULANT_USED', 'REVIVED', 'POISON_APPLIED', 'POISON_CURED', 'POISON_DAMAGE', 'HANDCUFFED', 'POCKET_INSPECTED', 'PICKPOCKET', 'CHEST_OPENED', 'TRADE_ACCEPTED', 'TRADE_DECLINED', 'TRADE_EXPIRED_DECLINED', 'THREAT_COMPLIED', 'THREAT_REFUSED', 'LOOTED', 'EXIT', 'PLAYER_CONCEDED']);
function possessions(player: PlayerState): Map<string, number> {
  return new Map([...player.inventory.visible, ...player.inventory.pockets.map(pocket => pocket.item)].flatMap(item => item ? [[item.instanceId, item.quantity] as const] : []));
}

/** Server-local analysis only. Reports contain private objectives and must never enter a player projection. */
export class MatchTelemetryRecorder {
  private readonly matches = new Map<string, RecordedMatch>();
  constructor(private readonly maximumReports = 100) {
    if (!Number.isSafeInteger(maximumReports) || maximumReports < 1) throw new RangeError('Telemetry retention must be a positive integer.');
  }

  capture(before: RoomState, after: RoomState, command?: { actorId: string; command: GameCommand }): void {
    if (!after.match) return;
    const key = `${after.id}:${after.matchSerial ?? 0}`;
    let record = this.matches.get(key);
    if (!record) {
      record = { revision: -1, report: {
        pacingPatch: 'compact-tasks-tutorial-v2', averageDecisionMs: 0, passTurnCount: 0, normalTurnTimeoutCount: 0, meaningfulActionRate: 0, failedCommandCount: 0, matchDurationMs: 0, roundDurations: [], decisions: [], tasks: [], taskCompletionByType: {}, schemaVersion: 'v14', rulesPatch: 'round-income-wildcards', roomId: after.id, roomCode: after.code, matchSerial: after.matchSerial ?? 0,
        stimulant: { publicOffers: 0, privateOffers: 0, purchases: 0, uses: 0, normalHpRestored: 0, temporaryHpGenerated: 0, temporaryHpAbsorbed: 0 }, medicinePurchases: 0,
        status: after.status, round: after.round?.number ?? 0, phase: after.round?.phase ?? after.status,
        players: after.players.map(player => ({
          playerId: player.id, role: player.roleId ?? null, seat: player.seat, objective: player.objective?.objectiveId ?? null,
          exitPlacement: null, score: 0, coinsEarned: 0, coinsSpent: 0, objectiveCompletedRound: null, objectiveFailedRound: null, objectiveFailureReason: null,
          roundIncomeReceived: 0, intermissionCoins: [], intermissionsWithNoAffordableItems: 0, coinsUnspentAtMatchEnd: null,
          conceded: false, publicPurchases: 0, blackMarketPurchases: 0, itemsSold: 0, chestOpenings: 0, damageByItem: {},
          downs: 0, revives: 0, deaths: 0, medicineUses: 0, armorUses: 0, pocketItemUses: 0,
          turnsWithNoGameplayAction: 0, intermissionIdleMs: 0, readinessToExitMs: null,
          threats: { open: 0, covered: 0, manualComplied: 0, manualRefused: 0, timeoutComplied: 0, cancelled: 0 },
        })),
        trades: { proposed: 0, manualAccepted: 0, manualDeclined: 0, timeoutDeclined: 0, cancelled: 0 },
        threats: { open: 0, covered: 0, manualComplied: 0, manualRefused: 0, timeoutComplied: 0, cancelled: 0 },
        chestOpeningsBySeat: {}, intermissionDurationMs: 0, idleDefinition: 'finished-shopping-until-next-round',
        coinsDefinition: 'observed-balance-deltas-excluding-departure-cleanup',
        coinsCoverage: 'Starting kits and departure cleanup are excluded. Netted transfers and simultaneous rewards are not gross flows; earnings hidden by departure cleanup are unavailable.',
        wildcardDraws: 0, wildcardUses: 0, wildcardBurns: 0, wildcards: [],
        wildcardEffectDefinition: 'stack-counts-and-gross-coin-effects', wildcardPrecedenceDefinition: 'same-or-next-gameplay-resolution-not-causation',
      } };
      this.matches.set(key, record);
      while (this.matches.size > this.maximumReports) this.matches.delete(this.matches.keys().next().value!);
    }
    if (after.revision <= record.revision) return;
    const report = record.report;
    report.status = after.status; report.round = after.round?.number ?? 0; report.phase = after.round?.phase ?? after.status;
    const players = new Map(report.players.map(player => [player.playerId, player]));
    const previousEvents = new Set(before.matchSerial === after.matchSerial ? before.events?.map(event => event.id) : []);
    const events = (after.events ?? []).filter(event => !previousEvents.has(event.id));
    const hp = new Map(before.players.map(player => [player.id, player.hp]));
    const weapons = new Map<string, string>();
    const itemUsers = new Set<string>();
    const departureCoins = new Map<string, number>();
    const precedingWildcard = record.precedingWildcard;
    for (const event of events) {
      const owner = event.actorId ? players.get(event.actorId) : undefined;
      const targetId = event.targetIds[0];
      const target = targetId ? players.get(targetId) : undefined;
      const departingId = event.kind === 'DEATH' ? targetId : event.kind === 'EXIT' || event.kind === 'PLAYER_CONCEDED' ? event.actorId : undefined;
      if (departingId && event.presentation?.departureCoins !== undefined) departureCoins.set(departingId, event.presentation.departureCoins);
      if (event.actorId && usedItemEvents.has(event.kind)) itemUsers.add(event.actorId);
      if (record.activeTurn && record.activeTurn.playerId === event.actorId && gameplayEvents.has(event.kind)) { record.activeTurn.meaningful = true; record.activeTurn.committedAt ??= event.at; }
      switch (event.kind) {
        case 'TASKS_ASSIGNED_PRIVATE': {
          const payload = event.actorId ? event.privatePayloads?.[event.actorId] as { tasks?: { jobs: Array<{ id: TaskId }> }; actionable?: boolean[] } | undefined : undefined;
          for (const [index, task] of (payload?.tasks?.jobs ?? []).entries()) {
            report.tasks.push({ playerId: event.actorId!, taskId: task.id, round: event.round ?? report.round, assignedAt: event.at, actionable: payload?.actionable?.[index] ?? false, reward: 0 });
          }
          break;
        }
        case 'TASK_REPLACED': {
          const payload = event.actorId ? event.privatePayloads?.[event.actorId] as { previous: TaskId; task: { id: TaskId } } : undefined;
          if (!payload) break;
          const old = report.tasks.find(task => task.playerId === event.actorId && task.round === event.round && task.taskId === payload.previous);
          if (old) old.replacedAt = event.at;
          report.tasks.push({ playerId: event.actorId!, taskId: payload.task.id, round: event.round ?? report.round, assignedAt: event.at, actionable: true, reward: 0 });
          break;
        }
        case 'TASK_COMPLETED': {
          const payload = event.actorId ? event.privatePayloads?.[event.actorId] as { taskId: TaskId; reward: number } : undefined;
          const task = report.tasks.find(task => task.playerId === event.actorId && task.round === event.round && task.taskId === payload?.taskId);
          if (task && payload) { task.completedAt = event.at; task.reward = payload.reward; }
          break;
        }
        case 'ROUND_INCOME_GRANTED':
          for (const playerId of event.targetIds) {
            const player = players.get(playerId);
            if (player) player.roundIncomeReceived += event.presentation?.roundIncomeAmount ?? after.roundIncomeAmount ?? 0;
          }
          break;
        case 'WILDCARD_DRAWN_PRIVATE': {
          const payload = event.actorId ? event.privatePayloads?.[event.actorId] : undefined;
          const cardId = payload && typeof payload === 'object' && 'cardId' in payload && typeof payload.cardId === 'string' ? payload.cardId : undefined;
          if (event.actorId && cardId) {
            report.wildcardDraws += 1;
            report.wildcards.push({ playerId: event.actorId, cardId, round: event.round ?? report.round, drawnAt: event.at, targetIds: [], itemsTransferred: 0, itemsDestroyed: 0, itemsGranted: 0, coinsTransferred: 0, coinsGained: 0, hpHealed: 0, objectiveReadinessChanged: [], precededDown: false, precededExit: false });
          }
          break;
        }
        case 'WILDCARD_USED': case 'WILDCARD_BURNED': case 'WILDCARD_TARGET_SELECTED': case 'WILDCARD_RESOLVED': {
          const card = report.wildcards.find(value => value.playerId === event.actorId);
          if (!card) break;
          if (event.kind === 'WILDCARD_USED') { card.usedAt = event.at; report.wildcardUses += 1; }
          if (event.kind === 'WILDCARD_BURNED') { card.burnedAt = event.at; card.outcome = 'BURNED'; report.wildcardBurns += 1; }
          if (event.kind === 'WILDCARD_TARGET_SELECTED') card.targetIds = [...event.targetIds];
          if (event.kind === 'WILDCARD_RESOLVED') {
            const effect = event.presentation;
            card.resolvedAt = event.at; card.outcome = effect?.wildcardOutcome ?? 'APPLIED';
            card.targetIds = [...new Set([...card.targetIds, ...event.targetIds])];
            card.itemsTransferred = effect?.itemsTransferred?.length ?? 0;
            card.itemsDestroyed = effect?.itemsDestroyed?.length ?? 0;
            card.itemsGranted = effect?.itemsGranted?.length ?? 0;
            const gained = effect?.coinChanges?.reduce((sum, change) => sum + Math.max(0, change.amount), 0) ?? 0;
            const paid = effect?.coinChanges?.reduce((sum, change) => sum + Math.max(0, -change.amount), 0) ?? 0;
            card.coinsTransferred = Math.min(gained, paid); card.coinsGained = Math.max(0, gained - paid);
            card.hpHealed = effect?.hpChanges?.reduce((sum, change) => sum + Math.max(0, change.amount), 0) ?? 0;
            card.objectiveReadinessChanged = after.players.filter(player => (player.objective?.status === 'EXIT_READY' || player.objective?.status === 'BANKED') !== ['EXIT_READY', 'BANKED'].includes(before.players.find(value => value.id === player.id)?.objective?.status ?? '')).map(player => player.id);
            record.precedingWildcard = card;
          }
          break;
        }
        case 'TRADE_OFFERED': report.trades.proposed += 1; break;
        case 'TRADE_ACCEPTED': report.trades.manualAccepted += 1; break;
        case 'TRADE_DECLINED': report.trades.manualDeclined += 1; break;
        case 'TRADE_EXPIRED_DECLINED': report.trades.timeoutDeclined += 1; break;
        case 'TRADE_CANCELLED': report.trades.cancelled += 1; break;
        case 'THREAT_OFFERED': {
          const covered = after.pendingThreat?.mode === 'COVERED';
          if (covered) { report.threats.covered += 1; if (owner) owner.threats.covered += 1; }
          else { report.threats.open += 1; if (owner) owner.threats.open += 1; }
          break;
        }
        case 'THREAT_COMPLIED':
          if (event.presentation?.resolution === 'TIMEOUT') { report.threats.timeoutComplied += 1; if (owner) owner.threats.timeoutComplied += 1; }
          else { report.threats.manualComplied += 1; if (owner) owner.threats.manualComplied += 1; }
          break;
        case 'THREAT_REFUSED': report.threats.manualRefused += 1; if (owner) owner.threats.manualRefused += 1; break;
        case 'THREAT_CANCELLED': report.threats.cancelled += 1; if (owner) owner.threats.cancelled += 1; break;
        case 'PURCHASE': {
          if (owner) { if (event.presentation?.market === 'PUBLIC') owner.publicPurchases += 1; else owner.blackMarketPurchases += 1; }
          // A Black Market purchase deliberately omits its item from public facts.
          // Resolve its offer only in this server-local report, never in the event.
          const offerId = command?.command.type === 'BUY' ? command.command.payload.offerId : undefined;
          const privateOffer = event.actorId ? before.shop?.privateOffers[event.actorId]?.find(offer => offer.id === offerId) : undefined;
          const purchasedItem = event.presentation?.itemId ?? privateOffer?.itemId;
          if (purchasedItem === 'stimulant') report.stimulant.purchases += 1;
          if (purchasedItem === 'medicine') report.medicinePurchases += 1;
          break;
        }
        case 'SOLD': {
          if (owner) {
            const soldId = command?.command.type === 'SELL' ? command.command.payload.instanceId : undefined;
            const sold = before.players.find(player => player.id === owner.playerId)?.inventory.visible.find(item => item?.instanceId === soldId);
            owner.itemsSold += sold?.quantity ?? 1;
          }
          break;
        }
        case 'CHEST_OPENED': if (owner) { owner.chestOpenings += 1; report.chestOpeningsBySeat[owner.seat] = (report.chestOpeningsBySeat[owner.seat] ?? 0) + 1; } break;
        case 'WEAPON_USED': if (event.actorId && targetId && event.presentation?.itemId) weapons.set(`${event.actorId}:${targetId}`, event.presentation.itemId); break;
        case 'DAMAGE': case 'POISON_DAMAGE': {
          const itemId = event.kind === 'POISON_DAMAGE' ? 'poison' : weapons.get(`${event.actorId}:${targetId}`);
          report.stimulant.temporaryHpAbsorbed += event.presentation?.temporaryHpChanges?.reduce((sum, change) => sum + Math.max(0, -change.amount), 0) ?? 0;
          if (owner && targetId && itemId) {
            const actual = event.presentation?.hpChanges?.find(change => change.playerId === targetId);
            const damage = actual ? Math.max(0, -actual.amount) : Math.min(hp.get(targetId) ?? 0, Number(ITEM_BY_ID[itemId]!.effect.damage));
            owner.damageByItem[itemId] = (owner.damageByItem[itemId] ?? 0) + damage;
            hp.set(targetId, Math.max(0, (hp.get(targetId) ?? 0) - damage));
          }
          break;
        }
        case 'DOWNED': if (owner) owner.downs += 1; break;
        case 'REVIVED': if (owner) { owner.revives += 1; owner.medicineUses += 1; } break;
        case 'HEALED': if (owner) owner.medicineUses += 1; break;
        case 'STIMULANT_USED':
          report.stimulant.uses += 1;
          report.stimulant.normalHpRestored += event.presentation?.hpChanges?.reduce((sum, change) => sum + Math.max(0, change.amount), 0) ?? 0;
          report.stimulant.temporaryHpGenerated += event.presentation?.temporaryHpChanges?.reduce((sum, change) => sum + Math.max(0, change.amount), 0) ?? 0;
          break;
        case 'ARMOR_BLOCKED': if (target) target.armorUses += 1; break;
        case 'DEATH': if (target) target.deaths += 1; break;
        case 'OBJECTIVE_READY': case 'DEATH_OBJECTIVE_BANKED': if (owner) owner.objectiveCompletedRound ??= event.round ?? report.round; break;
        case 'OBJECTIVE_FAILED': if (owner) owner.objectiveFailedRound ??= event.round ?? report.round; break;
        case 'PLAYER_CONCEDED': if (owner) owner.conceded = true; break;
        case 'TURN_ENDED':
          if (record.activeTurn) report.decisions.push({ playerId: record.activeTurn.playerId, round: record.activeTurn.round, elapsedMs: Math.max(0, (record.activeTurn.committedAt ?? event.at) - record.activeTurn.startedAt), passed: Boolean(command && ['PASS_TURN', 'END_TURN'].includes(command.command.type)), timedOut: !command && !record.activeTurn.meaningful && before.turn?.pausedRemainingMs === undefined && (before.turn?.deadlineAt ?? Infinity) <= event.at, meaningful: record.activeTurn.meaningful, normalTurn: record.activeTurn.normalTurn });
          if (record.activeTurn && !record.activeTurn.meaningful) players.get(record.activeTurn.playerId)!.turnsWithNoGameplayAction += 1;
          delete record.activeTurn;
          break;
        case 'TURN_STARTED':
          record.activeTurn = { playerId: event.actorId!, meaningful: false, normalTurn: after.turn?.activeSeat === after.players.find(player => player.id === event.actorId)?.seat ? !after.turn?.startedDowned : before.players.find(player => player.id === event.actorId)?.life !== 'DOWNED', startedAt: event.at, round: event.round ?? report.round };
          if (!report.roundDurations.some(round => round.round === event.round)) report.roundDurations.push({ round: event.round ?? report.round, startedAt: event.at, durationMs: 0 });
          break;
        case 'INTERMISSION_PREP_STARTED': {
          record.intermission = { startedAt: event.at, finishedAt: new Map() };
          report.stimulant.publicOffers += after.shop?.publicOffers.filter(offer => offer.itemId === 'stimulant').length ?? 0;
          report.stimulant.privateOffers += Object.values(after.shop?.privateOffers ?? {}).reduce((sum, offers) => sum + offers.filter(offer => offer.itemId === 'stimulant').length, 0);
          for (const player of after.players) {
            if (player.life !== 'ACTIVE' && player.life !== 'DOWNED' || player.conceded) continue;
            const stats = players.get(player.id)!;
            const canShop = player.life === 'ACTIVE' && player.connection === 'CONNECTED';
            const ownsLedger = [...player.inventory.visible, ...player.inventory.pockets.map(pocket => pocket.item)].some(item => item?.itemId === 'red-ledger');
            const prices = [...(after.shop?.publicOffers ?? []).map(offer => Math.max(1, offer.price - (ownsLedger ? 1 : 0))), ...(after.shop?.privateOffers[player.id] ?? []).map(offer => offer.price)];
            const affordableItems = prices.filter(price => price <= player.inventory.coins).length;
            stats.intermissionCoins.push({ round: event.round ?? report.round, coins: player.inventory.coins, affordableItems });
            if (canShop && affordableItems === 0) stats.intermissionsWithNoAffordableItems += 1;
          }
          break;
        }
        case 'INTERMISSION_PLAYER_FINISHED': if (event.actorId) record.intermission?.finishedAt.set(event.actorId, event.at); break;
      }
    }
    // Observe proximity, never claim that a card caused the subsequent Down/exit.
    const nearest = record.precedingWildcard ?? precedingWildcard;
    if (nearest) {
      nearest.precededDown ||= events.some(event => event.kind === 'DOWNED');
      nearest.precededExit ||= events.some(event => event.kind === 'EXIT');
    }
    if (precedingWildcard && record.precedingWildcard === precedingWildcard && events.some(event => completedGameplayEvents.has(event.kind) || event.kind === 'WILDCARD_DRAWN_PRIVATE')) delete record.precedingWildcard;
    if (record.intermission && after.round?.phase !== 'INTERMISSION') {
      report.intermissionDurationMs += Math.max(0, after.updatedAt - record.intermission.startedAt);
      for (const [playerId, finishedAt] of record.intermission.finishedAt) players.get(playerId)!.intermissionIdleMs += Math.max(0, after.updatedAt - finishedAt);
      for (const player of after.players) { const entry = players.get(player.id)?.intermissionCoins.at(-1); if (entry) entry.afterCoins = player.inventory.coins; }
      delete record.intermission;
    }
    for (const player of after.players) {
      const stats = players.get(player.id)!;
      stats.role = player.roleId ?? null; stats.objective = player.objective?.objectiveId ?? null;
      stats.exitPlacement = player.exitOrder ?? null; stats.score = player.score;
      stats.conceded = Boolean(player.conceded);
      stats.objectiveFailureReason = player.objective?.failureReason ?? null;
      if (player.objective?.firstReadyAt !== undefined && player.bankedAt !== undefined) stats.readinessToExitMs = Math.max(0, player.bankedAt - player.objective.firstReadyAt);
      const previous = before.players.find(candidate => candidate.id === player.id);
      if (stats.coinsUnspentAtMatchEnd === null && (player.life === 'DEAD' || player.life === 'EXITED' || after.status === 'RESULTS')) {
        stats.coinsUnspentAtMatchEnd = departureCoins.get(player.id)
          ?? (previous && previous.life !== 'DEAD' && previous.life !== 'EXITED' && (player.life === 'DEAD' || player.life === 'EXITED') ? previous.inventory.coins : player.inventory.coins);
      }
      if (previous && before.match && before.matchSerial === after.matchSerial && player.life !== 'DEAD' && player.life !== 'EXITED') {
        const delta = player.inventory.coins - previous.inventory.coins;
        stats.coinsEarned += Math.max(0, delta); stats.coinsSpent += Math.max(0, -delta);
      }
      if (!previous || !itemUsers.has(player.id)) continue;
      const afterItems = possessions(player);
      const explicitlyUsed = command?.actorId === player.id && ['USE_ITEM', 'DOWNED_INTERACTION'].includes(command.command.type) ? command.command.payload.instanceId : undefined;
      for (const pocket of previous.inventory.pockets) {
        if (pocket.item && (pocket.item.instanceId === explicitlyUsed || (afterItems.get(pocket.item.instanceId) ?? 0) < pocket.item.quantity)) stats.pocketItemUses += 1;
      }
    }
    const matchStart = after.events?.find(event => event.kind === 'MATCH_STARTED')?.at;
    report.matchDurationMs = matchStart === undefined ? 0 : Math.max(0, after.updatedAt - matchStart);
    for (const [index, round] of report.roundDurations.entries()) round.durationMs = Math.max(0, (report.roundDurations[index + 1]?.startedAt ?? after.updatedAt) - round.startedAt);
    report.averageDecisionMs = report.decisions.length ? report.decisions.reduce((sum, decision) => sum + decision.elapsedMs, 0) / report.decisions.length : 0;
    report.passTurnCount = report.decisions.filter(decision => decision.passed).length;
    report.normalTurnTimeoutCount = report.decisions.filter(decision => decision.normalTurn && decision.timedOut).length;
    const normalDecisions = report.decisions.filter(decision => decision.normalTurn);
    report.meaningfulActionRate = normalDecisions.length ? normalDecisions.filter(decision => decision.meaningful).length / normalDecisions.length : 0;
    // Track whether a Task was ever plausible during its Round, not just at assignment.
    for (const task of report.tasks) {
      const player = after.players.find(player => player.id === task.playerId);
      if (player && task.round === after.round?.number && !task.replacedAt && !task.actionable && player.life === 'ACTIVE') task.actionable = taskPlausible(after, player, task.taskId);
    }
    report.taskCompletionByType = {};
    for (const task of report.tasks) {
      const count = report.taskCompletionByType[task.taskId] ??= { assigned: 0, completed: 0, rate: 0 };
      count.assigned += 1; count.completed += Number(task.completedAt !== undefined); count.rate = count.completed / count.assigned;
    }
    record.revision = after.revision;
  }

  /** Bounded in-memory reports for trusted local beta tooling; no tokens, chat, or Pocket contents. */
  recordFailedCommand(room: RoomState): void {
    const record = this.matches.get(`${room.id}:${room.matchSerial ?? 0}`);
    if (record) record.report.failedCommandCount += 1;
  }

  exportAdminTelemetry(roomCode?: string): MatchTelemetry[] {
    return structuredClone([...this.matches.values()].filter(record => roomCode === undefined || record.report.roomCode === roomCode).map(record => record.report));
  }
}

/** Captures successful authoritative transitions without changing transport or player views. */
export class TelemetryRoomStoreAdapter extends RoomStoreAdapter {
  readonly telemetry = new MatchTelemetryRecorder();
  telemetryFailureCount = 0;
  constructor(store = new RoomStore({ issueSessions: false }), seed?: () => number) { super(store, seed); }
  override command(code: string, actorId: string, command: GameCommand, now: number): void {
    // The base adapter replaces state through pure transitions; the old object
    // remains a stable snapshot without copying the entire event log again.
    const before = this.read(code)!;
    try { super.command(code, actorId, command, now); }
    catch (error) {
      try { if (before) this.telemetry.recordFailedCommand(before); }
      catch { this.telemetryFailureCount += 1; }
      throw error;
    }
    this.capture(before, this.read(code)!, { actorId, command });
  }
  override setConnected(code: string, playerId: string, connected: boolean, now: number): void {
    const before = this.read(code)!;
    super.setConnected(code, playerId, connected, now);
    this.capture(before, this.read(code)!);
  }
  override timeout(code: string, deadline: Deadline, now: number): void {
    const before = this.read(code)!;
    super.timeout(code, deadline, now);
    this.capture(before, this.read(code)!);
  }
  private capture(before: RoomState, after: RoomState, command?: { actorId: string; command: GameCommand }): void {
    try { this.telemetry.capture(before, after, command); }
    catch { this.telemetryFailureCount += 1; }
  }
}
