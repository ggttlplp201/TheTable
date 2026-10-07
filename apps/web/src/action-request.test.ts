import { describe, expect, it, vi } from 'vitest';
import { dispatchRequest, type ActionRequest } from './action-request';
import { commandEnvelope } from './gameplay';
import { ownerRoom } from './test-fixtures';

describe('immutable action receipt dispatch', () => {
  it('retries the exact envelope after an acknowledgement timeout', async () => {
    const client = { command: vi.fn().mockResolvedValueOnce({ ok: false, error: { code: 'TIMEOUT', message: 'Lost acknowledgement' } }).mockResolvedValueOnce({ ok: true, data: { revision: 8 } }), sendChat: vi.fn(), rematch: vi.fn() };
    const room = ownerRoom();
    const request: ActionRequest = { kind: 'command', payload: commandEnvelope({ type: 'BUY', market: 'BLACK', offerId: 'secret-offer' }, room.public, 'same-receipt') };
    const original = structuredClone(request);
    await dispatchRequest(client, request);
    room.public.revision = 12;
    await dispatchRequest(client, request);
    expect(request).toEqual(original);
    expect(client.command.mock.calls[0]?.[0]).toBe(client.command.mock.calls[1]?.[0]);
    expect(client.command.mock.calls[1]?.[0]).toMatchObject({ expectedRevision: 7, idempotencyKey: 'same-receipt' });
  });
  it('keeps one-recipient chat in its dedicated transport and rematch in lifecycle transport', async () => {
    const client = { command: vi.fn(), sendChat: vi.fn().mockResolvedValue({ ok: true, data: { revision: 9 } }), rematch: vi.fn().mockResolvedValue({ ok: true, data: { revision: 10 } }) };
    const chat: ActionRequest = { kind: 'chat', payload: { text: 'Private offer', toPlayerId: 'p2', roomId: 'room-id', expectedRevision: 8, idempotencyKey: 'chat-receipt' } };
    await dispatchRequest(client, chat);
    expect(client.sendChat).toHaveBeenCalledWith(chat.payload);
    await dispatchRequest(client, { kind: 'rematch', idempotencyKey: 'rematch-receipt', expectedRevision: 9 });
    expect(client.rematch).toHaveBeenCalledWith('rematch-receipt', 9);
    expect(client.command).not.toHaveBeenCalled();
  });
});
