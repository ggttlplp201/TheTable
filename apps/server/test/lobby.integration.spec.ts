/**
 * Socket.IO contract coverage for the implemented lobby slice.
 *
 * Each test owns an ephemeral server and independent Socket.IO clients.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { io, type Socket } from 'socket.io-client';
import { createTableServer, type TableServer } from '../src/server.js';

type Ack<T> = { ok: true; data: T } | { ok: false; error: { code: string; message: string } };
type PublicRoom = {
  code: string;
  revision: number;
  players: Array<{ id: string; seat: number; name: string; connection: string; roleId?: string }>;
};
type CreateReply = { reconnectToken: string; view: { public: PublicRoom; private: { playerId: string } } };

/**
 * A live factory keeps transport tests hermetic and prevents port collisions.
 */
let url = '';
let sockets: Socket[] = [];
let server: TableServer | undefined;

beforeEach(async () => {
  server = createTableServer();
  url = await server.listen();
});

afterEach(async () => {
  sockets.forEach((socket) => socket.disconnect());
  sockets = [];
  await server?.close();
  server = undefined;
});

async function client(): Promise<Socket> {
  const socket = io(url, { forceNew: true, transports: ['websocket'] });
  sockets.push(socket);
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Timed out connecting test client.')), 1_000);
    socket.once('connect', () => { clearTimeout(timeout); resolve(); });
    socket.once('connect_error', reject);
  });
  return socket;
}

function emitAck<T>(socket: Socket, event: string, payload: unknown): Promise<Ack<T>> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Timed out waiting for ${event} acknowledgement.`)), 1_000);
    socket.emit(event, payload, (reply: Ack<T>) => {
      clearTimeout(timeout);
      resolve(reply);
    });
  });
}

function once<T>(socket: Socket, event: string): Promise<T> {
  return new Promise((resolve) => socket.once(event, resolve));
}

function successful<T>(reply: Ack<T>): T {
  expect(reply).toMatchObject({ ok: true });
  if (!reply.ok) throw new Error(`${reply.error.code}: ${reply.error.message}`);
  return reply.data;
}

describe('lobby Socket.IO contract', () => {
  it('can join a valid room after a failed code attempt on the same connection', async () => {
    const host = await client();
    const created = successful(await emitAck<CreateReply>(host, 'room:create', { name: 'Host' }));
    const guest = await client();
    const missingCode = created.view.public.code === 'AAAAAA' ? 'BBBBBB' : 'AAAAAA';
    expect(await emitAck(guest, 'room:join', { code: missingCode, name: 'Guest' })).toMatchObject({
      ok: false, error: { code: 'ROOM_NOT_FOUND' },
    });

    const joined = successful(await emitAck<CreateReply>(guest, 'room:join', {
      code: `  ${created.view.public.code.toLowerCase()}  `, name: 'Guest',
    }));
    expect(joined.view.public.code).toBe(created.view.public.code);
    expect(joined.view.public.players.map(player => player.name)).toEqual(['Host', 'Guest']);
    expect(joined.view.private.playerId).not.toBe(created.view.private.playerId);
  });

  it.each([2, 3, 4])('lets %i independent clients join distinct seats and publishes one public revision', async (count) => {
    const host = await client();
    const created = successful(await emitAck<CreateReply>(host, 'room:create', { name: 'Host' }));
    const roomCode = created.view.public.code;
    let latest = created.view.public;

    for (let index = 1; index < count; index += 1) {
      const joining = await client();
      const publicUpdate = once<PublicRoom>(host, 'room:public');
      const joined = successful(await emitAck<CreateReply>(joining, 'room:join', { code: roomCode, name: `Player ${index}` }));
      const published = await publicUpdate;
      expect(joined.view.public.players).toHaveLength(index + 1);
      expect(published.players).toHaveLength(index + 1);
      expect(published.revision).toBe(joined.view.public.revision);
      latest = joined.view.public;
    }

    expect(latest.players.map((player) => player.seat)).toEqual([...Array(count).keys()]);
  });

  it('rejects a fifth client without mutating the four-player room', async () => {
    const host = await client();
    const created = successful(await emitAck<CreateReply>(host, 'room:create', { name: 'Host' }));
    for (const name of ['One', 'Two', 'Three']) {
      successful(await emitAck(await client(), 'room:join', { code: created.view.public.code, name }));
    }

    const overflow = await emitAck(await client(), 'room:join', { code: created.view.public.code, name: 'Four' });
    expect(overflow).toMatchObject({ ok: false, error: { code: 'ROOM_FULL' } });
  });

  it('rejects a second room admission from an already-bound socket', async () => {
    const socket = await client();
    successful(await emitAck<CreateReply>(socket, 'room:create', { name: 'First Host' }));

    const secondAdmission = await emitAck(socket, 'room:create', { name: 'Second Host' });
    expect(secondAdmission).toMatchObject({ ok: false, error: { code: 'ALREADY_JOINED' } });
  });

  it('serializes competing role claims so exactly one client owns the role', async () => {
    const host = await client();
    const created = successful(await emitAck<CreateReply>(host, 'room:create', { name: 'Host' }));
    const guest = await client();
    successful(await emitAck<CreateReply>(guest, 'room:join', { code: created.view.public.code, name: 'Guest' }));

    const replies = await Promise.all([
      emitAck(host, 'lobby:claim-role', { roleId: 'medic', idempotencyKey: 'host-medic' }),
      emitAck(guest, 'lobby:claim-role', { roleId: 'medic', idempotencyKey: 'guest-medic' }),
    ]);
    expect(replies.filter((reply) => reply.ok)).toHaveLength(1);
    expect(replies.find((reply) => !reply.ok)).toMatchObject({ ok: false, error: { code: 'ROLE_TAKEN' } });
  });

  it('rotates a reconnect token and revokes the old socket authority', async () => {
    const first = await client();
    const created = successful(await emitAck<CreateReply>(first, 'room:create', { name: 'Host' }));
    const replaced = once<{ code: string }>(first, 'session:replaced');
    const replacement = await client();
    const reconnected = successful(await emitAck<CreateReply>(replacement, 'room:reconnect', {
      code: created.view.public.code,
      reconnectToken: created.reconnectToken,
    }));

    expect(reconnected.view.private.playerId).toBe(created.view.private.playerId);
    expect(reconnected.reconnectToken).not.toBe(created.reconnectToken);
    await expect(replaced).resolves.toEqual({ code: 'SESSION_REPLACED' });
    expect(first.connected).toBe(false);
    successful(await emitAck(replacement, 'lobby:claim-role', { roleId: 'medic', idempotencyKey: 'replacement-role' }));
    const replay = await emitAck(await client(), 'room:reconnect', {
      code: created.view.public.code,
      reconnectToken: created.reconnectToken,
    });
    expect(replay).toMatchObject({ ok: false, error: { code: 'INVALID_SESSION' } });
  });

  it('does not leak a private chat sentinel to a third client or room:public', async () => {
    const host = await client();
    const created = successful(await emitAck<CreateReply>(host, 'room:create', { name: 'Host' }));
    const guest = await client();
    const joined = successful(await emitAck<CreateReply>(guest, 'room:join', { code: created.view.public.code, name: 'Guest' }));
    const bystander = await client();
    successful(await emitAck<CreateReply>(bystander, 'room:join', { code: created.view.public.code, name: 'Bystander' }));

    const privateSentinel = 'qa-private-message-never-for-bystander';
    const bystanderView = once<unknown>(bystander, 'room:view');
    const bystanderPublic = once<PublicRoom>(bystander, 'room:public');
    successful(await emitAck(host, 'chat:send', {
      idempotencyKey: 'private-chat',
      text: privateSentinel,
      toPlayerId: joined.view.private.playerId,
    }));

    expect(JSON.stringify(await bystanderView)).not.toContain(privateSentinel);
    expect(JSON.stringify(await bystanderPublic)).not.toContain(privateSentinel);
  });
});
