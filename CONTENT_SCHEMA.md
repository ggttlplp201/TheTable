# Content and State Schema

All identifiers are opaque strings. Balance values live in versioned content data, not UI components. This is a v14 + Round Income/Wildcards overview; the exact executable schema is `packages/game/src/types.ts`.

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

interface ItemStack { instanceId: InstanceId; itemId: ItemId; quantity: number; acquiredIntermissionId?: string }
interface Role { id: string; name: string; startingItems: ItemId[]; startingCoins: number; ability: RoleAbility }
interface Objective { id: string; name: string; unlockRound: number; mode: 'LATCHED'|'SUSTAINED'; targeting: string; playerCount: number[]; contingency?: ObjectiveContingency }
interface ObjectiveState { objectiveId: string; status: 'ACTIVE'|'EXIT_READY'|'BANKED'|'FAILED'; failureReason?: string; targetPlayerId?: PlayerId; contingencyTargetId?: PlayerId; progress: Record<string, unknown>; firstReadyAt?: number; readyOnTurn?: number; rewardGranted: boolean }
// Ten content IDs; table events, never ItemStacks or inventory assets.
type WildcardId = 'seize'|'destroy'|'supply-drop'|'shatter'|'forced-exchange'|'search-warrant'|'windfall'|'redistribution'|'scramble'|'second-chance';
interface PendingWildcard { cardId: WildcardId; phase: 'DRAWN'|'TARGETING' }

interface InventoryState { visible: Array<ItemStack|null>; pockets: PocketState[]; coins: number }
interface PocketState { item: ItemStack|null; protectedBySafe: boolean; source: 'DEFAULT'|'BAG' }
interface StatusEffect { id: string; kind: 'POISON'|'HANDCUFFED'|'ARMOR'; sourcePlayerId?: PlayerId; remainingTurns?: number; data?: Record<string, unknown> }

interface PlayerState {
  id: PlayerId; seat: Seat; name: string; connection: 'CONNECTED'|'DISCONNECTED';
  roleId?: string; ready: boolean; hp: number; temporaryHp?: number; inventory: InventoryState;
  phoenixMedicineOfferSeen?: boolean; // authoritative only, never projected publicly
  statuses: StatusEffect[]; objective?: ObjectiveState; life: 'ACTIVE'|'DOWNED'|'DEAD'|'EXITED';
  downed?: { aggressorId: PlayerId; downedAt: number; eventId: string; expiresRound: number; expiresSeat: Seat };
  conceded?: boolean;
  score: number; exitOrder?: number;
}

interface TurnState { activeSeat: Seat; startedAt: number; deadlineAt: number; primaryUsed: boolean; pausedRemainingMs?: number; pendingInteractionId?: string }
interface RoundState { number: number; seatsOwedTurn: Seat[]; phase: 'SETUP'|'TURN'|'INTERMISSION'|'RESULTS' }
interface TradeProposal { id: string; actorId: PlayerId; targetId: PlayerId; offeredItems: InstanceId[]; offeredCoins: number; requestedItems: InstanceId[]; requestedCoins: number; status: 'PENDING'|'ACCEPTED'|'DECLINED'|'CANCELLED'; deadlineAt: number }
interface ThreatProposal { id: string; actorId: PlayerId; targetId: PlayerId; mode: 'OPEN'|'COVERED'; committedItemId: InstanceId; clothItemId?: InstanceId; demandedItems: InstanceId[]; demandedCoins: number; status: 'PENDING'|'COMPLIED'|'REFUSED'|'CANCELLED'; deadlineAt: number }
interface ChestState { kind: 'STANDARD'|'BLACK'; availability: 'HIDDEN'|'AVAILABLE'|'OPENED'; loot: ChestLoot[]; refreshRound?: number }
type ChestLoot = { kind: 'ITEM'; stack: ItemStack } | { kind: 'COINS'; amount: number };
interface ShopOffer { id: string; itemId: ItemId; price: number; purchasedBy?: PlayerId }
interface ShopState {
  id: string; phase: 'PREP'|'PUBLIC'|'GRACE'; prepDeadlineAt: number;
  publicDeadlineAt?: number; privateDeadlineAt?: number;
  publicOffers: ShopOffer[]; privateOffers: Record<PlayerId, ShopOffer[]>;
  publicPurchasedBy: Record<PlayerId, boolean>; publicSkippedBy?: Record<PlayerId, boolean>;
  privatePurchasedBy: Record<PlayerId, boolean>; privateUnlockedBy: Record<PlayerId, boolean>;
  finishedBy: Record<PlayerId, boolean>; order: PlayerId[]; activeShopperIndex: number;
}
interface SpectatorState { playerId: PlayerId; since: number; reason: 'DEAD'|'EXITED' }
interface ActionEvent { id: string; sequence: number; at: number; kind: string; actorId?: PlayerId; targetIds: PlayerId[]; publicText: string; privatePayloads?: Record<PlayerId, unknown> }
interface ChatMessage { id: string; at: number; fromPlayerId: PlayerId; channel: 'GLOBAL'|'PRIVATE'; toPlayerId?: PlayerId; text: string }

interface RoomState {
  id: RoomId; code: string; revision: number; status: 'LOBBY'|'PLAYING'|'RESULTS'|'CLOSED';
  hostPlayerId: PlayerId; players: PlayerState[]; round?: RoundState; turn?: TurnState;
  pendingTrade?: TradeProposal; pendingThreat?: ThreatProposal; chests: ChestState[];
  shop?: ShopState; spectators: SpectatorState[]; events: ActionEvent[];
  wildcardDeck?: WildcardId[];
  wildcardDiscard?: Array<{ cardId: WildcardId; playerId: PlayerId; burned: boolean }>;
  wildcardUnlocked?: boolean; wildcardDrawUsedByPlayer?: Record<PlayerId, boolean>;
  pendingPrivateWildcardByPlayer?: Record<PlayerId, PendingWildcard>;
  roundIncomeAmount?: number; roundIncomeGrantedThrough?: number;
  createdAt: number; updatedAt: number;
}
```

## Projection contract

`PublicRoomView` contains no objective identity/progress, Pocket contents, private offers, private chat, or inspection results. `PlayerPrivateView` adds only the authenticated player's private fields. `SpectatorView` is emitted only after server-side verification that the requester is dead/exited and strips all action capabilities.

v14 exposes public shopping phase/deadlines/order/unlock/completion and public Downed scheduling boundaries. Objective failure status/reasons, named objective progress, ability-spent flags, hidden ammunition, and private market purchases remain owner-only (with existing verified-spectator access). Ordinary public event projections exclude `OBJECTIVE_FAILED`; authoritative and spectator history retain it. Explicitly revealed successful objectives retain their existing public exception. Acquisition provenance prevents resale during the same Intermission; it does not expose hidden items.

Every client command includes `roomId`, authenticated session identity, command type, payload, and optional expected revision. The server validates phase, actor, target, ownership, locks, capacity, and content rules before an atomic state transition.

## Round Income and Wildcards

`ROUND_INCOME = 2` and unlock Round 3 live in content constants. Match state snapshots the income amount and remembers the latest paid Round. Tycoon requires sustained 15 Gold plus one latched successful Trade. Only accepted Trades that actually transfer an item or Gold enter successful Trade history. Its private progress is `{ coins, required: 15, successfulTrades, requiredTrades: 1 }`.

`stimulant` is an Uncommon, one-use, Pocket-eligible item with base price 5 and `effect: { heal: 2, temporaryHpCap: 2 }`. `temporaryHp` defaults to zero and is included in every public player projection, independently of normal `hp`. Stimulant emits `STIMULANT_USED` with signed `hpChanges` and `temporaryHpChanges`; damage emits actual normal/temporary losses, while Medicine emits only normal healing. HEAL Task credit requires a positive normal HP change to another living player. Temporary HP is capped at two and zeroed on Downed/revival.

Phoenix's `phoenixMedicineOfferSeen` flag is match-scoped and never public. Its first eligible private market is checked once: if it owns no Medicine, one existing Medicine offer is priced at 4 or one offer is replaced by Medicine at 4. Normal later Medicine offers keep the Black Market markup. Owning Medicine skips the guarantee permanently; Downed players without a market retain their opportunity until eligible.

The authoritative deck is shuffled once with a seeded dedicated stream. No projection exposes its order. The public `wildcard` summary contains unlock state, remaining count, per-player draw-spent flags, and discard entries. Burned discard entries omit `cardId`. Public `pending` contains a player/card identity only after Use. The authenticated owner's private `pendingWildcard` supplies the private decision. Existing authorized spectator inspection history may disclose draw/burn identity; ordinary public events never receive those private payloads.

`DRAW_WILDCARD`, `USE_WILDCARD`, and `BURN_WILDCARD` accept empty payloads. `RESOLVE_WILDCARD` accepts only `targetId`, `instanceId`, `ownInstanceId`, and/or `pocketIndex` as applicable. The server chooses the card and random outcomes. Pending decisions lock other gameplay commands and use the existing turn deadline.

Structured event presentation records public item transfers/grants/destruction with quantities, signed Coin/HP changes, outcome, and a Search Warrant's explicitly revealed Pocket. This intentional public reveal does not modify ordinary Pocket projections. Server-local beta telemetry is not included in any player projection or exposed through a public endpoint.

## Compact pacing, private Tasks, and local tutorial

`TASKS_PER_ROUND = 2`, `TASK_REWARD = 2`, and the fourteen typed Task definitions live in content. Authoritative `sideJobsByPlayer` stores each owner's Round, reward, two jobs, completion flag, first-opportunity flag and once-per-Round replacement flag. `sideJobRoundId` identifies the current assignment Round. Each job stores typed identity, status, progress and irreversible prerequisite references. `PlayerPrivateView.tasks` contains only that owner's pair; public projections omit assignment/cancellation/replacement/expiry events and all task identity payloads.

The server accepts empty `PASS_TURN` and `SKIP_LOOT` commands through its existing strict schema. Primary resolution auto-advances; pending immediate loot optionally carries a deadline. Turn/response/overflow/prep/Public/private-grace defaults are 60/30/15/10/30/30 seconds in the shared content constants; immediate Downed loot is 15 seconds. Task generation excludes direct objective duplicates, prefers an available interaction, and replaces at most one Task before the first opportunity only when both become permanently impossible.

The browser-safe `@the-table/game/tutorial` entry imports engine/projections without RoomStore's Node credential code. `RoomState.mode = 'tutorial'` is created only by the local controller; network commands cannot set it. Tutorial progress/preferences and bounded telemetry are browser-local under versioned storage keys. No account, model API or external service is involved.
