import { canManageIntermission, canUsePrivateMarket, isPublicShopper } from './intermission.js';
import { canLeave } from './engine.js';
import { RoomError, type AuthorizedRoomView, type ActionEvent, type PlayerPrivateView, type PlayerState, type PublicPlayerView, type PublicRoomView, type RoomState } from './types.js';
function publicEvent(entry: ActionEvent): Omit<ActionEvent, 'privatePayloads'> {
  return { id: entry.id, sequence: entry.sequence, at: entry.at, kind: entry.kind, publicText: entry.publicText, targetIds: [...entry.targetIds],
    ...(entry.round === undefined ? {} : { round: entry.round }),
    ...(entry.actorId ? { actorId: entry.actorId } : {}),
    ...(entry.presentation ? { presentation: structuredClone(entry.presentation) } : {}) };
}

export function projectPublicRoom(room: RoomState): PublicRoomView {
  const publicPending = Object.entries(room.pendingPrivateWildcardByPlayer ?? {}).find(([, pending]) => pending.phase === 'TARGETING');
  return {
    ...(room.mode ? { mode: room.mode } : {}),
    id: room.id,
    code: room.code,
    revision: room.revision,
    status: room.status,
    hostPlayerId: room.hostPlayerId,
    ...(room.roundIncomeAmount === undefined ? {} : { roundIncomeAmount: room.roundIncomeAmount }),
    ...(room.wildcardDeck ? { wildcard: {
      unlocked: Boolean(room.wildcardUnlocked), remaining: room.wildcardDeck.length,
      drawUsedByPlayer: { ...room.wildcardDrawUsedByPlayer },
      discard: (room.wildcardDiscard ?? []).map(entry => ({ playerId: entry.playerId, burned: entry.burned, ...(entry.burned ? {} : { cardId: entry.cardId }) })),
      ...(publicPending ? { pending: { playerId: publicPending[0], cardId: publicPending[1].cardId } } : {}),
    } } : {}),
    players: room.players.map(player => projectPublicPlayer(player, Boolean(room.setup))),
    ...(room.setup ? { setup: { deadlineAt: room.setup.deadlineAt, lockedPlayerIds: [...room.setup.lockedPlayerIds] } } : {}),
    ...(room.round ? { round: structuredClone(room.round) } : {}),
    ...(room.turn ? { turn: structuredClone(room.turn) } : {}),
    ...(room.pendingTrade ? { pendingTrade: structuredClone(room.pendingTrade) } : {}),
    ...(room.pendingThreat ? { pendingThreat: {
      id: room.pendingThreat.id, actorId: room.pendingThreat.actorId, targetId: room.pendingThreat.targetId,
      mode: room.pendingThreat.mode, demandedItems: [...room.pendingThreat.demandedItems], demandedCoins: room.pendingThreat.demandedCoins,
      status: room.pendingThreat.status, deadlineAt: room.pendingThreat.deadlineAt,
      ...(room.pendingThreat.mode === 'OPEN' ? { committedItemId: room.pendingThreat.committedItemId, committedItemType: room.pendingThreat.committedItemType } : {}),
    } } : {}),
    ...(room.chests ? { chests: room.chests.map((chest) => ({ kind: chest.kind, availability: chest.availability, ...(chest.refreshRound === undefined ? {} : { refreshRound: chest.refreshRound }) })) } : {}),
    ...(room.shop ? { shop: { id: room.shop.id, phase: room.shop.phase, prepDeadlineAt: room.shop.prepDeadlineAt,
      ...(room.shop.publicDeadlineAt === undefined ? {} : { publicDeadlineAt: room.shop.publicDeadlineAt }),
      ...(room.shop.privateDeadlineAt === undefined ? {} : { privateDeadlineAt: room.shop.privateDeadlineAt }),
      privateUnlockedBy: { ...room.shop.privateUnlockedBy }, finishedBy: { ...room.shop.finishedBy },
      publicOffers: structuredClone(room.shop.publicOffers), publicPurchasedBy: { ...room.shop.publicPurchasedBy }, publicSkippedBy: { ...room.shop.publicSkippedBy }, order: [...room.shop.order], activeShopperIndex: room.shop.activeShopperIndex, ...(room.shop.orderReveal ? { orderReveal: structuredClone(room.shop.orderReveal) } : {}) } } : {}),
    ...(room.overflows ? { overflows: room.overflows.map((choice) => ({ id: choice.id, playerId: choice.playerId, deadlineAt: choice.deadlineAt })) } : {}),
    // The original public contract reveals completion, not permanent failure.
    // Keep private failures in authoritative/spectator history and owner payloads.
    ...(room.events ? { events: room.events.filter(entry => entry.kind !== 'OBJECTIVE_FAILED' && !['TASKS_ASSIGNED_PRIVATE', 'TASK_CANCELLED', 'TASK_REPLACED', 'TASKS_EXPIRED'].includes(entry.kind)).map(publicEvent) } : {}),
  };
}

export function projectPublicPlayer(player: PlayerState, hideInventory = false): PublicPlayerView {
  const objectiveCompleted = player.objective?.status === 'EXIT_READY' || player.objective?.status === 'BANKED';
  return {
    id: player.id,
    seat: player.seat,
    name: player.name,
    connection: player.connection,
    ...(player.roleId ? { roleId: player.roleId } : {}),
    ready: player.ready,
    hp: player.hp,
    temporaryHp: player.temporaryHp ?? 0,
    visibleInventory: player.inventory.visible.map(item => !hideInventory && item ? { ...item } : null),
    pocketOccupancy: player.inventory.pockets.map(pocket => !hideInventory && pocket.item !== null),
    coins: player.inventory.coins,
    life: player.life,
    ...(player.conceded ? { conceded: true } : {}),
    ...(player.downed ? { downed: structuredClone(player.downed) } : {}),
    objectiveCompleted,
    score: player.score,
    ...(player.statuses ? { statuses: structuredClone(player.statuses) } : {}),
    ...(player.exitOrder === undefined ? {} : { exitOrder: player.exitOrder }),
    ...(player.objective?.revealed ? { revealedObjective: structuredClone(player.objective) } : {}),
  };
}

export function projectPrivatePlayer(player: PlayerState, room?: RoomState): PlayerPrivateView {
  return {
    playerId: player.id,
    ...(room?.sideJobsByPlayer?.[player.id] ? { tasks: structuredClone(room.sideJobsByPlayer[player.id]) } : {}),
    ...(room?.pendingPrivateWildcardByPlayer?.[player.id] ? { pendingWildcard: { ...room.pendingPrivateWildcardByPlayer[player.id]! } } : {}),
    ...(room?.setup ? { setup: { items: player.inventory.visible.flatMap(item => item ? [{ ...item }] : []), locked: room.setup.lockedPlayerIds.includes(player.id), ...(room.setup.bonusPlayerId === player.id ? { bonusItemInstanceId: room.setup.bonusItemInstanceId } : {}) } } : {}),
    pockets: player.inventory.pockets.map((pocket) => ({
      ...pocket,
      item: pocket.item ? { ...pocket.item } : null,
    })),
    ...(player.objective ? { objective: structuredClone(player.objective) } : {}),
    ...(player.abilities ? { abilities: { ...player.abilities } } : {}),
    ...(player.turnsStarted === undefined ? {} : { turnsStarted: player.turnsStarted }),
    ...(room?.shop ? { intermission: { privatePurchased: Boolean(room.shop.privatePurchasedBy[player.id]), finished: Boolean(room.shop.finishedBy[player.id]) } } : {}),
    ...(room?.round?.phase === 'INTERMISSION' && room.shop?.privateUnlockedBy[player.id] ? { blackMarket: structuredClone(room.shop.privateOffers[player.id] ?? []) } : {}),
    ...(room ? {
      inspections: (room.events ?? []).flatMap((entry) => entry.privatePayloads?.[player.id] === undefined ? [] : [{ eventId: entry.id, payload: structuredClone(entry.privatePayloads[player.id]) }]),
      overflows: structuredClone((room.overflows ?? []).filter((choice) => choice.playerId === player.id)),
      capabilities: playerCapabilities(room, player),
    } : {}),
  };
}

export function projectSpectatorRoom(room: RoomState, requesterId: string): import('./types.js').SpectatorView {
  const requester = room.players.find((candidate) => candidate.id === requesterId);
  if (!requester || (requester.life !== 'DEAD' && requester.life !== 'EXITED')) throw new RoomError('INVALID_SESSION', 'Spectator access requires permanent death or exit.');
  return {
    public: projectPublicRoom(room),
    players: room.players.map((player) => ({ public: projectPublicPlayer(player), private: { ...projectPrivatePlayer(player, room), capabilities: [] } })),
    chests: (room.chests ?? []).map((chest) => ({ kind: chest.kind, availability: chest.availability, loot: structuredClone(chest.loot), ...(chest.refreshRound === undefined ? {} : { refreshRound: chest.refreshRound }) })),
    ...(room.shop ? { shop: structuredClone(room.shop) } : {}),
    events: structuredClone(room.events ?? []),
    capabilities: [],
  };
}
export function projectAuthorizedRoom(room: RoomState, requesterId: string): AuthorizedRoomView {
  const player = room.players.find((candidate) => candidate.id === requesterId);
  if (!player) throw new RoomError('INVALID_SESSION', 'Player is not in this room.');
  return { public: projectPublicRoom(room), private: projectPrivatePlayer(player, room) };
}


function playerCapabilities(room: RoomState, player: PlayerState): string[] {
  if (player.connection !== 'CONNECTED' || (player.life !== 'ACTIVE' && player.life !== 'DOWNED')) return [];
  if (room.status === 'LOBBY') return ['CHAT', 'CLAIM_ROLE', 'READY', ...(room.hostPlayerId === player.id ? ['START_MATCH'] : [])];
  if (room.status !== 'PLAYING') return room.hostPlayerId === player.id ? ['REMATCH'] : [];
  const capabilities = ['CHAT'];
  if (room.setup) return room.setup.lockedPlayerIds.includes(player.id) ? capabilities : [...capabilities, 'LOCK_SETUP'];
  if (Object.keys(room.pendingPrivateWildcardByPlayer ?? {}).length) {
    const pending = room.pendingPrivateWildcardByPlayer?.[player.id];
    return pending ? [...capabilities, ...(pending.phase === 'DRAWN' ? ['USE_WILDCARD', 'BURN_WILDCARD'] : ['RESOLVE_WILDCARD'])] : capabilities;
  }
  if (room.pendingTrade) return room.pendingTrade.targetId === player.id ? [...capabilities, 'RESPOND_TRADE'] : capabilities;
  if (room.pendingThreat) return room.pendingThreat.targetId === player.id ? [...capabilities, 'RESPOND_THREAT'] : capabilities;
  if (room.overflows?.some(choice => choice.playerId === player.id)) return [...capabilities, 'OVERFLOW_CHOICE'];
  if (room.overflows?.length && room.round?.phase !== 'INTERMISSION') return capabilities;
  if (canManageIntermission(room, player)) {
    capabilities.push('POCKET', 'ASSIGN_SAFE', 'SELL');
    if (isPublicShopper(room, player)) capabilities.push('BUY', 'BUY_PUBLIC', 'SKIP_PUBLIC_SHOP');
    if (canUsePrivateMarket(room, player)) {
      capabilities.push('FINISH_SHOPPING');
      if (!room.shop!.privatePurchasedBy[player.id]) {
        capabilities.push('BUY', 'BUY_BLACK');
        const ownsIdol = [...player.inventory.visible, ...player.inventory.pockets.map(pocket => pocket.item)].some(item => item?.itemId === 'brass-idol');
        if (ownsIdol && player.abilities?.brassIdolRound !== room.round?.number) capabilities.push('REROLL_MARKET');
      }
    }
  }
  if (room.turn?.activeSeat === player.seat) {
    capabilities.push('END_TURN');
    if (!room.turn.primaryUsed) capabilities.push('PASS_TURN');
    if (room.mode === 'tutorial') capabilities.push('POCKET');
    if (!room.turn.primaryUsed) {
      if (player.life === 'ACTIVE' && !room.turn.startedDowned && room.wildcardUnlocked && room.wildcardDeck?.length && !room.wildcardDrawUsedByPlayer?.[player.id]) capabilities.push('DRAW_WILDCARD');
      if (player.life === 'ACTIVE' || [...player.inventory.visible, ...player.inventory.pockets.map(pocket => pocket.item)].some(item => item?.itemId === 'medicine')) capabilities.push('USE_ITEM');
      if (player.life === 'ACTIVE' && !room.turn.startedDowned && !player.statuses?.some((status) => status.kind === 'HANDCUFFED' && status.appliedTurn < room.turn!.serial)) capabilities.push('TRADE', 'THREAT');
    }
    if (player.life === 'ACTIVE' && !room.turn.startedDowned && !room.turn.downedInteractionUsed) capabilities.push('DOWNED_INTERACTION');
    if (canLeave(room, player)) capabilities.push('LEAVE_TABLE', 'STAY');
    if (player.life === 'ACTIVE' && !room.turn.startedDowned && player.objective?.status === 'FAILED') capabilities.push('CONCEDE');
  }
  if (room.turn?.immediateLoot?.playerId === player.id) capabilities.push('LOOT_DOWNED', 'SKIP_LOOT');
  if (player.life === 'ACTIVE' && player.roleId === 'locksmith' && player.abilities?.locksmithRound !== room.round?.number && room.chests?.some((chest) => chest.kind === 'STANDARD' && chest.availability === 'AVAILABLE')) capabilities.push('INSPECT_CHEST');
  return capabilities;
}
