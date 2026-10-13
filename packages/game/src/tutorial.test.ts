import { describe, expect, it } from 'vitest';
import { TutorialController, HUMAN, DEALER } from './tutorial.js';
import { projectAuthorizedRoom } from './projection.js';
import { assertRoomInvariants } from './invariants.js';
import { startMatch } from './engine.js';
const find = (t: TutorialController, owner: string, id: string) => { const player=t.room.players.find(player=>player.id===owner)!; return [...player.inventory.visible,...player.inventory.pockets.map(p=>p.item)].find(item=>item?.itemId===id)!; };
describe('real-engine Dealer tutorial', () => {
  it('plays every required chapter with private Tasks, a legal Down, real shopping, chest objective and Seize', () => {
    const t=new TutorialController();
    expect(t.view().public.mode).toBe('tutorial'); expect(t.room.players).toHaveLength(2);
    expect(t.look(4)).toBe(false); expect(t.look(4)).toBe(true); t.next(); t.next();
    const before=structuredClone(t.room);
    expect(()=>t.submit({type:'POCKET',instanceId:find(t,HUMAN,'knife').instanceId,pocketIndex:0})).toThrow('Medicine'); expect(t.room).toEqual(before);
    t.submit({type:'POCKET',instanceId:find(t,HUMAN,'medicine').instanceId,pocketIndex:0});
    expect(t.view().private.pockets[0]!.item?.itemId).toBe('medicine');
    expect(projectAuthorizedRoom(t.room,DEALER).public.players[0]!.pocketOccupancy[0]).toBe(true);
    t.next(); const coins=t.room.players[0]!.inventory.coins;
    t.submit({type:'TRADE',targetId:DEALER,offeredItems:[find(t,HUMAN,'key').instanceId],requestedItems:[],offeredCoins:0,requestedCoins:2});
    expect(t.room.players[0]!.inventory.coins).toBe(coins+4); expect(t.room.turn!.activeSeat).toBe(1);
    t.next(); expect(t.room.pendingThreat?.mode).toBe('COVERED');
    const hp=t.room.players[0]!.hp; t.submit({type:'RESPOND_THREAT',comply:false}); expect(t.room.players[0]!.hp).toBe(hp);
    t.next(); t.submit({type:'THREAT',mode:'COVERED',targetId:DEALER,committedItemId:find(t,HUMAN,'knife').instanceId,clothItemId:find(t,HUMAN,'cloth').instanceId,demandedItems:[],demandedCoins:1});
    t.next(); expect(t.room.players[0]!.life).toBe('DOWNED'); expect(t.room.turn!.startedDowned).toBe(true);
    t.submit({type:'USE_ITEM',instanceId:find(t,HUMAN,'medicine').instanceId,targetId:HUMAN}); expect(t.room.players[0]!.hp).toBe(2); expect(t.room.round!.phase).toBe('INTERMISSION');
    expect(t.room.events!.filter(event=>event.kind==='ROUND_INCOME_GRANTED')).toHaveLength(1);
    t.next(); expect(t.view().private.capabilities).not.toContain('BUY_BLACK');
    t.submit({type:'BUY',market:'PUBLIC',offerId:'training-key'}); expect(t.view().private.capabilities).toContain('BUY_BLACK');
    t.submit({type:'BUY',market:'BLACK',offerId:'training-antidote'}); t.submit({type:'FINISH_SHOPPING'});
    expect(t.room.round!.number).toBe(2); t.submit({type:'USE_ITEM',instanceId:find(t,HUMAN,'key').instanceId});
    expect(t.room.players[0]!.objective?.status).toBe('EXIT_READY'); expect(t.view().private.capabilities).not.toContain('LEAVE_TABLE');
    t.next(); expect(t.room.round!.number).toBe(3); expect(t.room.wildcardUnlocked).toBe(true);
    t.submit({type:'DRAW_WILDCARD'}); expect(t.view().private.pendingWildcard?.cardId).toBe('seize'); expect(projectAuthorizedRoom(t.room,DEALER).private.pendingWildcard).toBeUndefined();
    expect(()=>t.submit({type:'BURN_WILDCARD'})).toThrow('restored'); expect(t.step).toBe('draw'); assertRoomInvariants(t.room);
    t.submit({type:'DRAW_WILDCARD'}); t.submit({type:'USE_WILDCARD'});
    const taken=find(t,DEALER,'pistol'); t.submit({type:'RESOLVE_WILDCARD',targetId:DEALER,instanceId:taken.instanceId});
    expect(find(t,HUMAN,'pistol').instanceId).toBe(taken.instanceId); t.next();
    expect(t.view().private.capabilities).toContain('LEAVE_TABLE'); t.submit({type:'LEAVE_TABLE'});
    expect(t.step).toBe('complete'); expect(t.room.players[0]!.life).toBe('EXITED'); expect(t.room.players[0]!.score).toBe(0); assertRoomInvariants(t.room);
  });
  it.each([1,2,3,4,5,6])('restages chapter %i with a valid, winnable checkpoint', chapter => {
    const t=new TutorialController(); t.resume(chapter); expect(t.chapter).toBe(chapter); assertRoomInvariants(t.room);
  });
  it('rejects a two-player start without tutorial mode and tolerates slow lesson reading', () => {
    let now=1000; const t=new TutorialController(()=>now); const lobby=structuredClone(t.room); lobby.status='LOBBY'; delete lobby.mode;
    expect(()=>startMatch(lobby,{seed:42,now:lobby.updatedAt})).toThrow('three or four');
    t.resume(2); now+=3600_000;
    expect(()=>t.submit({type:'TRADE',targetId:DEALER,offeredItems:[find(t,HUMAN,'key').instanceId],requestedItems:[],offeredCoins:0,requestedCoins:2})).not.toThrow();
  });
});
