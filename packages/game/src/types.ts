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
  inventory: InventoryState;
  objective?: ObjectiveState;
  life: PlayerLife;
  score: number;
  statuses?: StatusEffect[];
  downed?: DownedState;
  turnsStarted?: number;
  safeAssignments?: Record<string, number>;
  exitOrder?: number;
  bankedAt?: number;
  abilities?: { quickDrawUsed: boolean; locksmithRound?: number; glassEyeRound?: number; brassIdolRound?: number; redLedgerRound?: number; salvageRound?: number };
}

export interface RoomState {
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
  round?: RoundState;
  turn?: TurnState;
  pendingTrade?: TradeProposal;
  pendingThreat?: ThreatProposal;
  chests?: ChestState[];
  shop?: ShopState;
  overflows?: OverflowChoice[];
  events?: ActionEvent[];
  match?: MatchRuntime;
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
  visibleInventory: Array<ItemStack | null>;
  pocketOccupancy: boolean[];
  coins: number;
  life: PlayerLife;
  objectiveCompleted: boolean;
  score: number;
  statuses?: StatusEffect[];
  exitOrder?: number;
  revealedObjective?: ObjectiveState;
}

export interface PublicRoomView {
  id: string;
  code: string;
  revision: number;
  status: RoomStatus;
  hostPlayerId: string;
  players: PublicPlayerView[];
  round?: RoundState;
  turn?: TurnState;
  pendingTrade?: TradeProposal;
  pendingThreat?: Omit<ThreatProposal, "committedItemId" | "committedItemType" | "useQuickDraw"> & { committedItemId?: string; committedItemType?: string };
  chests?: Array<Omit<ChestState, "loot">>;
  shop?: Pick<ShopState, "publicOffers" | "order" | "activeShopperIndex" | "publicPurchasedBy">;
  overflows?: Array<Pick<OverflowChoice, "id" | "playerId" | "deadlineAt">>;
  events?: Array<Omit<ActionEvent, "privatePayloads">>;
}

export interface PlayerPrivateView {
  playerId: string;
  pockets: PocketState[];
  objective?: ObjectiveState;
  blackMarket?: ShopOffer[];
  inspections?: Array<{ eventId: string; payload: unknown }>;
  overflows?: OverflowChoice[];
  capabilities?: string[];
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
  immediateLoot?: { playerId: string; targetId: string; downEventId: string };
}
export interface RoundState {
  number: number;
  seatsOwedTurn: Seat[];
  phase: 'TURN' | 'INTERMISSION' | 'RESULTS';
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
  publicOffers: ShopOffer[];
  privateOffers: Record<string, ShopOffer[]>;
  publicPurchasedBy: Record<string, boolean>;
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
  itemId?: string;
  chestKind?: ChestState['kind'];
  market?: 'PUBLIC';
}
export interface ActionEvent {
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
  threats: Array<{ actorId: string; targetId: string; complied: boolean; covered: boolean; validWeapon: boolean; assetsReceived: boolean }>;
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
  | { type: 'START_MATCH'; seed: number }
  | { type: 'REMATCH' }
  | { type: 'SET_READY' | 'READY'; ready: boolean }
  | { type: 'CLAIM_ROLE'; roleId: string }
  | { type: 'END_TURN' | 'LEAVE_TABLE' | 'STAY' | 'FINISH_SHOPPING' }
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
