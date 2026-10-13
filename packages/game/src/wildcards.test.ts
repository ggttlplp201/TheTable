import { describe, expect, it } from 'vitest';
import { WILDCARDS, ROUND_INCOME } from '@the-table/content';
import { applyCommand, applyTimeout, assertRoomInvariants, evaluateObjectives, getNextDeadline, projectAuthorizedRoom, projectPublicRoom, projectSpectatorRoom, resetMatch, setConnection, startMatch, type GameCommand, type PlayerState, type RoomState, type WildcardId } from './index.js';
import { acquire, stack, syncEquipment } from './inventory.js';
import { damage } from './combat.js';
import { grantRoundIncome } from './wildcards.js';
import { ITEM_BY_ID } from './content.js';

function game(seed = 77): RoomState {
  const lobby: RoomState = { id: 'wildcards', code: 'ABC234', revision: 0, status: 'LOBBY', hostPlayerId: 'p0', createdAt: 0, updatedAt: 0,
    players: ['enforcer', 'medic', 'smuggler', 'locksmith'].map((roleId, seat) => ({
      id: `p${seat}`, seat: seat as PlayerState['seat'], name: `Player ${seat}`, normalizedName: `player ${seat}`, connection: 'CONNECTED', roleId: roleId as NonNullable<PlayerState['roleId']>, ready: true,
      hp: 5, score: 0, life: 'ACTIVE', inventory: { visible: Array(6).fill(null), pockets: [{ source: 'DEFAULT', protectedBySafe: false, item: null }], coins: 0 },
    })) };
  let room = startMatch(lobby, { seed, now: 1 });
  room = applyTimeout(room, room.setup!.deadlineAt);
  for (const [index, player] of room.players.entries()) {
    player.inventory = { visible: Array(6).fill(null), pockets: [{ source: 'DEFAULT', protectedBySafe: false, item: null }], coins: 0 };
    player.safeAssignments = {};
    player.objective = { objectiveId: ['escapist', 'collector', 'tycoon', 'arsenal'][index]!, status: 'ACTIVE', progress: {}, rewardGranted: false };
  }
  return room;
}
const cmd = (room: RoomState, command: GameCommand, actor = 'p0') => applyCommand(room, actor, command, room.updatedAt + 1);
function give(room: RoomState, seat: number, itemId: string, quantity = 1) {
  const item = stack(room, itemId, quantity);
  room.match!.artifactPool = room.match!.artifactPool.filter(id => id !== itemId);
  if (itemId === 'passage-token') room.match!.passageTokenAvailable = false;
  acquire(room, room.players[seat]!, item, room.updatedAt);
  return item;
}
function ready(cardId: WildcardId, room = game()): RoomState {
  for (const player of room.players) if (player.downed) player.downed.expiresRound += 3 - room.round!.number;
  room.round!.number = 3; room.wildcardUnlocked = true;
  room.wildcardDeck = [cardId, ...room.wildcardDeck!.filter(id => id !== cardId)];
  return cmd(room, { type: 'DRAW_WILDCARD' });
}
function use(cardId: WildcardId, room = game()): RoomState { return cmd(ready(cardId, room), { type: 'USE_WILDCARD' }); }
function down(room: RoomState, seat: number) { damage(room, room.players[0]!, room.players[seat]!, 5, room.updatedAt, false); }
function next(room: RoomState): RoomState {
  if (room.round!.phase === 'INTERMISSION') return applyTimeout(room, getNextDeadline(room)!);
  return cmd(room, { type: 'END_TURN' }, room.players.find(player => player.seat === room.turn!.activeSeat)!.id);
}

describe('Round Income and Tycoon', () => {
  it('pays exactly once before shop opens and updates Tycoon against 15', () => {
    let room = game(); room.players[2]!.inventory.coins = 12;
    room.match!.history.trades.push({ actorId: 'p0', targetId: 'p2', round: 1, sequence: 1 });
    const before = room.players.map(player => player.inventory.coins);
    for (let i = 0; i < 4; i++) room = next(room);
    expect(room.round!.phase).toBe('INTERMISSION');
    expect(room.players.map(player => player.inventory.coins)).toEqual(before.map(coins => coins + ROUND_INCOME));
    const income = room.events!.findIndex(event => event.kind === 'ROUND_INCOME_GRANTED');
    expect(income).toBeGreaterThan(-1);
    expect(room.events!.slice(income + 1).some(event => event.kind.includes('INTERMISSION'))).toBe(true);
    grantRoundIncome(room, room.updatedAt); expect(room.players[2]!.inventory.coins).toBe(14);
    room.round!.number = 2; evaluateObjectives(room, room.updatedAt);
    expect(room.players[2]!.objective!.status).toBe('ACTIVE');
    room.players[2]!.inventory.coins = 15; evaluateObjectives(room, room.updatedAt);
    expect(room.players[2]!.inventory.coins).toBe(18);
    room.players[2]!.inventory.coins = 14; evaluateObjectives(room, room.updatedAt);
    expect(room.players[2]!.objective!.status).toBe('ACTIVE');
    room.players[2]!.inventory.coins = 15; evaluateObjectives(room, room.updatedAt);
    expect(room.players[2]!.inventory.coins).toBe(15);
  });
  it('includes Downed and disconnected living players, excludes dead/exited/conceded', () => {
    for (const excluded of ['DEAD', 'EXITED', 'CONCEDED'] as const) {
      const room = game(); down(room, 1); room.players[2]!.connection = 'DISCONNECTED';
      if (excluded === 'CONCEDED') room.players[3]!.conceded = true; else room.players[3]!.life = excluded;
      grantRoundIncome(room, room.updatedAt);
      expect(room.players.map(player => player.inventory.coins)).toEqual([2, 2, 2, 0]);
    }
  });
  it('pays a completed final round before forced objective closure', () => {
    let room = game(); room.round!.number = 4;
    for (const [index, player] of room.players.entries()) {
      if (index) player.objective!.status = 'FAILED';
      else player.objective = { objectiveId: 'guardian', status: 'ACTIVE', progress: {}, rewardGranted: false, targetPlayerId: 'p1' };
    }
    for (let i = 0; i < 4; i++) room = next(room);
    expect(room.status).toBe('RESULTS');
    expect(room.events!.filter(entry => entry.kind === 'ROUND_INCOME_GRANTED')).toHaveLength(1);
    expect(room.events!.find(entry => entry.kind === 'ROUND_INCOME_GRANTED')!.targetIds).toEqual(['p0', 'p1', 'p2', 'p3']);
  });
});

describe('Wildcard lifecycle, privacy and deterministic replay', () => {
  it('shuffles 10 unique cards at setup, unlocks only at Round 3, persists and resets', () => {
    let room = game(); expect(room.wildcardDeck).toHaveLength(10); expect(new Set(room.wildcardDeck).size).toBe(10);
    expect(room.wildcardDeck).toEqual(game().wildcardDeck); expect(room.wildcardDeck).not.toEqual(game(78).wildcardDeck);
    for (let guard = 0; room.round!.number < 3 && guard < 50; guard++) {
      expect(projectPublicRoom(room).wildcard!.unlocked).toBe(false); room = next(room);
    }
    expect(room.round!.number).toBe(3); expect(room.wildcardUnlocked).toBe(true);
    while (room.round!.number < 4) room = next(room);
    expect(room.wildcardUnlocked).toBe(true); expect(room.events!.filter(event => event.kind === 'WILDCARD_DECK_UNLOCKED')).toHaveLength(1);
    room.status = 'RESULTS'; room.round!.phase = 'RESULTS'; delete room.turn;
    room = resetMatch(room, room.updatedAt + 1);
    expect(room.wildcardDeck).toBeUndefined(); expect(room.pendingPrivateWildcardByPlayer).toBeUndefined();
    room.players.forEach(player => { player.ready = true; });
    room = startMatch(room, { seed: 77, now: room.updatedAt + 1 });
    expect(room.wildcardDeck).toHaveLength(10); expect(Object.values(room.wildcardDrawUsedByPlayer!)).toEqual([false, false, false, false]);
  });
  it('rejects early, off-turn, Downed and spent-primary draws transactionally', () => {
    let room = game(); expect(() => cmd(room, { type: 'DRAW_WILDCARD' })).toThrow('Round 3');
    room.round!.number = 3; room.wildcardUnlocked = true;
    expect(() => cmd(room, { type: 'DRAW_WILDCARD' }, 'p1')).toThrow('not your turn');
    room.turn!.primaryUsed = true; expect(() => cmd(room, { type: 'DRAW_WILDCARD' })).toThrow('Primary Action');
    room.turn!.primaryUsed = false; down(room, 0); room.turn!.startedDowned = true;
    expect(() => cmd(room, { type: 'DRAW_WILDCARD' })).toThrow('Downed'); expect(room.wildcardDeck).toHaveLength(10);
  });
  it('commits action/opportunity privately, disallows cancellation and hides burned identity', () => {
    let room = ready('seize');
    expect(room.turn!.primaryUsed).toBe(true); expect(room.wildcardDrawUsedByPlayer!.p0).toBe(true);
    expect(projectAuthorizedRoom(room, 'p0').private.pendingWildcard).toEqual({ cardId: 'seize', phase: 'DRAWN' });
    const outsider = projectAuthorizedRoom(room, 'p1');
    expect(outsider.private.pendingWildcard).toBeUndefined(); expect(JSON.stringify(outsider)).not.toContain('seize');
    expect(JSON.stringify(outsider)).not.toContain('wildcardDeck');
    for (const type of ['END_TURN', 'LEAVE_TABLE', 'CONCEDE', 'STAY', 'INSPECT_CHEST', 'DRAW_WILDCARD'] as const) expect(() => cmd(room, { type })).toThrow('Resolve the drawn Wildcard');
    room = cmd(room, { type: 'BURN_WILDCARD' });
    expect(room.turn!.activeSeat).toBe(1); expect(room.turn!.deadlineAt).toBe(room.updatedAt + 60_000); expect(room.players.map(player => player.inventory.coins)).toEqual([0, 0, 0, 0]);
    expect(projectPublicRoom(room).wildcard!.discard).toEqual([{ playerId: 'p0', burned: true }]);
    expect(JSON.stringify(projectAuthorizedRoom(room, 'p1'))).not.toContain('seize');
    room.players[3]!.life = 'DEAD';
    expect(JSON.stringify(projectSpectatorRoom(room, 'p3'))).toContain('seize');
    expect(() => projectSpectatorRoom(room, 'p1')).toThrow();
    while (room.turn?.activeSeat !== 0) room = next(room);
    expect(() => cmd(room, { type: 'DRAW_WILDCARD' })).toThrow('spent');
    expect(room.wildcardDrawUsedByPlayer!.p1).toBe(false);
  });
  it.each(['TIMEOUT', 'DISCONNECT'] as const)('%s burns private draw but expires public targeting without effect', cause => {
    for (const used of [false, true]) {
      let room = game(); give(room, 1, 'knife'); room = ready('seize', room);
      if (used) room = cmd(room, { type: 'USE_WILDCARD' });
      const targetItems = structuredClone(room.players[1]!.inventory);
      const rng = room.match!.rngState;
      room = cause === 'TIMEOUT' ? applyTimeout(room, room.turn!.deadlineAt) : setConnection(room, 'p0', 'DISCONNECTED', room.updatedAt + 1);
      expect(room.pendingPrivateWildcardByPlayer).toEqual({}); expect(room.players[1]!.inventory).toEqual(targetItems); expect(room.match!.rngState).toBe(rng);
      const entry = room.events!.filter(event => event.kind === (used ? 'WILDCARD_RESOLVED' : 'WILDCARD_BURNED')).at(-1)!;
      expect(entry.presentation!.resolution).toBe(cause); expect(entry.presentation?.wildcardOutcome).toBe(used ? 'EXPIRED' : undefined);
      if (cause === 'DISCONNECT') { room = setConnection(room, 'p0', 'CONNECTED', room.updatedAt + 1); expect(projectAuthorizedRoom(room, 'p0').private.pendingWildcard).toBeUndefined(); }
    }
  });
  it('reconnect projection retains an unresolved choice until disconnect policy burns it', () => {
    const room = ready('windfall');
    expect(projectAuthorizedRoom(structuredClone(room), 'p0').private.pendingWildcard).toEqual({ cardId: 'windfall', phase: 'DRAWN' });
    expect(projectAuthorizedRoom(room, 'p0').private.capabilities).toEqual(['CHAT', 'USE_WILDCARD', 'BURN_WILDCARD']);
  });
  it.each(['seize', 'destroy', 'forced-exchange', 'search-warrant'] as const)('%s with no target publicly spends without effect', cardId => {
    const room = use(cardId); expect(room.pendingPrivateWildcardByPlayer).toEqual({});
    expect(room.events!.filter(event => event.kind === 'WILDCARD_RESOLVED').at(-1)!.presentation).toMatchObject({ wildcardId: cardId, wildcardOutcome: 'NO_LEGAL_TARGET' });
    expect(room.wildcardDiscard).toEqual([{ cardId, playerId: 'p0', burned: false }]);
  });
  it('replays all seeded random effects identically', () => {
    for (const cardId of ['supply-drop', 'shatter', 'scramble', 'redistribution'] as const) {
      const room = game(); for (let seat = 0; seat < 4; seat++) { give(room, seat, 'knife'); give(room, seat, 'medicine'); }
      expect(use(cardId, structuredClone(room))).toEqual(use(cardId, structuredClone(room)));
    }
  });
});

describe('targeted Wildcards', () => {
  it('reveals Use before targeting, rejects invalid targets without rollback or item mutation', () => {
    let room = game(); const knife = give(room, 1, 'knife'); const pocket = stack(room, 'poison'); room.players[1]!.inventory.pockets[0]!.item = pocket;
    room = ready('seize', room);
    expect(() => cmd(room, { type: 'RESOLVE_WILDCARD', targetId: 'p1', instanceId: knife.instanceId })).toThrow('Choose Use');
    room = cmd(room, { type: 'USE_WILDCARD' });
    expect(projectPublicRoom(room).wildcard!.pending).toEqual({ playerId: 'p0', cardId: 'seize' });
    expect(() => cmd(room, { type: 'BURN_WILDCARD' })).toThrow('cannot be burned');
    const snapshot = structuredClone(room);
    for (const [targetId, instanceId] of [['p0', knife.instanceId], ['p1', pocket.instanceId], ['missing', knife.instanceId]] as const) expect(() => cmd(room, { type: 'RESOLVE_WILDCARD', targetId, instanceId })).toThrow();
    expect(room).toEqual(snapshot);
    room = cmd(room, { type: 'RESOLVE_WILDCARD', targetId: 'p1', instanceId: knife.instanceId });
    expect(room.players[0]!.inventory.visible).toContainEqual(knife); expect(room.players[1]!.inventory.pockets[0]!.item).toEqual(pocket);
  });
  it.each(['DOWNED', 'DEAD', 'EXITED', 'CONCEDED'] as const)('excludes %s from hostile targeting', state => {
    let room = game(); give(room, 1, 'knife');
    if (state === 'DOWNED') down(room, 1); else if (state === 'CONCEDED') room.players[1]!.conceded = true; else room.players[1]!.life = state;
    room = use('seize', room); expect(room.events!.filter(event => event.kind === 'WILDCARD_RESOLVED').at(-1)!.presentation!.wildcardOutcome).toBe('NO_LEGAL_TARGET');
  });
  it('allows immediate targeting of a disconnected living player and syncs stolen Safe protection', () => {
    let room = game(); const safe = give(room, 1, 'safe'); room.players[1]!.connection = 'DISCONNECTED';
    expect(room.players[1]!.inventory.pockets[0]!.protectedBySafe).toBe(true);
    room = use('seize', room);
    room = cmd(room, { type: 'RESOLVE_WILDCARD', targetId: 'p1', instanceId: safe.instanceId });
    expect(room.players[1]!.inventory.pockets[0]!.protectedBySafe).toBe(false);
    expect(room.players[0]!.inventory.pockets[0]!.protectedBySafe).toBe(true);
  });
  it('spends with no effect when all targets disappear after Use but refuses an omitted legal target', () => {
    let room = game(); give(room, 1, 'knife'); room = use('seize', room);
    expect(() => cmd(room, { type: 'RESOLVE_WILDCARD' })).toThrow('Choose another');
    room.players[1]!.inventory.visible.fill(null);
    room = cmd(room, { type: 'RESOLVE_WILDCARD' });
    expect(room.events!.filter(event => event.kind === 'WILDCARD_RESOLVED').at(-1)!.presentation!.wildcardOutcome).toBe('NO_LEGAL_TARGET');
    expect(room.wildcardDiscard).toEqual([{ cardId: 'seize', playerId: 'p0', burned: false }]);
  });
  it('Seize transfers visible equipment, syncs Safe/Bag and uses ordinary overflow', () => {
    let room = game(); const bag = give(room, 1, 'bag'); const hidden = stack(room, 'poison'); room.players[1]!.inventory.pockets[1]!.item = hidden;
    for (let i = 0; i < 6; i++) give(room, 0, 'knife');
    room = use('seize', room); room = cmd(room, { type: 'RESOLVE_WILDCARD', targetId: 'p1', instanceId: bag.instanceId });
    expect(room.overflows).toHaveLength(1); expect(room.overflows![0]!.incoming).toEqual(bag);
    expect(room.players[1]!.inventory.pockets).toHaveLength(1); expect(room.players[1]!.inventory.visible).toContainEqual(hidden);
    room = cmd(room, { type: 'OVERFLOW_CHOICE', overflowId: room.overflows![0]!.id, replaceInstanceId: room.players[0]!.inventory.visible[0]!.instanceId });
    expect(room.players[0]!.inventory.pockets).toHaveLength(2); assertRoomInvariants(room);
  });
  it.each(['brass-idol', 'passage-token'])('Destroy returns %s to its normal pool', itemId => {
    let room = game(); const item = give(room, 1, itemId); room = use('destroy', room);
    room = cmd(room, { type: 'RESOLVE_WILDCARD', targetId: 'p1', instanceId: item.instanceId });
    expect(room.players[1]!.inventory.visible.every(item => !item)).toBe(true);
    if (itemId === 'brass-idol') expect(room.match!.artifactPool).toContain(itemId); else expect(room.match!.passageTokenAvailable).toBe(true);
  });
  it('Forced Exchange validates both items, then swaps Bags atomically without ejecting locked Pockets', () => {
    let room = game(); const a = give(room, 0, 'bag'), b = give(room, 1, 'bag');
    room.players[0]!.inventory.pockets[1]!.item = stack(room, 'poison'); room.players[1]!.inventory.pockets[1]!.item = stack(room, 'medicine');
    const pockets = room.players.slice(0, 2).map(player => structuredClone(player.inventory.pockets));
    room = use('forced-exchange', room); const snapshot = structuredClone(room);
    expect(() => cmd(room, { type: 'RESOLVE_WILDCARD', targetId: 'p1', instanceId: b.instanceId, ownInstanceId: 'bad' })).toThrow(); expect(room).toEqual(snapshot);
    room = cmd(room, { type: 'RESOLVE_WILDCARD', targetId: 'p1', instanceId: b.instanceId, ownInstanceId: a.instanceId });
    expect(room.players.slice(0, 2).map(player => player.inventory.pockets)).toEqual(pockets);
    expect(room.players[0]!.inventory.visible).toContainEqual(b); expect(room.players[1]!.inventory.visible).toContainEqual(a); expect(room.overflows).toHaveLength(0);
  });
  it.each([false, true])('Search Warrant reveals exact contents only when Safe protection is %s', safe => {
    let room = game(); const item = stack(room, 'bullet', 3); room.players[1]!.inventory.pockets[0]!.item = item;
    if (safe) give(room, 1, 'safe'); room = use('search-warrant', room);
    room = cmd(room, { type: 'RESOLVE_WILDCARD', targetId: 'p1', pocketIndex: 0 });
    const entry = projectPublicRoom(room).events!.filter(event => event.kind === 'WILDCARD_RESOLVED').at(-1)!;
    expect(entry.presentation!.wildcardOutcome).toBe(safe ? 'BLOCKED' : 'APPLIED');
    expect(entry.presentation!.revealedPocket).toEqual(safe ? undefined : { playerId: 'p1', pocketIndex: 0, item });
    if (safe) expect(JSON.stringify(entry)).not.toContain('bullet');
    expect(room.players[1]!.inventory.pockets[0]!.item).toEqual(item);
  });
});

describe('global Wildcards', () => {
  it('Supply Drop gives only Common/Uncommon items to every living active player with independent overflow', () => {
    for (let seed = 1; seed <= 40; seed++) {
      let room = game(seed); down(room, 1); room.players[2]!.life = 'DEAD'; room.players[3]!.life = 'EXITED';
      for (const seat of [0, 1]) for (let i = 0; i < 6; i++) give(room, seat, 'knife');
      room = use('supply-drop', room);
      expect(room.overflows!.map(choice => choice.playerId)).toEqual(['p0', 'p1']);
      expect(room.overflows!.every(choice => ['COMMON', 'UNCOMMON'].includes(ITEM_BY_ID[choice.incoming.itemId]!.rarity))).toBe(true);
    }
  });
  it('Shatter includes user and Downed, protects Pockets and returns unique items', () => {
    let room = game(); const artifact = give(room, 0, 'glass-eye'); give(room, 1, 'passage-token'); down(room, 1);
    room.players[0]!.inventory.pockets[0]!.item = stack(room, 'poison');
    room = use('shatter', room);
    expect(room.players[0]!.inventory.visible.every(item => !item)).toBe(true); expect(room.players[0]!.inventory.pockets[0]!.item!.itemId).toBe('poison');
    expect(room.match!.artifactPool).toContain(artifact.itemId); expect(room.match!.passageTokenAvailable).toBe(true);
    expect(room.events!.filter(event => event.kind === 'WILDCARD_RESOLVED').at(-1)!.presentation!.itemsDestroyed).toHaveLength(2);
  });
  it('Windfall includes living Downed/disconnected, skips conceded and stacks with income', () => {
    let room = game(); down(room, 1); room.players[2]!.connection = 'DISCONNECTED'; room.players[3]!.conceded = true;
    room = use('windfall', room); expect(room.players.map(player => player.inventory.coins)).toEqual([2, 2, 2, 0]);
    grantRoundIncome(room, room.updatedAt); expect(room.players.map(player => player.inventory.coins)).toEqual([4, 4, 4, 0]);
  });
  it('Redistribution chooses the poorest before simultaneous transfers, skips zeros and deterministically breaks ties', () => {
    for (const coins of [[0, 0, 3, 5], [1, 2, 3, 4], [0, 0, 0, 0]]) {
      let room = game(); room.players.forEach((player, index) => { player.inventory.coins = coins[index]!; });
      room = use('redistribution', room);
      const changes = room.events!.filter(event => event.kind === 'WILDCARD_RESOLVED').at(-1)!.presentation!.coinChanges!;
      const recipient = changes.at(-1)!; expect(coins[Number(recipient.playerId.slice(1))]).toBe(Math.min(...coins));
      expect(room.players.reduce((sum, player) => sum + player.inventory.coins, 0)).toBe(coins.reduce((sum, value) => sum + value, 0));
      expect(changes.filter(change => change.amount < 0)).toHaveLength(coins.filter(value => value > 0).length - (Math.min(...coins) > 0 ? 1 : 0));
    }
  });
  it('Scramble selects all items first, skips inactive seats, passes to Downed empty seat and preserves unique pools', () => {
    let room = game(); const artifact = give(room, 0, 'brass-idol'), token = give(room, 2, 'passage-token');
    down(room, 2); room.players[1]!.life = 'EXITED';
    room = use('scramble', room);
    expect(room.players[0]!.inventory.visible.every(item => !item)).toBe(true);
    expect(room.players[2]!.inventory.visible).toContainEqual(artifact); expect(room.players[3]!.inventory.visible).toContainEqual(token);
    expect(room.match!.artifactPool).not.toContain('brass-idol'); expect(room.match!.passageTokenAvailable).toBe(false);
    expect(room.events!.filter(event => event.kind === 'WILDCARD_RESOLVED').at(-1)!.presentation!.itemsTransferred).toHaveLength(2); assertRoomInvariants(room);
  });
  it('Second Chance caps healing, does not revive Downed, preserves Poison and skips inactive players', () => {
    let room = game(); room.players[0]!.hp = 4; down(room, 1); room.players[3]!.life = 'DEAD';
    room.players[0]!.statuses = [{ id: 'poison', kind: 'POISON', sourcePlayerId: 'p2', remainingTurns: 3, appliedTurn: 1 }];
    room = use('second-chance', room);
    expect(room.players.map(player => player.hp)).toEqual([5, 0, 5, 5]); expect(room.players[1]!.life).toBe('DOWNED');
    expect(room.players[0]!.statuses).toHaveLength(1);
  });
});
