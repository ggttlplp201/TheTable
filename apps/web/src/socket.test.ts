import { beforeEach, describe, expect, it, vi } from 'vitest';

const transport = vi.hoisted(() => {
  const socket = {
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn((_event: string, _payload: unknown, acknowledge: (result: unknown) => void) => acknowledge({ ok: true, data: { revision: 12 } })),
    connect: vi.fn(),
    disconnect: vi.fn(),
  };
  return { socket, io: vi.fn(() => socket) };
});

vi.mock('socket.io-client', () => ({ io: transport.io }));

import { TableClient } from './socket';

describe('TableClient', () => {
  beforeEach(() => {
    transport.socket.emit.mockClear();
  });

  it('sends role claims with an idempotency key and expected revision', async () => {
    const client = new TableClient('http://table.test');

    await client.claimRole('medic', 'claim-1', 7);

    expect(transport.socket.emit).toHaveBeenCalledWith('lobby:claim-role', {
      roleId: 'medic',
      idempotencyKey: 'claim-1',
      expectedRevision: 7,
    }, expect.any(Function));
  });

  it('treats mutations as revision acknowledgements, not snapshots', async () => {
    const client = new TableClient('http://table.test');

    const result = await client.ready(true, 'ready-1', 12);

    expect(result).toEqual({ ok: true, data: { revision: 12 } });
    expect(transport.socket.emit).toHaveBeenCalledWith('lobby:ready', {
      ready: true,
      idempotencyKey: 'ready-1',
      expectedRevision: 12,
    }, expect.any(Function));
  });

  it('requests spectator state only after a room identity exists server-side', async () => {
    const client = new TableClient('http://table.test');

    await client.spectate();

    expect(transport.socket.emit).toHaveBeenCalledWith('room:spectate', {}, expect.any(Function));
  });

  it('coalesces concurrent reconnects that use the same one-time token', async () => {
    const client = new TableClient('http://table.test');

    const first = client.reconnect('ABC123', 'single-use-token');
    const replay = client.reconnect('ABC123', 'single-use-token');

    expect(replay).toBe(first);
    expect(transport.socket.emit).toHaveBeenCalledTimes(1);
    expect(transport.socket.emit).toHaveBeenCalledWith('room:reconnect', {
      code: 'ABC123',
      reconnectToken: 'single-use-token',
    }, expect.any(Function));
    await first;

    await client.reconnect('ABC123', 'single-use-token');
    expect(transport.socket.emit).toHaveBeenCalledTimes(2);
  });

  it('uses explicit opt-in presence before browser voice signaling', async () => {
    const client = new TableClient('http://table.test');

    await client.joinVoice();
    await client.signalVoice({ toPlayerId: 'p2', signal: { type: 'offer', sdp: 'offer' } });
    await client.leaveVoice();

    expect(transport.socket.emit).toHaveBeenNthCalledWith(1, 'voice:join', {}, expect.any(Function));
    expect(transport.socket.emit).toHaveBeenNthCalledWith(2, 'voice:signal', { toPlayerId: 'p2', signal: { type: 'offer', sdp: 'offer' } }, expect.any(Function));
    expect(transport.socket.emit).toHaveBeenNthCalledWith(3, 'voice:leave', {}, expect.any(Function));
  });
});
