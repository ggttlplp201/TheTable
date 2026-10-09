import { ITEM_BY_ID, RoomStore, type PlayerState, type RoomState } from '@the-table/game';
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
export interface MatchTelemetry {
  schemaVersion: 'v14';
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
}
interface RecordedMatch {
  report: MatchTelemetry;
  revision: number;
  activeTurn?: { playerId: string; meaningful: boolean };
  intermission?: { startedAt: number; finishedAt: Map<string, number> };
}
const usedItemEvents = new Set(['WEAPON_USED', 'HEALED', 'REVIVED', 'POISON_APPLIED', 'POISON_CURED', 'HANDCUFFED', 'POCKET_INSPECTED', 'PICKPOCKET', 'THREAT_OFFERED', 'CHEST_OPENED']);
const gameplayEvents = new Set([...usedItemEvents, 'TRADE_OFFERED', 'LOOTED', 'EXIT', 'PLAYER_CONCEDED']);
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
        schemaVersion: 'v14', roomId: after.id, roomCode: after.code, matchSerial: after.matchSerial ?? 0,
        status: after.status, round: after.round?.number ?? 0, phase: after.round?.phase ?? after.status,
        players: after.players.map(player => ({
          playerId: player.id, role: player.roleId ?? null, seat: player.seat, objective: player.objective?.objectiveId ?? null,
          exitPlacement: null, score: 0, coinsEarned: 0, coinsSpent: 0, objectiveCompletedRound: null, objectiveFailedRound: null, objectiveFailureReason: null,
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
    for (const event of events) {
      const owner = event.actorId ? players.get(event.actorId) : undefined;
      const targetId = event.targetIds[0];
      const target = targetId ? players.get(targetId) : undefined;
      if (event.actorId && usedItemEvents.has(event.kind)) itemUsers.add(event.actorId);
      if (record.activeTurn && record.activeTurn.playerId === event.actorId && gameplayEvents.has(event.kind)) record.activeTurn.meaningful = true;
      switch (event.kind) {
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
        case 'PURCHASE': if (owner) { if (event.presentation?.market === 'PUBLIC') owner.publicPurchases += 1; else owner.blackMarketPurchases += 1; } break;
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
          if (owner && targetId && itemId) {
            const damage = Math.min(hp.get(targetId) ?? 0, Number(ITEM_BY_ID[itemId]!.effect.damage));
            owner.damageByItem[itemId] = (owner.damageByItem[itemId] ?? 0) + damage;
            hp.set(targetId, Math.max(0, (hp.get(targetId) ?? 0) - damage));
          }
          break;
        }
        case 'DOWNED': if (owner) owner.downs += 1; break;
        case 'REVIVED': if (owner) { owner.revives += 1; owner.medicineUses += 1; } break;
        case 'HEALED': if (owner) owner.medicineUses += 1; break;
        case 'ARMOR_BLOCKED': if (target) target.armorUses += 1; break;
        case 'DEATH': if (target) target.deaths += 1; break;
        case 'OBJECTIVE_READY': case 'DEATH_OBJECTIVE_BANKED': if (owner) owner.objectiveCompletedRound ??= event.round ?? report.round; break;
        case 'OBJECTIVE_FAILED': if (owner) owner.objectiveFailedRound ??= event.round ?? report.round; break;
        case 'PLAYER_CONCEDED': if (owner) owner.conceded = true; break;
        case 'TURN_ENDED':
          if (record.activeTurn && !record.activeTurn.meaningful) players.get(record.activeTurn.playerId)!.turnsWithNoGameplayAction += 1;
          delete record.activeTurn;
          break;
        case 'TURN_STARTED': record.activeTurn = { playerId: event.actorId!, meaningful: false }; break;
        case 'INTERMISSION_PREP_STARTED': record.intermission = { startedAt: event.at, finishedAt: new Map() }; break;
        case 'INTERMISSION_PLAYER_FINISHED': if (event.actorId) record.intermission?.finishedAt.set(event.actorId, event.at); break;
      }
    }
    if (record.intermission && after.round?.phase !== 'INTERMISSION') {
      report.intermissionDurationMs += Math.max(0, after.updatedAt - record.intermission.startedAt);
      for (const [playerId, finishedAt] of record.intermission.finishedAt) players.get(playerId)!.intermissionIdleMs += Math.max(0, after.updatedAt - finishedAt);
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
    record.revision = after.revision;
  }

  /** Bounded in-memory reports for trusted local beta tooling; no tokens, chat, or Pocket contents. */
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
    super.command(code, actorId, command, now);
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
