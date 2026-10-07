import { describe, expect, it } from 'vitest';
import type { PlayerCommand, RoomView, SpectatorRoomView } from './protocol';
import { canRematch, commandEnvelope, hasCapability, remainingSeconds, useItemOptions, useItemTargets, useItemCommand } from './gameplay';
import { ownerRoom, spectatorRoom } from './test-fixtures';

describe('gameplay command adapter', () => {
  const commands: PlayerCommand[] = [
    { type: 'USE_ITEM', instanceId: 'pocket-medicine', targetId: 'p2', pocketIndex: 0, useQuickDraw: true },
    { type: 'TRADE', targetId: 'p2', offeredItems: ['knife'], offeredCoins: 0, requestedItems: [], requestedCoins: 2 },
    { type: 'THREAT', targetId: 'p2', mode: 'COVERED', committedItemId: 'knife', clothItemId: 'cloth', demandedItems: [], demandedCoins: 2, useQuickDraw: true },
    { type: 'RESPOND_TRADE', accept: false }, { type: 'RESPOND_THREAT', comply: false },
    { type: 'DOWNED_INTERACTION', targetId: 'p2', kind: 'HELP', instanceId: 'antidote' },
    { type: 'LOOT_DOWNED', targetId: 'p2', instanceId: 'knife' },
    { type: 'OVERFLOW_CHOICE', overflowId: 'overflow' },
    { type: 'OVERFLOW_CHOICE', overflowId: 'overflow', replaceInstanceId: 'knife' },
    { type: 'BUY', market: 'PUBLIC', offerId: 'offer', useRedLedger: true },
    { type: 'BUY', market: 'BLACK', offerId: 'private-offer' },
    { type: 'SELL', instanceId: 'knife' }, { type: 'POCKET', instanceId: 'knife', pocketIndex: 1 },
    { type: 'ASSIGN_SAFE', instanceId: 'safe', pocketIndex: 0 },
    { type: 'REROLL_MARKET', offerId: 'offer' }, { type: 'INSPECT_CHEST' },
    { type: 'STAY' }, { type: 'LEAVE_TABLE' }, { type: 'END_TURN' }, { type: 'FINISH_SHOPPING' },
  ];
  it.each(commands)('preserves $type fields and revision without actor/clock/seed authority', command => {
    const room = ownerRoom();
    const envelope = commandEnvelope(command, room.public, 'deliberate-action-1');
    const { type, ...payload } = command;
    expect(envelope).toEqual({ type, payload, idempotencyKey: 'deliberate-action-1', expectedRevision: 7, roomId: 'room-id' });
    expect(envelope).not.toHaveProperty('actorId');
    expect(envelope.payload).not.toHaveProperty('now');
    expect(envelope.payload).not.toHaveProperty('seed');
    expect(commandEnvelope(command, room.public, 'deliberate-action-1')).toEqual(envelope);
  });
  it('uses only supplied capabilities, never turn/role/inventory inference', () => {
    const room = ownerRoom();
    room.private.capabilities = [];
    expect(hasCapability(room, 'USE_ITEM')).toBe(false);
    room.private.capabilities = ['RESPOND_TRADE'];
    expect(hasCapability(room, 'RESPOND_TRADE')).toBe(true);
    expect(hasCapability(room, 'TRADE')).toBe(false);
    const spectator = spectatorRoom();
    spectator.players[0]!.private.capabilities = ['USE_ITEM'];
    expect(hasCapability(spectator, 'USE_ITEM')).toBe(false);
  });
  it('allows only public host Results rematch, including a verified spectator host', () => {
    const owner: RoomView = ownerRoom();
    const spectator: SpectatorRoomView = spectatorRoom();
    expect(canRematch(owner, 'p1')).toBe(false);
    owner.public.status = spectator.public.status = 'RESULTS';
    expect(canRematch(owner, 'p1')).toBe(true);
    expect(canRematch(spectator, 'p1')).toBe(true);
    expect(canRematch(spectator, 'p2')).toBe(false);
  });
  it('counts absolute deadlines without going negative or resolving locally', () => {
    expect(remainingSeconds(10_000, 7_500)).toBe(3);
    expect(remainingSeconds(10_000, 10_100)).toBe(0);
  });
});


describe('item input adapter', () => {
  it('omits passive equipment from normal item use but includes usable Pocket items', () => {
    const room = ownerRoom();
    room.public.players[0]!.visibleInventory.push({ instanceId: 'ammo', itemId: 'bullet', quantity: 2 }, { instanceId: 'armor', itemId: 'armor', quantity: 1 }, { instanceId: 'bag', itemId: 'bag', quantity: 1 });
    expect(useItemOptions(room).map(item => item.itemId)).toEqual(['pistol', 'medicine']);
  });
  it('narrows attacks to active opponents and healing to living players', () => {
    const room = ownerRoom();
    expect(useItemTargets(room, 'pistol').map(player => player.id)).toEqual(['p2']);
    room.public.players[1]!.life = 'DOWNED';
    expect(useItemTargets(room, 'pistol')).toEqual([]);
    expect(useItemTargets(room, 'medicine').map(player => player.id)).toEqual(['p2']);
    expect(useItemTargets(room, 'key')).toEqual([]);
  });
  it('uses fixed seats for Knife target options without closing gaps after a death', () => {
    const room = ownerRoom();
    const player = room.public.players[1]!;
    room.public.players.push({ ...player, id: 'p3', seat: 2 }, { ...player, id: 'p4', seat: 3 });
    room.public.players[1]!.life = 'DEAD';
    expect(useItemTargets(room, 'knife').map(target => target.id)).toEqual(['p4']);
  });
  it('encodes attack targets, self medicine, Pocket inspection and targetless chest access', () => {
    const item = { instanceId: 'item', itemId: 'pistol', quantity: 1 };
    expect(useItemCommand(item, 'p2', undefined, true)).toEqual({ type: 'USE_ITEM', instanceId: 'item', targetId: 'p2', useQuickDraw: true });
    expect(useItemCommand({ ...item, itemId: 'medicine' }, 'self')).toEqual({ type: 'USE_ITEM', instanceId: 'item' });
    expect(useItemCommand({ ...item, itemId: 'spyglass' }, 'p2', 1)).toEqual({ type: 'USE_ITEM', instanceId: 'item', targetId: 'p2', pocketIndex: 1 });
    expect(useItemCommand({ ...item, itemId: 'key' }, 'p2')).toEqual({ type: 'USE_ITEM', instanceId: 'item' });
  });
});
