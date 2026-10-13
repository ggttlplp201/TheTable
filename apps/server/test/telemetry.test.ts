import { describe, expect, it, vi } from 'vitest';
import { RoomStore } from '@the-table/game';
import { MatchTelemetryRecorder, TelemetryRoomStoreAdapter } from '../src/telemetry.js';

function fixture() {
  let now = 1;
  const game = new TelemetryRoomStoreAdapter(new RoomStore({ now: () => now, issueSessions: false }), () => 42);
  const admission = game.create('Host'); const code = admission.room.code;
  game.join(code, 'Medic'); game.join(code, 'Smuggler');
  const room = () => game.read(code)!;
  const ids = room().players.map(player => player.id);
  const send = (actorId: string, type: string, payload: Record<string, unknown> = {}) => game.command(code, actorId, { type, payload }, ++now);
  for (const [index, actorId] of ids.entries()) {
    send(actorId, 'CLAIM_ROLE', { roleId: ['enforcer', 'medic', 'smuggler'][index] });
    send(actorId, 'READY', { ready: true });
  }
  send(ids[0]!, 'START_MATCH');
  for (const actorId of ids) send(actorId, 'LOCK_SETUP', { instanceId: room().players.find(player => player.id === actorId)!.inventory.visible[2]!.instanceId });
  const timeout = () => { const deadline = game.deadlines(code)[0]!; now = deadline.at; game.timeout(code, deadline, now); };
  const report = () => game.telemetry.exportAdminTelemetry(code)[0]!;
  return { game, code, ids, room, send, timeout, report, now: () => now };
}

describe('server-only v14 telemetry', () => {
  it('distinguishes deliberate Primary Actions, passes, timeout Skips, and rejected attempts', () => {
    const f = fixture();
    const before = structuredClone(f.room());
    expect(() => f.send(f.ids[1]!, 'PASS_TURN')).toThrow();
    expect(f.room()).toEqual(before);
    const pistol = f.room().players[0]!.inventory.visible.find(item => item?.itemId === 'pistol')!;
    f.send(f.ids[0]!, 'USE_ITEM', { instanceId: pistol.instanceId, targetId: f.ids[1] });
    f.send(f.ids[1]!, 'PASS_TURN');
    f.timeout();
    expect(f.report()).toMatchObject({ failedCommandCount: 1, passTurnCount: 1, normalTurnTimeoutCount: 1, meaningfulActionRate: 1 / 3 });
    expect(f.report().decisions.map(decision => ({ meaningful: decision.meaningful, normalTurn: decision.normalTurn }))).toEqual([
      { meaningful: true, normalTurn: true }, { meaningful: false, normalTurn: true }, { meaningful: false, normalTurn: true },
    ]);
    expect(JSON.stringify(f.game.project(f.code, f.ids[0]!, false))).not.toContain('failedCommandCount');
    expect(f.game.telemetryFailureCount).toBe(0);
  });

  it('records normal healing, temporary health and absorbed damage separately from Medicine', () => {
    const f = fixture();
    for (const [index, player] of f.room().players.entries()) player.objective = { objectiveId: ['collector', 'phoenix', 'escapist'][index]!, status: 'ACTIVE', progress: {}, rewardGranted: false };
    const [actor, target, attacker] = f.room().players;
    target!.hp = 4;
    actor!.inventory.visible[3] = { instanceId: 'telemetry-stimulant', itemId: 'stimulant', quantity: 1 };
    attacker!.inventory.visible[3] = { instanceId: 'telemetry-knife', itemId: 'knife', quantity: 1 };
    f.send(actor!.id, 'USE_ITEM', { instanceId: 'telemetry-stimulant', targetId: target!.id });
    expect(f.report().stimulant).toMatchObject({ uses: 1, normalHpRestored: 1, temporaryHpGenerated: 1, temporaryHpAbsorbed: 0 });
    expect(f.report().players[0]!.medicineUses).toBe(0);
    expect(f.report().players[0]!.turnsWithNoGameplayAction).toBe(0);
    f.send(target!.id, 'PASS_TURN');
    f.send(attacker!.id, 'USE_ITEM', { instanceId: 'telemetry-knife', targetId: target!.id });
    expect(f.report().stimulant).toMatchObject({ uses: 1, normalHpRestored: 1, temporaryHpGenerated: 1, temporaryHpAbsorbed: 1 });
    expect(f.report().players[2]!.damageByItem.knife).toBe(1);
    expect(f.room().players[1]!.hp).toBe(4);
    expect(JSON.stringify(f.game.project(f.code, actor!.id, false))).not.toContain('temporaryHpGenerated');
    expect(f.game.telemetryFailureCount).toBe(0);
  });

  it('counts market opportunities and private purchases without disclosing their contents', () => {
    const f = fixture();
    for (const playerId of f.ids) f.send(playerId, 'PASS_TURN');
    const shop = f.room().shop!;
    expect(f.report().stimulant.publicOffers).toBe(shop.publicOffers.filter(offer => offer.itemId === 'stimulant').length);
    expect(f.report().stimulant.privateOffers).toBe(Object.values(shop.privateOffers).flat().filter(offer => offer.itemId === 'stimulant').length);
    f.timeout();
    const buyerId = f.room().shop!.order[0]!;
    const buyer = f.room().players.find(player => player.id === buyerId)!;
    buyer.inventory.coins = 20;
    const offer = f.room().shop!.privateOffers[buyerId]![0]!;
    offer.itemId = 'stimulant'; offer.price = 6;
    f.send(buyerId, 'SKIP_PUBLIC_SHOP');
    f.send(buyerId, 'BUY', { market: 'BLACK', offerId: offer.id });
    expect(f.report().stimulant.purchases).toBe(1);
    const purchase = f.room().events!.filter(event => event.kind === 'PURCHASE').at(-1)!;
    expect(purchase.presentation?.itemId).toBeUndefined();
    const observer = f.ids.find(id => id !== buyerId)!;
    expect(JSON.stringify(f.game.project(f.code, observer, false))).not.toContain(offer.id);
    expect(JSON.stringify(f.game.project(f.code, observer, false))).not.toContain('privateOffers');
    expect(f.game.telemetryFailureCount).toBe(0);
  });

  it('records passes, timeouts, decision times and balances after shopping', () => {
    const f = fixture();
    f.send(f.ids[0]!, 'PASS_TURN'); f.timeout(); f.send(f.ids[2]!, 'PASS_TURN');
    expect(f.report()).toMatchObject({ passTurnCount:2, normalTurnTimeoutCount:1, pacingPatch:'compact-tasks-tutorial-v2' });
    expect(f.report().averageDecisionMs).toBeGreaterThan(0);
    while(f.room().round!.phase === 'INTERMISSION') f.timeout();
    expect(f.report().players.every(player => player.intermissionCoins[0]!.afterCoins !== undefined)).toBe(true);
    expect(f.report().roundDurations).toHaveLength(2);
    expect(f.game.telemetryFailureCount).toBe(0);
  });
  it('preserves final-round income and readiness reward in the pre-cleanup departure balance', () => {
    const f = fixture();
    f.room().round!.number = 2;
    f.room().players.forEach((player, index) => {
      player.objective = { objectiveId: ['tycoon', 'collector', 'escapist'][index]!, status: index === 0 ? 'ACTIVE' : 'FAILED', progress: {}, rewardGranted: false };
      player.inventory.coins = index === 0 ? 13 : 0;
    });
    f.room().match!.history.trades.push({ actorId: f.ids[0]!, targetId: f.ids[1]!, round: 1, sequence: 1 });
    for (const playerId of f.ids) f.send(playerId, 'END_TURN');
    expect(f.room().status).toBe('RESULTS');
    expect(f.room().players[0]!.inventory.coins).toBe(0);
    expect(f.report().players[0]).toMatchObject({ roundIncomeReceived: 2, coinsUnspentAtMatchEnd: 18, objectiveCompletedRound: 2 });
    expect(f.report().players.slice(1).map(player => player.coinsUnspentAtMatchEnd)).toEqual([2, 2]);
    const exit = f.room().events!.find(event => event.kind === 'EXIT' && event.actorId === f.ids[0])!;
    expect(exit.presentation!.departureCoins).toBe(18);
    expect(f.room().events!.find(event => event.kind === 'ROUND_INCOME_GRANTED')!.sequence).toBeLessThan(exit.sequence);
    expect(f.game.telemetryFailureCount).toBe(0);
  });

  it('retains pre-death Coins when a death objective banks after cleanup', () => {
    const f = fixture();
    f.room().players.forEach((player, index) => {
      player.objective = { objectiveId: ['escapist', 'collector', 'martyr'][index]!, status: 'ACTIVE', progress: {}, rewardGranted: false };
    });
    const victim = f.room().players[2]!;
    victim.inventory.coins = 9; victim.life = 'DOWNED'; victim.hp = 0;
    victim.downed = { aggressorId: f.ids[1]!, downedAt: f.now(), eventId: 'fixture-down', expiresRound: 1, expiresSeat: 1 };
    f.send(f.ids[0]!, 'END_TURN');
    expect(f.room().players[2]!.objective!.status).toBe('BANKED');
    expect(f.room().players[2]!.inventory.coins).toBe(0);
    expect(f.report().players[2]).toMatchObject({ deaths: 1, coinsUnspentAtMatchEnd: 9 });
    expect(f.room().events!.find(event => event.kind === 'DEATH')!.presentation!.departureCoins).toBe(9);
    expect(f.room().events!.find(event => event.kind === 'DEATH_OBJECTIVE_BANKED')!.presentation?.departureCoins).toBeUndefined();
    expect(f.game.telemetryFailureCount).toBe(0);
  });

  it('records Round Income and pre-shopping purchasing power without exposing admin metrics', () => {
    const f = fixture();
    const initial = f.room().players.map(player => player.inventory.coins);
    for (const playerId of f.ids) f.send(playerId, 'END_TURN');
    expect(f.report().players.map(player => player.roundIncomeReceived)).toEqual([2, 2, 2]);
    expect(f.report().players.map(player => player.intermissionCoins[0]!.coins)).toEqual(initial.map(value => value + 2));
    expect(f.report().players.every(player => player.intermissionCoins[0]!.affordableItems > 0)).toBe(true);
    expect(f.report().players.map(player => player.intermissionsWithNoAffordableItems)).toEqual([0, 0, 0]);
    expect(JSON.stringify(f.game.project(f.code, f.ids[0]!, false))).not.toContain('intermissionCoins');
    expect(f.game.telemetryFailureCount).toBe(0);
  });

  it('records private draw/burn identity only in admin telemetry and gross Windfall effects', () => {
    const f = fixture();
    while (f.room().round!.number < 3) {
      if (f.room().round!.phase === 'TURN') f.send(f.room().players.find(player => player.seat === f.room().turn!.activeSeat)!.id, 'END_TURN');
      else f.timeout();
    }
    const [actor, target] = f.ids;
    f.room().wildcardDeck = ['windfall', ...f.room().wildcardDeck!.filter(card => card !== 'windfall')];
    f.send(actor!, 'DRAW_WILDCARD'); f.send(actor!, 'USE_WILDCARD');
    const first = f.report().wildcards[0]!;
    expect(first).toMatchObject({ cardId: 'windfall', playerId: actor, round: 3, outcome: 'APPLIED', coinsGained: 6, coinsTransferred: 0, itemsTransferred: 0 });
    expect(f.report()).toMatchObject({ wildcardDraws: 1, wildcardUses: 1, wildcardBurns: 0 });
    f.send(target!, 'DRAW_WILDCARD');
    const burnedId = f.room().pendingPrivateWildcardByPlayer![target!]!.cardId;
    f.send(target!, 'BURN_WILDCARD');
    expect(f.report()).toMatchObject({ wildcardDraws: 2, wildcardUses: 1, wildcardBurns: 1 });
    expect(f.report().wildcards[1]).toMatchObject({ cardId: burnedId, playerId: target, outcome: 'BURNED', coinsGained: 0 });
    expect(JSON.stringify(f.game.project(f.code, actor!, false))).not.toContain(JSON.stringify(burnedId));
    expect(f.game.telemetryFailureCount).toBe(0);
  });

  it.each(['timeout', 'accept', 'decline', 'disconnect'] as const)('distinguishes Trade %s without logging private inventory or credentials', mode => {
    const f = fixture();
    const [actor, target] = f.ids;
    f.send(actor!, 'TRADE', { targetId: target, offeredItems: [], requestedItems: [], offeredCoins: 1, requestedCoins: 0 });
    if (mode === 'timeout') f.timeout();
    else if (mode === 'disconnect') f.game.setConnected(f.code, target!, false, f.now());
    else f.send(target!, 'RESPOND_TRADE', { accept: mode === 'accept' });
    expect(f.report().trades).toEqual({ proposed: 1, manualAccepted: mode === 'accept' ? 1 : 0, manualDeclined: mode === 'decline' ? 1 : 0, timeoutDeclined: mode === 'timeout' ? 1 : 0, cancelled: mode === 'disconnect' ? 1 : 0 });
    expect(f.report().players[0]).toMatchObject({ role: 'enforcer', seat: 0, objective: f.room().players[0]!.objective!.objectiveId });
    expect(f.report().players[0]!.coinsSpent).toBe(mode === 'accept' ? 1 : 0);
    expect(f.report().players[1]!.coinsEarned).toBe(mode === 'accept' ? 3 : 0);
    expect(f.report().tasks).toHaveLength(6);
    if (mode === 'accept') expect(f.report().taskCompletionByType.trade).toMatchObject({ completed: 1 });
    expect(JSON.stringify(f.game.project(f.code, actor!, false))).not.toContain('taskCompletionByType');
    const json = JSON.stringify(f.report());
    for (const player of f.room().players) for (const pocket of player.inventory.pockets) if (pocket.item) expect(json).not.toContain(pocket.item.instanceId);
    expect(json).not.toContain('reconnectToken'); expect(json).not.toContain('tokenHash');
    expect(JSON.stringify(f.game.project(f.code, target!, false))).not.toContain('manualAccepted');
    expect(f.game.telemetryFailureCount).toBe(0);
  });

  it.each(['timeout', 'comply', 'refuse'] as const)('separates %s Threat outcomes per player without counting timeout as persuasion', response => {
    const f = fixture(); const [actor, target] = f.ids;
    const pistol = f.room().players[0]!.inventory.visible.find(item => item?.itemId === 'pistol')!;
    const cloth = f.room().players[0]!.inventory.pockets[0]!.item!;
    f.send(actor!, 'THREAT', { mode: 'COVERED', targetId: target, committedItemId: pistol.instanceId, clothItemId: cloth.instanceId, demandedItems: [], demandedCoins: 1 });
    if (response === 'timeout') f.timeout();
    else f.send(target!, 'RESPOND_THREAT', { comply: response === 'comply' });
    const expected = { open: 0, covered: 1, manualComplied: response === 'comply' ? 1 : 0, manualRefused: response === 'refuse' ? 1 : 0, timeoutComplied: response === 'timeout' ? 1 : 0, cancelled: 0 };
    expect(f.report().threats).toEqual(expected);
    expect(f.report().players[0]!.threats).toEqual(expected);
    expect(f.report().players[0]!.pocketItemUses).toBe(1);
    expect(f.game.telemetryFailureCount).toBe(0);
  });

  it.each([false, true])('records actual HP damage, hidden ammunition usage, and Armor blocking (%s)', armor => {
    const f = fixture(); const [actor, target] = f.ids;
    const owner = f.room().players[0]!; const victim = f.room().players[1]!;
    const bulletIndex = owner.inventory.visible.findIndex(item => item?.itemId === 'bullet');
    const bullet = owner.inventory.visible[bulletIndex]!;
    owner.inventory.visible[bulletIndex] = owner.inventory.pockets[0]!.item;
    owner.inventory.pockets[0]!.item = bullet;
    victim.hp = 2;
    if (armor) victim.inventory.visible[3] = { instanceId: 'fixture-armor', itemId: 'armor', quantity: 1 };
    const pistol = owner.inventory.visible.find(item => item?.itemId === 'pistol')!;
    f.send(actor!, 'USE_ITEM', { instanceId: pistol.instanceId, targetId: target });
    expect(f.report().players[0]!.damageByItem).toEqual(armor ? {} : { pistol: 2 });
    expect(f.report().players[0]!.pocketItemUses).toBe(1);
    expect(f.report().players[0]!.downs).toBe(armor ? 0 : 1);
    expect(f.report().players[1]!.armorUses).toBe(armor ? 1 : 0);
    expect(f.game.telemetryFailureCount).toBe(0);
  });

  it('records simultaneous Intermission completion waiting and unused turns without changing projection', () => {
    const f = fixture();
    for (const playerId of f.ids) f.send(playerId, 'END_TURN');
    const order = [...f.room().shop!.order];
    f.timeout();
    for (const playerId of order) { f.send(playerId, 'SKIP_PUBLIC_SHOP'); f.send(playerId, 'FINISH_SHOPPING'); }
    const report = f.report();
    expect(report.intermissionDurationMs).toBe(10_006);
    expect(order.map(id => report.players.find(player => player.playerId === id)!.intermissionIdleMs)).toEqual([4, 2, 0]);
    expect(report.players.map(player => player.turnsWithNoGameplayAction)).toEqual([1, 1, 1]);
    expect(report.round).toBe(2);
    report.players[0]!.role = 'MUTATED';
    expect(f.report().players[0]!.role).toBe('enforcer');
    expect(f.game.telemetryFailureCount).toBe(0);
  });

  it('uses event rounds across boundaries and bounds report retention', () => {
    const f = fixture(); const recorder = new MatchTelemetryRecorder(1);
    const before = structuredClone(f.room()); const after = structuredClone(before);
    after.round!.number = 2; after.revision += 1;
    after.events!.push({ id: 'boundary-failure', sequence: after.events!.length + 1, at: f.now(), round: 1, kind: 'OBJECTIVE_FAILED', actorId: f.ids[0]!, targetIds: [], publicText: 'Contract failed.' });
    after.players[0]!.objective!.status = 'FAILED'; after.players[0]!.objective!.failureReason = 'Private reason';
    recorder.capture(before, after);
    expect(recorder.exportAdminTelemetry()[0]!.players[0]).toMatchObject({ objectiveFailedRound: 1, objectiveFailureReason: 'Private reason' });
    const next = structuredClone(after); next.matchSerial = (after.matchSerial ?? 0) + 1;
    recorder.capture(after, next);
    expect(recorder.exportAdminTelemetry()).toHaveLength(1);
    expect(recorder.exportAdminTelemetry()[0]!.matchSerial).toBe(next.matchSerial);
  });

  it('does not turn a committed game action into a rejected command if instrumentation fails', () => {
    const f = fixture();
    vi.spyOn(f.game.telemetry, 'capture').mockImplementation(() => { throw new Error('instrumentation failure'); });
    const revision = f.room().revision;
    expect(() => f.send(f.ids[0]!, 'END_TURN')).not.toThrow();
    expect(f.room().revision).toBe(revision + 1);
    expect(f.room().turn!.activeSeat).toBe(1);
    expect(f.game.telemetryFailureCount).toBe(1);
  });

  it('records Concede and its private failure reason without counting removed Coins as spending', () => {
    const f = fixture();
    f.room().players[0]!.inventory.coins = 9;
    f.room().players[0]!.objective!.status = 'FAILED';
    f.room().players[0]!.objective!.failureReason = 'Private failed target.';
    f.send(f.ids[0]!, 'CONCEDE');
    expect(f.report().players[0]).toMatchObject({ conceded: true, score: 0, coinsSpent: 0, coinsUnspentAtMatchEnd: 9, objectiveFailureReason: 'Private failed target.' });
    expect(f.room().events!.find(event => event.kind === 'PLAYER_CONCEDED')!.presentation!.departureCoins).toBe(9);
    expect(f.report().coinsDefinition).toBe('observed-balance-deltas-excluding-departure-cleanup');
    expect(f.game.telemetryFailureCount).toBe(0);
  });
});
