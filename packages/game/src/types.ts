import type { TaskId, WildcardId } from '@the-table/content';
export type { WildcardId } from '@the-table/content';
export interface PendingWildcard { cardId: WildcardId; phase: 'DRAWN' | 'TARGETING' }
export interface WildcardDiscard { cardId: WildcardId; playerId: string; burned: boolean }
export interface PublicWildcardState {
  unlocked: boolean;
  remaining: number;
  drawUsedByPlayer: Record<string, boolean>;
  discard: Array<{ playerId: string; burned: boolean; cardId?: WildcardId }>;
  pending?: { playerId: string; cardId: WildcardId };
}
export const ROLE_IDS = [
  'enforcer',
  'medic',
  'smuggler',
  'locksmith',
  'broker',
  'scavenger',
] as const;

export type RoleId = (typeof ROLE_IDS)[number];
export type RoomStatus = 'LOBBY' | 'PLAYING' | 'RESULTS' | 'CLOSED';
export type PlayerLife = 'ACTIVE' | 'DOWNED' | 'DEAD' | 'EXITED';
export type ConnectionState = 'CONNECTED' | 'DISCONNECTED';

export interface ItemStack {
  instanceId: string;
  itemId: string;
  quantity: number;
  /** Authoritative resale embargo; never infer acquisition from client history. */
  acquiredIntermissionId?: string;
}

export interface PocketState {
  item: ItemStack | null;
  protectedBySafe: boolean;
  source: 'DEFAULT' | 'BAG';
}

export interface InventoryState {
  visible: Array<ItemStack | null>;
  pockets: PocketState[];
  coins: number;
}

export interface ObjectiveState {
  objectiveId: string;
  status: 'ACTIVE' | 'EXIT_READY' | 'BANKED' | 'FAILED';
  progress: Record<string, unknown>;
  rewardGranted: boolean;
  firstReadyAt?: number;
  targetPlayerId?: string;
  contingencyTargetId?: string;
  contingency?: boolean;
  readyOnTurn?: number;
  revealed?: boolean;
  failureReason?: string;
}

export interface PlayerState {
  id: string;
  seat: 0 | 1 | 2 | 3;
  name: string;
  normalizedName: string;
  connection: ConnectionState;
  roleId?: RoleId;
  ready: boolean;
  hp: number;
  /** Public extra health, consumed before normal HP and capped at 2. */
  temporaryHp?: number;
  inventory: InventoryState;
  objective?: ObjectiveState;
  life: PlayerLife;
  score: number;
  statuses?: StatusEffect[];
  downed?: DownedState;
  turnsStarted?: number;
  /** First eligible Phoenix market has been offered; never part of public state. */
  phoenixMedicineOfferSeen?: boolean;
  safeAssignments?: Record<string, number>;
  exitOrder?: number;
  bankedAt?: number;
  conceded?: boolean;
  abilities?: { quickDrawUsed: boolean; locksmithRound?: number; glassEyeRound?: number; brassIdolRound?: number; redLedgerRound?: number; salvageRound?: number };
}

export interface RoundTask {
  id: TaskId;
  status: 'ACTIVE' | 'COMPLETED' | 'CANCELLED' | 'EXPIRED' | 'REPLACED';
  progress: number;
  /** Only irreversible loss of these original prerequisites permits replacement. */
  prerequisites: string[];
}
export interface RoundTasks {
  round: number;
  reward: number;
  jobs: RoundTask[];
  completed: boolean;
  replacementUsed: boolean;
  opportunityTaken: boolean;
}

export interface RoomState {
  mode?: 'tutorial';
  sideJobsByPlayer?: Record<string, RoundTasks>;
  sideJobRoundId?: number;

  id: string;
  code: string;
  revision: number;
  status: RoomStatus;
  hostPlayerId: string;
  players: PlayerState[];
  createdAt: number;
  updatedAt: number;
  /** Monotonic within a room so receipts and presentation IDs never collide across rematches. */
  matchSerial?: number;
  setup?: SetupState;
  round?: RoundState;
  turn?: TurnState;
  pendingTrade?: TradeProposal;
  pendingThreat?: ThreatProposal;
  chests?: ChestState[];
  shop?: ShopState;
  overflows?: OverflowChoice[];
  events?: ActionEvent[];
  match?: MatchRuntime;
  wildcardDeck?: WildcardId[];
  wildcardDiscard?: WildcardDiscard[];
  wildcardUnlocked?: boolean;
  wildcardDrawUsedByPlayer?: Record<string, boolean>;
  pendingPrivateWildcardByPlayer?: Record<string, PendingWildcard>;
  roundIncomeAmount?: number;
  roundIncomeGrantedThrough?: number;
}

export interface SessionRecord {
  playerId: string;
  tokenHash: string;
  createdAt: number;
  rotatedAt: number;
}

export interface PublicPlayerView {
  id: string;
  seat: number;
  name: string;
  connection: ConnectionState;
  roleId?: RoleId;
  ready: boolean;
  hp: number;
  temporaryHp?: number;
  visibleInventory: Array<ItemStack | null>;
  pocketOccupancy: boolean[];
  coins: number;
  life: PlayerLife;
  conceded?: boolean;
  downed?: DownedState;
  objectiveCompleted: boolean;
  score: number;
  statuses?: StatusEffect[];
  exitOrder?: number;
  revealedObjective?: ObjectiveState;
}

export interface SetupState {
  deadlineAt: number;
  lockedPlayerIds: string[];
  bonusPlayerId: string;
  bonusItemInstanceId: string;
}

export interface PublicRoomView {
  mode?: 'tutorial';
  wildcard?: PublicWildcardState;
  roundIncomeAmount?: number;
  id: string;
  code: string;
  revision: number;
  status: RoomStatus;
  hostPlayerId: string;
  players: PublicPlayerView[];
  setup?: Pick<SetupState, 'deadlineAt' | 'lockedPlayerIds'>;
  round?: RoundState;
  turn?: TurnState;
  pendingTrade?: TradeProposal;
  pendingThreat?: Omit<ThreatProposal, "committedItemId" | "committedItemType" | "useQuickDraw"> & { committedItemId?: string; committedItemType?: string };
  chests?: Array<Omit<ChestState, "loot">>;
  shop?: Pick<ShopState, "id" | "phase" | "prepDeadlineAt" | "publicDeadlineAt" | "privateDeadlineAt" | "privateUnlockedBy" | "finishedBy" | "publicOffers" | "order" | "activeShopperIndex" | "publicPurchasedBy" | "publicSkippedBy" | "orderReveal">;
  overflows?: Array<Pick<OverflowChoice, "id" | "playerId" | "deadlineAt">>;
  events?: Array<Omit<ActionEvent, "privatePayloads">>;
}

export interface PlayerPrivateView {
  tasks?: RoundTasks;
  pendingWildcard?: PendingWildcard;
  setup?: { items: ItemStack[]; locked: boolean; bonusItemInstanceId?: string };
  playerId: string;
  pockets: PocketState[];
  objective?: ObjectiveState;
  blackMarket?: ShopOffer[];
  inspections?: Array<{ eventId: string; payload: unknown }>;
  overflows?: OverflowChoice[];
  capabilities?: string[];
  abilities?: PlayerState['abilities'];
  turnsStarted?: number;
  intermission?: { privatePurchased: boolean; finished: boolean };
}

export interface AuthorizedRoomView {
  public: PublicRoomView;
  private: PlayerPrivateView;
}

export type RoomErrorCode =
  | 'INVALID_NAME'
  | 'INVALID_CODE'
  | 'ROOM_NOT_FOUND'
  | 'ROOM_FULL'
  | 'DUPLICATE_NAME'
  | 'INVALID_SESSION'
  | 'ROLE_TAKEN'
  | 'ROLE_UNKNOWN'
  | 'NOT_IN_LOBBY';

export class RoomError extends Error {
  constructor(public readonly code: RoomErrorCode, message: string) {
    super(message);
    this.name = 'RoomError';
  }
}

export type Seat = 0 | 1 | 2 | 3;
export interface StatusEffect {
  id: string;
  kind: 'POISON' | 'HANDCUFFED';
  sourcePlayerId: string;
  remainingTurns: number;
  appliedTurn: number;
}
export interface DownedState {
  aggressorId: string;
  downedAt: number;
  eventId: string;
  expiresRound: number;
  expiresSeat: Seat;
}
export interface TurnState {
  activeSeat: Seat;
  serial: number;
  startedAt: number;
  deadlineAt: number;
  primaryUsed: boolean;
  downedInteractionUsed: boolean;
  exitDeclined: boolean;
  startedDowned: boolean;
  pausedRemainingMs?: number;
  pendingInteractionId?: string;
  immediateLoot?: { playerId: string; targetId: string; downEventId: string; deadlineAt?: number };
}
export interface RoundState {
  number: number;
  seatsOwedTurn: Seat[];
  phase: 'SETUP' | 'TURN' | 'INTERMISSION' | 'RESULTS';
}
export interface TradeProposal {
  id: string;
  actorId: string;
  targetId: string;
  offeredItems: string[];
  offeredCoins: number;
  requestedItems: string[];
  requestedCoins: number;
  status: 'PENDING';
  deadlineAt: number;
}
export interface ThreatProposal {
  id: string;
  actorId: string;
  targetId: string;
  mode: 'OPEN' | 'COVERED';
  committedItemId: string;
  committedItemType: string;
  demandedItems: string[];
  demandedCoins: number;
  useQuickDraw: boolean;
  status: 'PENDING';
  deadlineAt: number;
}
export type ChestLoot = { kind: 'ITEM'; stack: ItemStack } | { kind: 'COINS'; amount: number };
export interface ChestState {
  kind: 'STANDARD' | 'BLACK';
  availability: 'HIDDEN' | 'AVAILABLE' | 'OPENED';
  loot: ChestLoot[];
  refreshRound?: number;
}
export interface ShopOffer { id: string; itemId: string; price: number; purchasedBy?: string }
export interface ShopState {
  id: string;
  phase: 'PREP' | 'PUBLIC' | 'GRACE';
  prepDeadlineAt: number;
  publicDeadlineAt?: number;
  privateDeadlineAt?: number;
  privateUnlockedBy: Record<string, boolean>;
  finishedBy: Record<string, boolean>;
  /** Public presentation of the existing start/direction draws; never a second roll. */
  orderReveal?: { startedAt: number; firstPlayerId: string; direction: 'ASCENDING' | 'DESCENDING'; eligiblePlayerIds: string[]; selectedIndex: number };
  publicOffers: ShopOffer[];
  privateOffers: Record<string, ShopOffer[]>;
  publicPurchasedBy: Record<string, boolean>;
  publicSkippedBy?: Record<string, boolean>;
  privatePurchasedBy: Record<string, boolean>;
  order: string[];
  activeShopperIndex: number;
  boughtBy: Record<string, boolean>;
}
export interface OverflowChoice {
  id: string;
  playerId: string;
  incoming: ItemStack;
  deadlineAt: number;
}
/** Public, structured facts that presentation/audio may consume without parsing prose. */
export interface ActionEventPresentation {
  /** Public Coin balance at departure, before inventory cleanup zeroes it. */
  departureCoins?: number;
  wildcardId?: WildcardId;
  roundIncomeAmount?: number;
  wildcardOutcome?: 'APPLIED' | 'BLOCKED' | 'NO_LEGAL_TARGET' | 'EXPIRED';
  itemsTransferred?: Array<{ instanceId: string; itemId: string; quantity: number; fromPlayerId: string; toPlayerId: string }>;
  itemsDestroyed?: Array<{ instanceId: string; itemId: string; quantity: number; playerId: string }>;
  itemsGranted?: Array<{ instanceId: string; itemId: string; quantity: number; playerId: string }>;
  coinChanges?: Array<{ playerId: string; amount: number }>;
  hpChanges?: Array<{ playerId: string; amount: number }>;
  temporaryHpChanges?: Array<{ playerId: string; amount: number }>;
  revealedPocket?: { playerId: string; pocketIndex: number; item: ItemStack };
  itemId?: string;
  chestKind?: ChestState['kind'];
  market?: 'PUBLIC';
  resolution?: 'MANUAL' | 'TIMEOUT' | 'DISCONNECT';
  /** Public Threat result after resolution; covered commitments are no longer secret then. */
  threatOutcome?: 'COMPLIED' | 'REFUSED_VALID' | 'BLUFF_CALLED' | 'CANCELLED';
}
export interface ActionEvent {
  /** Authoritative event round, retained when a transition also advances the round. */
  round?: number;
  id: string;
  sequence: number;
  at: number;
  kind: string;
  actorId?: string;
  targetIds: string[];
  publicText: string;
  presentation?: ActionEventPresentation;
  privatePayloads?: Record<string, unknown>;
}
export interface GameHistory {
  trades: Array<{ actorId: string; targetId: string; round: number; sequence: number }>;
  downs: Array<{ actorId: string; targetId: string; eventId: string; sequence: number; recovered: boolean }>;
  revives: Array<{ actorId: string; targetId: string; eventId: string }>;
  loots: Array<{ actorId: string; targetId: string; eventId: string }>;
  poisonTicks: Array<{ actorId: string; targetId: string }>;
  threats: Array<{ actorId: string; targetId: string; complied: boolean; covered: boolean; validWeapon: boolean; assetsReceived: boolean; resolution?: 'MANUAL' | 'TIMEOUT' }>;
  pickpockets: Array<{ actorId: string; targetId: string }>;
  chests: Array<{ actorId: string; kind: 'STANDARD' | 'BLACK' }>;
  deaths: Array<{ playerId: string; killerId: string; at: number }>;
}
export interface MatchRuntime {
  seed: number;
  rngState: number;
  nextId: number;
  turnSerial: number;
  playerCount: number;
  fixedSeats: Seat[];
  history: GameHistory;
  artifactPool: string[];
  passageTokenAvailable: boolean;
  blackKeyObtainable: boolean;
  exits: string[];
}
export type GameCommand =
  | { type: 'DRAW_WILDCARD' | 'USE_WILDCARD' | 'BURN_WILDCARD' }
  | { type: 'RESOLVE_WILDCARD'; targetId?: string; instanceId?: string; ownInstanceId?: string; pocketIndex?: number }
  | { type: 'START_MATCH'; seed: number }
  | { type: 'REMATCH' }
  | { type: 'SET_READY' | 'READY'; ready: boolean }
  | { type: 'CLAIM_ROLE'; roleId: string }
  | { type: 'END_TURN' | 'PASS_TURN' | 'SKIP_LOOT' | 'LEAVE_TABLE' | 'CONCEDE' | 'STAY' | 'FINISH_SHOPPING' | 'SKIP_PUBLIC_SHOP' }
  | { type: 'LOCK_SETUP'; instanceId: string }
  | { type: 'USE_ITEM'; instanceId: string; targetId?: string; pocketIndex?: number; useQuickDraw?: boolean }
  | { type: 'TRADE'; targetId: string; offeredItems: string[]; offeredCoins: number; requestedItems: string[]; requestedCoins: number }
  | { type: 'RESPOND_TRADE'; accept: boolean }
  | { type: 'THREAT'; targetId: string; mode: 'OPEN' | 'COVERED'; committedItemId: string; clothItemId?: string; demandedItems: string[]; demandedCoins: number; useQuickDraw?: boolean }
  | { type: 'RESPOND_THREAT'; comply: boolean }
  | { type: 'DOWNED_INTERACTION'; targetId: string; kind: 'LOOT' | 'REVIVE' | 'HELP'; instanceId: string }
  | { type: 'LOOT_DOWNED'; targetId: string; instanceId: string }
  | { type: 'OVERFLOW_CHOICE'; overflowId: string; replaceInstanceId?: string }
  | { type: 'BUY'; market: 'PUBLIC' | 'BLACK'; offerId: string; useRedLedger?: boolean }
  | { type: 'SELL'; instanceId: string }
  | { type: 'POCKET'; instanceId: string; pocketIndex: number }
  | { type: 'ASSIGN_SAFE'; instanceId: string; pocketIndex: number }
  | { type: 'INSPECT_CHEST' }
  | { type: 'REROLL_MARKET'; offerId: string };
export type GameErrorCode = 'ROLE_TAKEN' | 'ROLE_UNKNOWN' | 'INVALID_COMMAND' | 'INVALID_STATE' | 'WRONG_PHASE' | 'NOT_YOUR_TURN' | 'NOT_ELIGIBLE' | 'NOT_FOUND' | 'LOCKED' | 'INVALID_TARGET' | 'INSUFFICIENT_COINS' | 'DEADLINE_EXPIRED' | 'NOT_HOST';
export class GameError extends Error {
  constructor(public readonly code: GameErrorCode, message: string) { super(message); this.name = 'GameError'; }
}
export interface SpectatorView {
  public: PublicRoomView;
  players: Array<{ public: PublicPlayerView; private: PlayerPrivateView }>;
  chests: ChestState[];
  shop?: ShopState;
  events: ActionEvent[];
  capabilities: readonly [];
}
