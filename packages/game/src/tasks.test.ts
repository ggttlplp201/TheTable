import { describe, expect, it } from 'vitest';
import { TASK_REWARD, TASKS, type TaskId } from '@the-table/content';
import { applyCommand, applyTimeout, projectAuthorizedRoom, projectPublicRoom, projectSpectatorRoom, startMatch, type GameCommand, type PlayerState, type RoomState } from './index.js';
import { assignTasks, completeTask, eligibleTasks, excludedTasks, expireTasks, resolveTaskEvents, startTaskOpportunity } from './tasks.js';
import { stack } from './inventory.js';
import { damage } from './combat.js';

function game(seed = 77): RoomState {
  let room = startMatch({ id: 'tasks', code: 'ABC234', status: 'LOBBY', revision: 1, hostPlayerId: 'p0', createdAt: 0, updatedAt: 0,
    players: ['enforcer', 'medic', 'locksmith'].map((roleId, index) => ({ id: `p${index}`, seat: index, name: `Player ${index}`, normalizedName: `player ${index}`, connection: 'CONNECTED', roleId, ready: true, hp: 5, score: 0, life: 'ACTIVE', inventory: { visible: Array(6).fill(null), pockets: [{ source: 'DEFAULT', protectedBySafe: false, item: null }], coins: 3 } })) as PlayerState[],
  }, { seed, now: 1 });
  for (const player of room.players) room = applyCommand(room, player.id, { type: 'LOCK_SETUP', instanceId: player.inventory.visible[2]!.instanceId }, 1);
  for (const [index, player] of room.players.entries()) player.objective = { objectiveId: ['arsenal', 'collector', 'tycoon'][index]!, status: 'ACTIVE', progress: {}, rewardGranted: false };
  return room;
}
function jobs(room: RoomState, id: string, ...ids: TaskId[]) {
  room.sideJobsByPlayer![id] = { round: room.round!.number, reward: TASK_REWARD, jobs: ids.map(id => ({ id, status: 'ACTIVE', progress: 0, prerequisites: [] })), completed: false, opportunityTaken: false, replacementUsed: false };
}
const command = (room: RoomState, id: string, action: GameCommand) => applyCommand(room, id, action, room.updatedAt + 1);
function give(room: RoomState, index: number, itemId: string) { const item = stack(room, itemId); room.players[index]!.inventory.visible[room.players[index]!.inventory.visible.findIndex(value => value === null)] = item; return item.instanceId; }
const pistol = (room: RoomState) => room.players[0]!.inventory.visible.find(item => item?.itemId === 'pistol')!.instanceId;
function expectDone(room: RoomState, id: string, job: TaskId) {
  expect(room.sideJobsByPlayer![id]!.jobs.find(task => task.id === job)!.status).toBe('COMPLETED');
  expect(room.sideJobsByPlayer![id]!.jobs.filter(task => task.id !== job).every(task => task.status === 'CANCELLED')).toBe(true);
}

describe('private Round Tasks', () => {
  it('assigns two distinct, diverse and plausible jobs without perturbing the gameplay random stream', () => {
    for (let seed = 1; seed <= 80; seed++) {
      const room = game(seed); const rng = room.match!.rngState;
      assignTasks(room, 2);
      expect(room.match!.rngState).toBe(rng);
      for (const player of room.players) {
        const pair = room.sideJobsByPlayer![player.id]!.jobs;
        expect(new Set(pair.map(task => task.id)).size).toBe(2);
        const eligible = eligibleTasks(room, player);
        for (const task of pair) expect(eligible).toContain(task.id);
        const categories = new Set(eligible.map(id => TASKS.find(task => task.id === id)!.category));
        if (categories.size > 1) expect(new Set(pair.map(task => TASKS.find(def => def.id === task.id)!.category)).size).toBe(2);
      }
    }
  });
  it('keeps assignment, replacement and cancellation identities out of every other owner and public replay', () => {
    const room = game(); jobs(room, 'p0', 'inspect-pocket', 'pickpocket');
    expect(projectAuthorizedRoom(room, 'p0').private.tasks!.jobs[0]!.id).toBe('inspect-pocket');
    expect(projectPublicRoom(room)).not.toHaveProperty('sideJobsByPlayer');
    expect(projectPublicRoom(room).events!.some(event => event.kind === 'TASKS_ASSIGNED_PRIVATE')).toBe(false);
    const before = room.players[0]!.inventory.coins;
    completeTask(room, 'p0', ['inspect-pocket'], 2);
    expect(room.players[0]!.inventory.coins).toBe(before + 2);
    const publicEvents = projectPublicRoom(room).events!;
    expect(publicEvents.filter(event => event.kind === 'TASK_COMPLETED')).toHaveLength(1);
    expect(publicEvents.filter(event => event.kind.startsWith('TASK'))).not.toEqual(expect.arrayContaining([expect.objectContaining({ privatePayloads: expect.anything() })]));
    expect(JSON.stringify(publicEvents)).not.toContain('inspect-pocket');
    expect(JSON.stringify(projectAuthorizedRoom(room, 'p1').private)).not.toContain('inspect-pocket');
    completeTask(room, 'p0', ['pickpocket'], 3);
    expect(room.players[0]!.inventory.coins).toBe(before + 2);
    room.players[1]!.life = 'DEAD';
    expect(projectSpectatorRoom(room, 'p1').players[0]!.private.tasks).toEqual(room.sideJobsByPlayer!.p0);
  });
  it('filters defining objective actions, unavailable tools and early or spent Wildcards', () => {
    const room = game(); const player = room.players[0]!;
    for (const [objectiveId, excluded] of Object.entries({ executioner: ['damage'], duelist: ['damage'], extortionist: ['extort'], savior: ['revive'], graverobber: ['loot'], 'chest-raider': ['open-chest'], 'hidden-hand': ['pickpocket', 'loot'], 'con-artist': ['bluff'], betrayer: ['trade'] })) {
      player.objective!.objectiveId = objectiveId;
      expect(excludedTasks(room, player)).toEqual(excluded);
    }
    for (const id of ['inspect-pocket', 'pickpocket', 'wildcard', 'revive', 'break-armor'] as TaskId[]) expect(eligibleTasks(room, player)).not.toContain(id);
    room.round!.number = 3; room.wildcardUnlocked = true;
    expect(eligibleTasks(room, player)).toContain('wildcard');
    room.wildcardDrawUsedByPlayer![player.id] = true;
    expect(eligibleTasks(room, player)).not.toContain('wildcard');
    give(room, 0, 'pickpocket'); expect(eligibleTasks(room, player)).toContain('pickpocket');
  });
  it('always offers an available interaction alongside Chest or Wildcard opportunities', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const room = game(seed * 7919); room.round!.number = 3; room.wildcardUnlocked = true;
      const player = room.players[0]!;
      player.inventory.visible.fill(null); player.inventory.pockets[0]!.item = null;
      room.players.forEach(other => { other.inventory.coins = 0; });
      give(room, 0, 'key');
      assignTasks(room, room.updatedAt);
      expect(room.sideJobsByPlayer!.p0!.jobs.some(task => !['open-chest', 'wildcard'].includes(task.id))).toBe(true);
    }
  });
  it('keeps generic support and Con Artist response Tasks available when they are not actual objective steps', () => {
    const room = game(); const player = room.players[0]!;
    player.objective!.objectiveId = 'guardian'; player.objective!.targetPlayerId = 'p1'; room.players[1]!.hp = 4;
    give(room, 0, 'stimulant'); expect(eligibleTasks(room, player)).toContain('heal');
    player.objective!.objectiveId = 'con-artist';
    expect(excludedTasks(room, player)).not.toContain('call-bluff');
  });
  it('does not treat locked Pocket contents as assets available for a meaningful Trade', () => {
    const room = game();
    for (const player of room.players) {
      player.inventory.visible.fill(null);
      player.inventory.coins = 0;
    }
    expect(room.players.every(player => player.inventory.pockets.some(pocket => pocket.item))).toBe(true);
    expect(eligibleTasks(room, room.players[0]!)).not.toContain('trade');
    room.players[1]!.inventory.coins = 1;
    expect(eligibleTasks(room, room.players[0]!)).toContain('trade');
  });
  it('pays both participants on a meaningful manually accepted Trade and never on a declined, expired or empty Trade', () => {
    for (const result of ['accept', 'decline', 'timeout', 'empty']) {
      let room = game(); jobs(room, 'p0', 'trade', 'receive-coins'); jobs(room, 'p1', 'receive-coins', 'trade');
      const balances = room.players.map(player => player.inventory.coins);
      room = command(room, 'p0', { type: 'TRADE', targetId: 'p1', offeredItems: [], requestedItems: [], offeredCoins: result === 'empty' ? 0 : 2, requestedCoins: 0 });
      room = result === 'timeout' ? applyTimeout(room, room.pendingTrade!.deadlineAt) : command(room, 'p1', { type: 'RESPOND_TRADE', accept: result !== 'decline' });
      if (result === 'accept') { expectDone(room, 'p0', 'trade'); expectDone(room, 'p1', 'receive-coins'); expect(room.players[0]!.inventory.coins).toBe(balances[0]); expect(room.players[1]!.inventory.coins).toBe(balances[1]! + 4); }
      else expect(room.sideJobsByPlayer!.p0!.completed).toBe(false);
    }
  });
  it('distinguishes direct damage, Armor destruction and Poison ticks', () => {
    for (const kind of ['direct', 'armor', 'poison']) {
      let room = game(); jobs(room, 'p0', 'damage', 'break-armor');
      if (kind === 'armor') give(room, 1, 'armor');
      if (kind === 'poison') { const before = structuredClone(room); damage(room, room.players[0]!, room.players[1]!, 1, 2, false); resolveTaskEvents(before, room, 2); }
      else room = command(room, 'p0', { type: 'USE_ITEM', instanceId: pistol(room), targetId: 'p1' });
      if (kind === 'poison') expect(room.sideJobsByPlayer!.p0!.completed).toBe(false);
      else expectDone(room, 'p0', kind === 'armor' ? 'break-armor' : 'damage');
    }
  });
  it('rewards extortion, harmless bluff compliance, received Coins, and an off-turn called bluff', () => {
    for (const response of ['manual', 'timeout', 'refuse']) {
      let room = game(); jobs(room, 'p0', 'bluff', 'extort'); jobs(room, 'p1', 'call-bluff', 'trade');
      const cloth = room.players[0]!.inventory.pockets[0]!.item!;
      const bullet = room.players[0]!.inventory.visible.find(item => item?.itemId === 'bullet')!;
      room = command(room, 'p0', { type: 'THREAT', mode: 'COVERED', targetId: 'p1', committedItemId: bullet.instanceId, clothItemId: cloth.instanceId, demandedItems: [], demandedCoins: 2 });
      room = response === 'timeout' ? applyTimeout(room, room.pendingThreat!.deadlineAt) : command(room, 'p1', { type: 'RESPOND_THREAT', comply: response === 'manual' });
      if (response === 'refuse') expectDone(room, 'p1', 'call-bluff'); else expectDone(room, 'p0', 'bluff');
    }
  });
  it('counts another-player healing but not self-healing or revival as Heal', () => {
    for (const self of [false, true]) {
      let room = game(); jobs(room, 'p0', 'heal', 'revive');
      const medicine = give(room, 0, 'medicine'); room.players[self ? 0 : 1]!.hp = 4;
      room = command(room, 'p0', { type: 'USE_ITEM', instanceId: medicine, targetId: self ? 'p0' : 'p1' });
      expect(room.sideJobsByPlayer!.p0!.completed).toBe(!self);
    }
    let room = game(); const medicine = give(room, 0, 'medicine'); jobs(room, 'p0', 'heal', 'revive');
    damage(room, room.players[2]!, room.players[1]!, 5, 2, true);
    room = command(room, 'p0', { type: 'USE_ITEM', instanceId: medicine, targetId: 'p1' });
    expectDone(room, 'p0', 'revive');
  });
  it('requires successful exact inspection or Pickpocket, excluding Safe blocks and empty thefts', () => {
    for (const itemId of ['spyglass', 'pickpocket']) for (const blocked of [false, true]) {
      let room = game(); jobs(room, 'p0', 'inspect-pocket', 'pickpocket');
      const instanceId = give(room, 0, itemId); room.players[1]!.inventory.pockets[0]!.protectedBySafe = blocked;
      room = command(room, 'p0', { type: 'USE_ITEM', instanceId, targetId: 'p1', pocketIndex: 0 });
      expect(room.sideJobsByPlayer!.p0!.completed).toBe(!blocked);
    }
  });
  it('counts visible Downed loot and chest opening for their actual owner', () => {
    let room = game(); jobs(room, 'p0', 'loot', 'open-chest');
    damage(room, room.players[0]!, room.players[1]!, 5, 2, true);
    room = command(room, 'p0', { type: 'LOOT_DOWNED', targetId: 'p1', instanceId: room.players[1]!.inventory.visible[0]!.instanceId });
    expectDone(room, 'p0', 'loot');
    room = game(); jobs(room, 'p0', 'loot', 'open-chest'); const key = give(room, 0, 'key');
    room = command(room, 'p0', { type: 'USE_ITEM', instanceId: key }); expectDone(room, 'p0', 'open-chest');
  });
  it('counts Use, never Burn, and prevents rewards after permanent departure', () => {
    for (const use of [false, true]) {
      let room = game(); room.round!.number = 3; room.wildcardUnlocked = true; room.wildcardDeck = ['windfall', ...room.wildcardDeck!.filter(id => id !== 'windfall')]; jobs(room, 'p0', 'wildcard', 'trade');
      room = command(room, 'p0', { type: 'DRAW_WILDCARD' }); room = command(room, 'p0', { type: use ? 'USE_WILDCARD' : 'BURN_WILDCARD' });
      expect(room.sideJobsByPlayer!.p0!.completed).toBe(use);
    }
    for (const life of ['DEAD', 'EXITED'] as const) { const room = game(); jobs(room, 'p0', 'trade', 'damage'); room.players[0]!.life = life; completeTask(room, 'p0', ['trade'], 2); expect(room.sideJobsByPlayer!.p0!.completed).toBe(false); }
  });
  it('expires unresolved jobs, resets progress next Round, and replaces at most one irreversibly impossible job before the first opportunity', () => {
    const room = game(); const player = room.players[1]!;
    jobs(room, player.id, 'open-chest', 'revive'); const tasks = room.sideJobsByPlayer![player.id]!;
    tasks.jobs[0]!.prerequisites = ['chest:STANDARD']; tasks.jobs[1]!.prerequisites = ['player:p2'];
    room.chests![0]!.availability = 'OPENED'; room.players[2]!.life = 'DEAD';
    startTaskOpportunity(room, player, 2); expect(tasks.replacementUsed).toBe(true);
    const after = structuredClone(tasks); startTaskOpportunity(room, player, 3); expect(tasks).toEqual(after);
    expireTasks(room, 4); expect(tasks.jobs.every(task => task.status === 'EXPIRED')).toBe(true);
    room.round!.number = 2; assignTasks(room, 5);
    expect(room.sideJobsByPlayer![player.id]!.jobs.every(task => task.status === 'ACTIVE' && task.progress === 0)).toBe(true);
    expect(room.sideJobsByPlayer![player.id]!.replacementUsed).toBe(false);
    expect(room.sideJobsByPlayer!.p2).toBeUndefined();
  });
});
