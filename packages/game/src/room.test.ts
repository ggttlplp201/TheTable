import { describe, expect, it } from 'vitest';
import { RoomError, RoomStore, type RandomSource } from './index.js';

function deterministicRandom(): RandomSource {
  let value = 0;
  return {
    bytes(length) {
      const bytes = new Uint8Array(length);
      for (let index = 0; index < length; index += 1) bytes[index] = value++ % 251;
      return bytes;
    },
    uuid() {
      value += 1;
      return `id-${value}`;
    },
  };
}

function errorCode(run: () => unknown): string | undefined {
  try {
    run();
    return undefined;
  } catch (error) {
    return error instanceof RoomError ? error.code : 'unexpected';
  }
}

describe('RoomStore', () => {
  it('creates a six-character room and host session', () => {
    const store = new RoomStore({ random: deterministicRandom(), now: () => 10 });
    const result = store.createRoom('  Leon  ');
    expect(result.room.code).toHaveLength(6);
    expect(result.player.name).toBe('Leon');
    expect(result.room.hostPlayerId).toBe(result.player.id);
    expect(result.reconnectToken.length).toBeGreaterThan(20);
  });

  it('rejects invalid rooms, duplicate normalized names, and a fifth player', () => {
    const store = new RoomStore({ random: deterministicRandom() });
    const host = store.createRoom('Oren');
    expect(errorCode(() => store.joinRoom('bad', 'Ilka'))).toBe('INVALID_CODE');
    expect(errorCode(() => store.joinRoom('ZZZZZZ', 'Ilka'))).toBe('ROOM_NOT_FOUND');
    expect(errorCode(() => store.joinRoom(host.room.code, ' oren '))).toBe('DUPLICATE_NAME');
    store.joinRoom(host.room.code, 'Ilka');
    store.joinRoom(host.room.code, 'Vesna');
    store.joinRoom(host.room.code, 'Toma');
    expect(errorCode(() => store.joinRoom(host.room.code, 'Fifth'))).toBe('ROOM_FULL');
  });

  it('restores the same seat and rotates reconnect tokens', () => {
    const store = new RoomStore({ random: deterministicRandom() });
    const host = store.createRoom('Oren');
    store.disconnect(host.room.code, host.player.id);
    const reconnected = store.reconnect(host.room.code, host.reconnectToken);
    expect(reconnected.player.id).toBe(host.player.id);
    expect(reconnected.player.seat).toBe(0);
    expect(reconnected.room.players).toHaveLength(1);
    expect(reconnected.reconnectToken).not.toBe(host.reconnectToken);
    expect(errorCode(() => store.reconnect(host.room.code, host.reconnectToken))).toBe('INVALID_SESSION');
  });

  it('enforces unique, known roles in the lobby', () => {
    const store = new RoomStore({ random: deterministicRandom() });
    const host = store.createRoom('Oren');
    const guest = store.joinRoom(host.room.code, 'Ilka');
    store.claimRole(host.room.code, host.player.id, 'medic');
    expect(errorCode(() => store.claimRole(host.room.code, guest.player.id, 'medic'))).toBe('ROLE_TAKEN');
    expect(errorCode(() => store.claimRole(host.room.code, guest.player.id, 'wizard'))).toBe('ROLE_UNKNOWN');
  });

  it('never includes another active player private state in the public projection', () => {
    const store = new RoomStore({ random: deterministicRandom() });
    const host = store.createRoom('Oren');
    const guest = store.joinRoom(host.room.code, 'Ilka');
    host.player.inventory.pockets[0]!.item = { instanceId: 'secret-pocket-item', itemId: 'poison', quantity: 1 };
    host.player.objective = { objectiveId: 'secret-objective', status: 'ACTIVE', progress: { hidden: true }, rewardGranted: false };
    guest.player.inventory.pockets[0]!.item = { instanceId: 'guest-secret', itemId: 'knife', quantity: 1 };

    const guestView = store.viewFor(host.room.code, guest.player.id);
    const serializedPublic = JSON.stringify(guestView.public);
    expect(serializedPublic).not.toContain('secret-pocket-item');
    expect(serializedPublic).not.toContain('secret-objective');
    expect(serializedPublic).not.toContain('guest-secret');
    expect(guestView.private.pockets[0]?.item?.instanceId).toBe('guest-secret');
  });
});
