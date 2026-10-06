import { createServer } from 'node:http';
import cors from 'cors';
import express from 'express';
import { Server } from 'socket.io';
import { z } from 'zod';
import { RoomError, RoomStore } from '@the-table/game';

const port = Number(process.env.PORT ?? 3001);
const origin = process.env.CLIENT_ORIGIN ?? 'http://localhost:5173';
const app = express();
app.disable('x-powered-by');
app.use(cors({ origin, credentials: true }));
app.use(express.json({ limit: '16kb' }));
app.get('/health/live', (_req, res) => res.json({ ok: true }));
app.get('/health/ready', (_req, res) => res.json({ ok: true }));

const http = createServer(app);
const io = new Server(http, { cors: { origin, credentials: true }, maxHttpBufferSize: 32_000 });
const rooms = new RoomStore();
const name = z.string().trim().min(1).max(24);
const code = z.string().trim().length(6);
const token = z.string().min(20).max(200);
const role = z.enum(['enforcer','medic','smuggler','locksmith','broker','scavenger']);

io.on('connection', socket => {
  let identity: { code: string; playerId: string } | undefined;
  socket.on('room:create', (raw, ack) => respond(ack, () => {
    const input = z.object({ name }).parse(raw);
    const joined = rooms.createRoom(input.name);
    identity = { code: joined.room.code, playerId: joined.player.id };
    socket.join(joined.room.code); publish(joined.room.code);
    return { reconnectToken: joined.reconnectToken, view: rooms.viewFor(joined.room.code, joined.player.id) };
  }));
  socket.on('room:join', (raw, ack) => respond(ack, () => {
    const input = z.object({ code, name }).parse(raw);
    const joined = rooms.joinRoom(input.code, input.name);
    identity = { code: joined.room.code, playerId: joined.player.id };
    socket.join(joined.room.code); publish(joined.room.code);
    return { reconnectToken: joined.reconnectToken, view: rooms.viewFor(joined.room.code, joined.player.id) };
  }));
  socket.on('room:reconnect', (raw, ack) => respond(ack, () => {
    const input = z.object({ code, reconnectToken: token }).parse(raw);
    const joined = rooms.reconnect(input.code, input.reconnectToken);
    identity = { code: joined.room.code, playerId: joined.player.id };
    socket.join(joined.room.code); publish(joined.room.code);
    return { reconnectToken: joined.reconnectToken, view: rooms.viewFor(joined.room.code, joined.player.id) };
  }));
  socket.on('lobby:claim-role', (raw, ack) => respond(ack, () => {
    if (!identity) throw new RoomError('INVALID_SESSION', 'Join a room first.');
    const input = z.object({ roleId: role }).parse(raw);
    rooms.claimRole(identity.code, identity.playerId, input.roleId); publish(identity.code);
    return { view: rooms.viewFor(identity.code, identity.playerId) };
  }));
  socket.on('disconnect', () => {
    if (!identity) return;
    try { rooms.disconnect(identity.code, identity.playerId); publish(identity.code); } catch { /* room already gone */ }
  });

  function publish(roomCode: string) {
    const room = rooms.rooms.get(roomCode);
    if (room) io.to(roomCode).emit('room:public', rooms.viewFor(roomCode, room.hostPlayerId).public);
  }
});

function respond(ack: (value: unknown) => void, run: () => unknown) {
  try { ack({ ok: true, data: run() }); }
  catch (error) {
    if (error instanceof RoomError) return ack({ ok: false, error: { code: error.code, message: error.message } });
    if (error instanceof z.ZodError) return ack({ ok: false, error: { code: 'INVALID_INPUT', message: error.issues[0]?.message ?? 'Invalid input.' } });
    console.error(error); ack({ ok: false, error: { code: 'INTERNAL_ERROR', message: 'The table failed to resolve that action.' } });
  }
}

http.listen(port, () => console.log(`The Table server listening on :${port}`));
