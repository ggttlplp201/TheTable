import { describe, expect, it } from 'vitest';
import { concedePlayer, damage, permanentlyDie } from './combat.js';
import { applyCommand } from './engine.js';
import { acquire, stack } from './inventory.js';
import { bankObjective, evaluateObjectives } from './objectives.js';
import { projectAuthorizedRoom, projectPublicRoom, projectSpectatorRoom } from './room.js';
import type { PlayerLife, PlayerState, RoomState } from './types.js';

function fixture(objectiveId = 'graverobber', targetPlayerId?: string): RoomState {
  const room: RoomState = {
    id: 'v14-objectives', code: 'OBJ234', revision: 1, status: 'PLAYING', hostPlayerId: 'p0', createdAt: 0, updatedAt: 1,
    players: Array.from({ length: 4 }, (_, seat) => ({
      id: `p${seat}`, seat: seat as PlayerState['seat'], name: ['Aster', 'Fang', 'Ledger', 'Velvet'][seat]!, normalizedName: `p${seat}`,
      ready: true, connection: 'CONNECTED', hp: 5, score: 0, life: 'ACTIVE', turnsStarted: 1,
      objective: { objectiveId: ['graverobber', 'escapist', 'collector', 'arsenal'][seat]!, status: 'ACTIVE', progress: {}, rewardGranted: false },
      inventory: { coins: 0, visible: Array<null>(6).fill(null), pockets: [{ item: null, source: 'DEFAULT', protectedBySafe: false }] },
    })),
    round: { number: 4, phase: 'TURN', seatsOwedTurn: [1, 2, 3] },
    turn: { activeSeat: 0, serial: 10, startedAt: 1, deadlineAt: 60001, primaryUsed: false, downedInteractionUsed: false, exitDeclined: false, startedDowned: false },
    match: { seed: 1, rngState: 1, nextId: 1, turnSerial: 10, playerCount: 4, fixedSeats: [0, 1, 2, 3], artifactPool: [], passageTokenAvailable: true, blackKeyObtainable: true, exits: [],
      history: { trades: [], downs: [], revives: [], loots: [], poisonTicks: [], threats: [], pickpockets: [], chests: [], deaths: [] } },
    events: [], overflows: [], chests: [],
  };
  room.players[0]!.objective = { objectiveId, status: 'ACTIVE', progress: {}, rewardGranted: false, ...(targetPlayerId ? { targetPlayerId } : {}) };
  return room;
}

function credit(room: RoomState, targetId: string): void {
  const h = room.match!.history;
  switch (room.players[0]!.objective!.objectiveId) {
    case 'extortionist': h.threats.push({ actorId: 'p0', targetId, complied: true, covered: false, validWeapon: true, assetsReceived: true }); break;
    case 'duelist': h.downs.push({ actorId: 'p0', targetId, eventId: `down-${targetId}`, sequence: 2, recovered: false }); break;
    case 'savior': h.revives.push({ actorId: 'p0', targetId, eventId: `down-${targetId}` }); break;
    case 'graverobber': h.loots.push({ actorId: 'p0', targetId, eventId: `down-${targetId}` }); break;
    case 'poisoner': h.poisonTicks.push({ actorId: 'p0', targetId }); break;
    case 'merchant': h.trades.push({ actorId: targetId, targetId: 'p0', round: 1, sequence: 1 }); break;
  }
}

describe('v14 permanent objective viability', () => {
  it.each(['extortionist', 'duelist', 'savior', 'graverobber', 'poisoner', 'merchant'])('exhausts distinct credit and all target life combinations for %s', objectiveId => {
    const lives: PlayerLife[] = ['ACTIVE', 'DOWNED', 'DEAD', 'EXITED'];
    for (let mask = 0; mask < 8; mask += 1) for (const first of lives) for (const second of lives) for (const third of lives) {
      const room = fixture(objectiveId);
      let completed = 0, remaining = 0;
      for (const [index, life] of [first, second, third].entries()) {
        const target = room.players[index + 1]!;
        target.life = life;
        if (mask & (1 << index)) { completed += 1; credit(room, target.id); credit(room, target.id); }
        else if (life === 'ACTIVE' || life === 'DOWNED') remaining += 1;
      }
      evaluateObjectives(room, 2);
      expect(room.players[0]!.objective!.status, `${objectiveId}: mask=${mask}, lives=${first}/${second}/${third}`).toBe(completed >= 2 ? 'EXIT_READY' : completed + remaining < 2 ? 'FAILED' : 'ACTIVE');
      expect(room.players[0]!.objective!.progress.qualifiedPlayerIds).toHaveLength(completed);
    }
  });

  it('emits a permanent failure once and projects its exact reason only to its owner', () => {
    const room = fixture('executioner', 'p1');
    bankObjective(room, room.players[1]!, 2);
    evaluateObjectives(room, 3); evaluateObjectives(room, 4);
    const objective = room.players[0]!.objective!;
    expect(objective).toMatchObject({ status: 'FAILED', failureReason: 'Your assigned target escaped.' });
    expect(objective.contingencyTargetId).toBeUndefined();
    expect(room.events!.filter(event => event.kind === 'OBJECTIVE_FAILED')).toHaveLength(1);
    expect(projectAuthorizedRoom(room, 'p0').private.objective!.failureReason).toBe(objective.failureReason);
    expect(JSON.stringify(projectAuthorizedRoom(room, 'p2'))).not.toContain(objective.failureReason);
    expect(JSON.stringify(projectPublicRoom(room))).not.toContain('executioner');
  });

  it('keeps failed status out of living public feeds without losing owner or spectator history', () => {
    const room = fixture('executioner', 'p1');
    bankObjective(room, room.players[1]!, 2);
    evaluateObjectives(room, 3);
    const failure = room.events!.find(event => event.kind === 'OBJECTIVE_FAILED')!;
    const authoritativeEvents = structuredClone(room.events);
    const publicView = projectPublicRoom(room);
    expect(publicView.events).not.toContainEqual(expect.objectContaining({ kind: 'OBJECTIVE_FAILED' }));
    expect(publicView.events).not.toContainEqual(expect.objectContaining({ id: failure.id }));
    expect(JSON.stringify(publicView)).not.toContain(failure.publicText);
    expect(publicView.players[0]).toMatchObject({ objectiveCompleted: false });
    expect(publicView.players[0]).not.toHaveProperty('objective');
    expect(publicView.players[0]).not.toHaveProperty('revealedObjective');
    for (const playerId of ['p0', 'p2', 'p3']) {
      const view = projectAuthorizedRoom(room, playerId);
      expect(view.public.events).not.toContainEqual(expect.objectContaining({ kind: 'OBJECTIVE_FAILED' }));
      if (playerId !== 'p0') expect(JSON.stringify(view)).not.toContain('Your assigned target escaped.');
    }
    const owner = projectAuthorizedRoom(room, 'p0').private;
    expect(owner.objective).toMatchObject({ status: 'FAILED', failureReason: 'Your assigned target escaped.' });
    expect(owner.inspections).toContainEqual({ eventId: failure.id, payload: { failureReason: 'Your assigned target escaped.' } });
    const spectator = projectSpectatorRoom(room, 'p1');
    expect(spectator.events).toContainEqual(expect.objectContaining({ id: failure.id, kind: 'OBJECTIVE_FAILED', actorId: 'p0', publicText: failure.publicText }));
    expect(spectator.players[0]!.private.objective).toMatchObject({ status: 'FAILED', failureReason: 'Your assigned target escaped.' });
    expect(publicView.events).toContainEqual(expect.objectContaining({ kind: 'EXIT', actorId: 'p1' }));
    expect(room.events).toEqual(authoritativeEvents);
  });

  it.each(['executioner', 'guardian', 'kingmaker'])('preserves %s killer contingency, then fails if that killer exits', objectiveId => {
    const room = fixture(objectiveId, 'p1');
    room.players[1]!.life = 'DEAD';
    room.players[1]!.objective!.status = 'FAILED';
    room.match!.history.deaths.push({ playerId: 'p1', killerId: 'p2', at: 2 });
    evaluateObjectives(room, 3);
    expect(room.players[0]!.objective).toMatchObject({ status: 'ACTIVE', contingency: true, contingencyTargetId: 'p2' });
    bankObjective(room, room.players[2]!, 4);
    evaluateObjectives(room, 5);
    expect(room.players[0]!.objective).toMatchObject({ status: 'FAILED' });
    expect(room.players[0]!.objective!.failureReason).toContain('Ledger');
  });

  it.each(['executioner', 'guardian', 'kingmaker'])('banks %s contingency readiness for the qualifying killer only', objectiveId => {
    for (const killerId of ['p0', 'p3']) {
      const room = fixture(objectiveId, 'p1');
      room.players[1]!.life = 'DEAD';
      room.match!.history.deaths.push({ playerId: 'p1', killerId: 'p2', at: 2 });
      evaluateObjectives(room, 3);
      room.players[2]!.life = 'DEAD';
      room.match!.history.deaths.push({ playerId: 'p2', killerId, at: 4 });
      evaluateObjectives(room, 5);
      expect(room.players[0]!.objective!.status).toBe(killerId === 'p0' ? 'EXIT_READY' : 'FAILED');
      expect(room.players[0]!.inventory.coins).toBe(killerId === 'p0' ? 2 : 0);
    }
  });

  it('fails an Executioner when its original target concedes without creating kill credit', () => {
    const room = fixture('executioner', 'p1');
    room.players[1]!.objective!.status = 'FAILED';
    concedePlayer(room, room.players[1]!, 2); evaluateObjectives(room, 3);
    expect(room.players[0]!.objective).toMatchObject({ status: 'FAILED' });
    expect(room.players[0]!.objective!.contingencyTargetId).toBeUndefined();
    expect(room.match!.history.deaths).toEqual([]);
  });

  it('propagates Kingmaker failure dependencies in one evaluation regardless of seat order', () => {
    const room = fixture('kingmaker', 'p1');
    room.players[1]!.objective = { objectiveId: 'executioner', targetPlayerId: 'p2', status: 'ACTIVE', progress: {}, rewardGranted: false };
    bankObjective(room, room.players[2]!, 2);
    evaluateObjectives(room, 3);
    expect(room.players.slice(0, 2).map(player => player.objective!.status)).toEqual(['FAILED', 'FAILED']);
    expect(room.players[0]!.objective!.failureReason).toContain('Fang');
  });

  it('Guardian completes at the Round 4 boundary or earlier target exit and stays latched', () => {
    const room = fixture('guardian', 'p1');
    evaluateObjectives(room, 2);
    expect(room.players[0]!.objective!.status).toBe('ACTIVE');
    evaluateObjectives(room, 3, true);
    expect(room.players[0]!.objective!.status).toBe('EXIT_READY');
    room.players[1]!.life = 'DEAD';
    room.match!.history.deaths.push({ playerId: 'p1', killerId: 'p2', at: 4 });
    evaluateObjectives(room, 5);
    expect(room.players[0]!.objective!.status).toBe('EXIT_READY');
    expect(room.players[0]!.objective!.contingency).toBeUndefined();
    const early = fixture('guardian', 'p1'); early.round!.number = 2;
    bankObjective(early, early.players[1]!, 2); evaluateObjectives(early, 3);
    expect(early.players[0]!.objective!.status).toBe('EXIT_READY');
  });

  it('Martyr fails on the first other death and cannot bank on a later death', () => {
    const room = fixture('martyr');
    damage(room, room.players[2]!, room.players[1]!, 5, 2, false);
    permanentlyDie(room, room.players[1]!, 3); evaluateObjectives(room, 4);
    expect(room.players[0]!.objective).toMatchObject({ status: 'FAILED' });
    expect(room.players[0]!.objective!.failureReason).toContain('Fang');
    damage(room, room.players[2]!, room.players[0]!, 5, 5, false);
    permanentlyDie(room, room.players[0]!, 6);
    expect(room.players[0]!.score).toBe(0);
    expect(room.players[0]!.objective!.revealed).toBeUndefined();
  });

  it('Martyr can still be the first permanent death after someone concedes', () => {
    const room = fixture('martyr');
    room.players[1]!.objective!.status = 'FAILED'; concedePlayer(room, room.players[1]!, 2);
    damage(room, room.players[2]!, room.players[0]!, 5, 3, false);
    permanentlyDie(room, room.players[0]!, 4);
    expect(room.players[0]!.objective).toMatchObject({ status: 'BANKED', revealed: true });
    expect(room.players[0]!.score).toBe(100);
  });

  it('Betrayer keeps every traded partner and allows new or temporarily Downed/disconnected partners', () => {
    const room = fixture('betrayer');
    room.match!.history.trades.push({ actorId: 'p0', targetId: 'p1', round: 1, sequence: 1 }, { actorId: 'p2', targetId: 'p0', round: 1, sequence: 2 });
    room.players[1]!.life = 'EXITED'; room.players[2]!.life = 'DOWNED'; room.players[2]!.connection = 'DISCONNECTED';
    evaluateObjectives(room, 3);
    expect(room.players[0]!.objective).toMatchObject({ status: 'ACTIVE', progress: { tradedPlayerIds: ['p1', 'p2'], eligibleTargetIds: ['p2'] } });
    room.players[2]!.life = 'DEAD'; evaluateObjectives(room, 4);
    expect(room.players[0]!.objective!.status).toBe('ACTIVE');
    room.players[3]!.life = 'EXITED'; evaluateObjectives(room, 5);
    expect(room.players[0]!.objective!.status).toBe('FAILED');
  });

  it.each(['escapist', 'collector', 'tycoon', 'arsenal', 'phoenix', 'chest-raider', 'con-artist', 'hidden-hand', 'survivor'])('does not fail %s because of temporary scarcity', objectiveId => {
    const room = fixture(objectiveId);
    room.players[1]!.life = 'DOWNED'; room.players[1]!.connection = 'DISCONNECTED';
    evaluateObjectives(room, 2);
    expect(room.players[0]!.objective!.status).toBe('ACTIVE');
    expect(room.players[0]!.objective!.failureReason).toBeUndefined();
  });

  it('completed history stays viable before unlock even when all credited targets leave', () => {
    const room = fixture('duelist'); room.round!.number = 1;
    credit(room, 'p1'); credit(room, 'p2');
    room.players[1]!.life = 'EXITED'; room.players[2]!.life = 'DEAD';
    evaluateObjectives(room, 2);
    expect(room.players[0]!.objective!.status).toBe('ACTIVE');
    room.round!.number = 3; evaluateObjectives(room, 3);
    expect(room.players[0]!.objective!.status).toBe('EXIT_READY');
  });

  it('sustained requirement loss locks exit without failure or a repeated reward', () => {
    const room = fixture('tycoon'); room.players[0]!.inventory.coins = 15;
    room.match!.history.trades.push({ actorId: 'p0', targetId: 'p1', round: 1, sequence: 1 });
    evaluateObjectives(room, 2);
    expect(room.players[0]!.objective).toMatchObject({ status: 'EXIT_READY', readyOnTurn: 2 });
    room.players[0]!.inventory.coins = 0; evaluateObjectives(room, 3);
    expect(room.players[0]!.objective!.status).toBe('ACTIVE');
    expect(room.players[0]!.objective!.failureReason).toBeUndefined();
    room.players[0]!.inventory.coins = 15; evaluateObjectives(room, 4);
    expect(room.players[0]!.inventory.coins).toBe(15);
    expect(room.players[0]!.objective!.readyOnTurn).toBe(2);
  });
});

describe('v14 concede cleanup and secrecy', () => {
  it('cleans held and pending items with no loot, death credit, objective reveal or score', () => {
    const room = fixture('executioner', 'p1');
    const player = room.players[0]!;
    player.objective!.status = 'FAILED'; player.objective!.failureReason = 'Private contract reason';
    player.inventory.coins = 14;
    acquire(room, player, stack(room, 'brass-idol'), 1);
    player.inventory.pockets[0]!.item = stack(room, 'passage-token'); room.match!.passageTokenAvailable = false;
    room.overflows!.push({ id: 'overflow', playerId: player.id, incoming: stack(room, 'glass-eye'), deadlineAt: 99 });
    room.turn!.immediateLoot = { playerId: player.id, targetId: 'p1', downEventId: 'down-1' };
    concedePlayer(room, player, 2);
    expect(player).toMatchObject({ life: 'DEAD', conceded: true, score: 0, hp: 0 });
    expect(player.inventory.visible.every(item => item === null)).toBe(true);
    expect(player.inventory.pockets[0]!.item).toBeNull(); expect(player.inventory.coins).toBe(0);
    expect(room.match!.artifactPool.sort()).toEqual(['brass-idol', 'glass-eye']);
    expect(room.match!.passageTokenAvailable).toBe(true); expect(room.overflows).toEqual([]);
    expect(room.turn!.immediateLoot).toBeUndefined(); expect(room.match!.history.deaths).toEqual([]);
    expect(player.objective!.revealed).toBeUndefined();
    expect(room.events!.at(-1)!.kind).toBe('PLAYER_CONCEDED');
    expect(JSON.stringify(projectAuthorizedRoom(room, 'p2'))).not.toContain('Private contract reason');
    expect(projectSpectatorRoom(room, player.id).players[0]!.private.objective!.failureReason).toBe('Private contract reason');
  });

  it('rejects concession before failure or while Downed', () => {
    const room = fixture();
    expect(() => concedePlayer(room, room.players[0]!, 2)).toThrow(/failed contract/);
    room.players[0]!.objective!.status = 'FAILED'; room.players[0]!.life = 'DOWNED';
    expect(() => concedePlayer(room, room.players[0]!, 2)).toThrow(/active player/);
  });

  it('offers and accepts concede only on the failed player own normal turn', () => {
    let room = fixture('executioner', 'p1');
    room.players[0]!.objective!.status = 'FAILED';
    expect(projectAuthorizedRoom(room, 'p0').private.capabilities).toContain('CONCEDE');
    expect(() => applyCommand(room, 'p1', { type: 'CONCEDE' }, 2)).toThrow();
    room = applyCommand(room, 'p0', { type: 'CONCEDE' }, 2);
    expect(room.players[0]!).toMatchObject({ life: 'DEAD', conceded: true, score: 0 });
    expect(room.turn!.activeSeat).toBe(1);
    expect(projectAuthorizedRoom(room, 'p0').private.capabilities).not.toContain('CONCEDE');
  });
});
