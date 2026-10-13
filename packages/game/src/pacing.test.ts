import { describe, expect, it } from 'vitest';
import { BALANCE } from '@the-table/content';
import { applyCommand, applyTimeout, getNextDeadline, projectAuthorizedRoom, startMatch, type GameCommand, type PlayerState, type RoomState } from './index.js';
import { stack } from './inventory.js';
function game(): RoomState {
  let room = startMatch({ id: 'pacing', code: 'ABC234', revision: 1, status: 'LOBBY', hostPlayerId: 'p0', createdAt: 0, updatedAt: 0,
    players: ['enforcer', 'medic', 'locksmith'].map((roleId, seat) => ({ id: `p${seat}`, seat, name: `Player ${seat}`, normalizedName: `player ${seat}`, connection: 'CONNECTED', roleId, ready: true, hp: 5, score: 0, life: 'ACTIVE', inventory: { visible: Array(6).fill(null), pockets: [{ source: 'DEFAULT', protectedBySafe: false, item: null }], coins: 2 } })) as PlayerState[] }, { seed: 77, now: 1 });
  room = applyTimeout(room, room.setup!.deadlineAt);
  room.players.forEach((player, index) => { player.objective = { objectiveId: ['escapist', 'collector', 'tycoon'][index]!, status: 'ACTIVE', progress: {}, rewardGranted: false }; });
  return room;
}
const send = (room: RoomState, actor: string, command: GameCommand) => applyCommand(room, actor, command, room.updatedAt + 1);
function give(room: RoomState, seat: number, itemId: string) { const item = stack(room, itemId); const player = room.players[seat]!; player.inventory.visible[player.inventory.visible.findIndex(value => !value)] = item; return item.instanceId; }
describe('canonical authoritative pacing', () => {
  it('uses the approved central timing values', () => {
    expect([BALANCE.normalTurnMs, BALANCE.interactionResponseMs, BALANCE.acquisitionChoiceMs, BALANCE.intermissionPrepMs, BALANCE.publicShopDecisionMs, BALANCE.privateMarketGraceMs]).toEqual([60000,30000,15000,10000,30000,30000]);
  });
  it('passes immediately and never lets an off-turn player or an incoming response pass', () => {
    let room = game(); expect(projectAuthorizedRoom(room, 'p0').private.capabilities).toContain('PASS_TURN');
    expect(() => send(room, 'p1', { type: 'PASS_TURN' })).toThrow('turn');
    room = send(room, 'p0', { type: 'TRADE', targetId: 'p1', offeredItems: [], requestedItems: [], offeredCoins: 1, requestedCoins: 0 });
    for (const actor of ['p0','p1']) expect(() => send(room, actor, { type: 'PASS_TURN' })).toThrow('pending');
    room = send(room, 'p1', { type: 'RESPOND_TRADE', accept: false }); expect(room.turn!.activeSeat).toBe(1);
    room = send(room, 'p1', { type: 'PASS_TURN' }); expect(room.turn!.activeSeat).toBe(2);
  });
  it('advances after direct use, after responses and after Burn, but holds targeted Wildcards', () => {
    let room = game(); const knife = give(room, 0, 'knife');
    room = send(room, 'p0', { type: 'USE_ITEM', instanceId: knife, targetId: 'p1' }); expect(room.turn!.activeSeat).toBe(1);
    room = send(room, 'p1', { type: 'TRADE', targetId: 'p2', offeredItems: [], requestedItems: [], offeredCoins: 1, requestedCoins: 0 });
    expect(room.turn!.activeSeat).toBe(1); expect(room.pendingTrade!.deadlineAt - room.updatedAt).toBe(30000);
    room = applyTimeout(room, getNextDeadline(room)!); expect(room.turn!.activeSeat).toBe(2);
    room.round!.number = 3; room.wildcardUnlocked = true; room.wildcardDeck = ['seize', ...room.wildcardDeck!.filter(id => id !== 'seize')];
    room = send(room, 'p2', { type: 'DRAW_WILDCARD' }); expect(room.turn!.activeSeat).toBe(2);
    room = send(room, 'p2', { type: 'USE_WILDCARD' }); expect(room.turn!.activeSeat).toBe(2);
    room = send(room, 'p2', { type: 'RESOLVE_WILDCARD', targetId: 'p0', instanceId: room.players[0]!.inventory.visible.find(Boolean)!.instanceId });
    expect(room.round!.phase).toBe('INTERMISSION');
  });
  it.each(['loot', 'skip', 'timeout'])('preserves a bounded immediate attacker %s decision', resolution => {
    let room = game(); room.players[1]!.hp = 1; const knife = give(room, 0, 'knife');
    room = send(room, 'p0', { type: 'USE_ITEM', instanceId: knife, targetId: 'p1' });
    expect(room.turn!.activeSeat).toBe(0); expect(room.turn!.immediateLoot!.deadlineAt).toBe(room.updatedAt + 15000);
    expect(() => send(room, 'p0', { type: 'PASS_TURN' })).toThrow('committed');
    room = resolution === 'timeout' ? applyTimeout(room, getNextDeadline(room)!) : send(room, 'p0', resolution === 'skip' ? { type: 'SKIP_LOOT' } : { type: 'LOOT_DOWNED', targetId: 'p1', instanceId: room.players[1]!.inventory.visible.find(Boolean)!.instanceId });
    expect(room.turn!.activeSeat).toBe(1); expect(room.players[1]!.life).toBe('DOWNED');
  });
  it('settles required overflow and pays a last-seat Task before expiry and Round Income', () => {
    let room = game(); room = send(room, 'p0', { type: 'PASS_TURN' }); room = send(room, 'p1', { type: 'PASS_TURN' });
    room.sideJobsByPlayer!.p2 = { round: 1, reward: 2, jobs: [{ id: 'open-chest', status: 'ACTIVE', progress: 0, prerequisites: [] }, { id: 'trade', status: 'ACTIVE', progress: 0, prerequisites: [] }], completed: false, opportunityTaken: true, replacementUsed: false };
    room.players[2]!.inventory.visible = Array.from({ length: 6 }, () => stack(room, 'cloth'));
    const key = stack(room, 'key'); room.players[2]!.inventory.pockets[0]!.item = key;
    room.chests![0]!.loot = [{ kind: 'ITEM', stack: stack(room, 'pistol') }, { kind: 'ITEM', stack: stack(room, 'medicine') }];
    room = send(room, 'p2', { type: 'USE_ITEM', instanceId: key.instanceId });
    expect(room.turn!.activeSeat).toBe(2); expect(room.overflows).toHaveLength(2); expect(room.sideJobsByPlayer!.p2!.completed).toBe(true);
    for (const overflow of [...room.overflows!]) room = send(room, 'p2', { type: 'OVERFLOW_CHOICE', overflowId: overflow.id });
    expect(room.round!.phase).toBe('INTERMISSION');
    const events = room.events!; expect(events.findIndex(event => event.kind === 'TASK_COMPLETED')).toBeLessThan(events.findIndex(event => event.kind === 'ROUND_INCOME_GRANTED'));
  });
});
