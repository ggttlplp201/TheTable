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
}

export interface PublicRoomView {
  id: string;
  code: string;
  revision: number;
  status: RoomStatus;
  hostPlayerId: string;
  players: PublicPlayerView[];
}

export interface PlayerPrivateView {
  playerId: string;
  pockets: PocketState[];
  objective?: ObjectiveState;
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
