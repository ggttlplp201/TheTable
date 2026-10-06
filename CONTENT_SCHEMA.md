# Content and State Schema

All identifiers are opaque strings. Balance values live in versioned content data, not UI components.

```ts
type ItemId = string;
type PlayerId = string;
type RoomId = string;
type InstanceId = string;
type Seat = 0 | 1 | 2 | 3;

interface Item {
  id: ItemId; name: string; type: string; basePrice: number | null;
  rarity: 'COMMON'|'UNCOMMON'|'RARE'|'SPECIAL'|'ARTIFACT'|'QUEST';
  consumption: 'ONE_USE'|'REUSABLE'|'PERSISTENT_UNTIL_TRIGGER';
  pocketEligible: boolean; maxStack: number; tags: string[];
}

interface ItemStack { instanceId: InstanceId; itemId: ItemId; quantity: number }
interface Role { id: string; name: string; startingItems: ItemId[]; startingCoins: number; ability: RoleAbility }
interface Objective { id: string; name: string; unlockRound: number; mode: 'LATCHED'|'SUSTAINED'; targeting: string; playerCount: number[]; contingency?: ObjectiveContingency }
interface ObjectiveState { objectiveId: string; status: 'ACTIVE'|'EXIT_READY'|'BANKED'|'FAILED'; targetPlayerId?: PlayerId; contingencyTargetId?: PlayerId; progress: Record<string, unknown>; firstReadyAt?: number; rewardGranted: boolean }

interface InventoryState { visible: Array<ItemStack|null>; pockets: PocketState[]; coins: number }
interface PocketState { item: ItemStack|null; protectedBySafe: boolean; source: 'DEFAULT'|'BAG' }
interface StatusEffect { id: string; kind: 'POISON'|'HANDCUFFED'|'ARMOR'; sourcePlayerId?: PlayerId; remainingTurns?: number; data?: Record<string, unknown> }

interface PlayerState {
  id: PlayerId; seat: Seat; name: string; connection: 'CONNECTED'|'DISCONNECTED';
  roleId?: string; ready: boolean; hp: number; inventory: InventoryState;
  statuses: StatusEffect[]; objective?: ObjectiveState; life: 'ACTIVE'|'DOWNED'|'DEAD'|'EXITED';
  downed?: { aggressorId: PlayerId; downedAt: number; eventId: string };
  score: number; exitOrder?: number;
}

interface TurnState { activeSeat: Seat; startedAt: number; deadlineAt: number; primaryUsed: boolean; pausedRemainingMs?: number; pendingInteractionId?: string }
interface RoundState { number: number; seatsOwedTurn: Seat[]; phase: 'TURN'|'INTERMISSION'|'RESULTS' }
interface TradeProposal { id: string; actorId: PlayerId; targetId: PlayerId; offeredItems: InstanceId[]; offeredCoins: number; requestedItems: InstanceId[]; requestedCoins: number; status: 'PENDING'|'ACCEPTED'|'DECLINED'|'CANCELLED'; deadlineAt: number }
interface ThreatProposal { id: string; actorId: PlayerId; targetId: PlayerId; mode: 'OPEN'|'COVERED'; committedItemId: InstanceId; clothItemId?: InstanceId; demandedItems: InstanceId[]; demandedCoins: number; status: 'PENDING'|'COMPLIED'|'REFUSED'|'CANCELLED'; deadlineAt: number }
interface ChestState { kind: 'STANDARD'|'BLACK'; availability: 'HIDDEN'|'AVAILABLE'|'OPENED'; loot: ChestLoot[]; refreshRound?: number }
type ChestLoot = { kind: 'ITEM'; stack: ItemStack } | { kind: 'COINS'; amount: number };
interface ShopOffer { id: string; itemId: ItemId; price: number; purchasedBy?: PlayerId }
interface ShopState { publicOffers: ShopOffer[]; privateOffers: Record<PlayerId, ShopOffer[]>; publicPurchasedBy: Partial<Record<PlayerId, boolean>>; privatePurchasedBy: Partial<Record<PlayerId, boolean>>; order: PlayerId[]; activeShopperIndex: number }
interface SpectatorState { playerId: PlayerId; since: number; reason: 'DEAD'|'EXITED' }
interface ActionEvent { id: string; sequence: number; at: number; kind: string; actorId?: PlayerId; targetIds: PlayerId[]; publicText: string; privatePayloads?: Record<PlayerId, unknown> }
interface ChatMessage { id: string; at: number; fromPlayerId: PlayerId; channel: 'GLOBAL'|'PRIVATE'; toPlayerId?: PlayerId; text: string }

interface RoomState {
  id: RoomId; code: string; revision: number; status: 'LOBBY'|'PLAYING'|'RESULTS'|'CLOSED';
  hostPlayerId: PlayerId; players: PlayerState[]; round?: RoundState; turn?: TurnState;
  pendingTrade?: TradeProposal; pendingThreat?: ThreatProposal; chests: ChestState[];
  shop?: ShopState; spectators: SpectatorState[]; events: ActionEvent[];
  createdAt: number; updatedAt: number;
}
```

## Projection contract

`PublicRoomView` contains no objective identity/progress, Pocket contents, private offers, private chat, or inspection results. `PlayerPrivateView` adds only the authenticated player's private fields. `SpectatorView` is emitted only after server-side verification that the requester is dead/exited and strips all action capabilities.

Every client command includes `roomId`, authenticated session identity, command type, payload, and optional expected revision. The server validates phase, actor, target, ownership, locks, capacity, and content rules before an atomic state transition.
