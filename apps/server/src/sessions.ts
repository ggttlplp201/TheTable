import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { ProtocolError } from './protocol.js';

interface Session { roomCode: string; playerId: string; salt: string; digest: Buffer }

/** Plaintext reconnect secrets exist only while producing a join/reconnect reply. */
export class Sessions {
  private readonly records = new Map<string, Session>();
  private readonly players = new Map<string, string>();

  issue(roomCode: string, playerId: string): string {
    this.revoke(roomCode, playerId);
    const id = randomBytes(16).toString('base64url');
    const secret = randomBytes(32).toString('base64url');
    const salt = randomBytes(32).toString('base64url');
    this.records.set(id, { roomCode, playerId, salt, digest: digest(salt, secret) });
    this.players.set(`${roomCode}:${playerId}`, id);
    return `${id}.${secret}`;
  }

  verify(roomCode: string, token: string): string {
    const [id, secret, extra] = token.split('.');
    const record = id ? this.records.get(id) : undefined;
    if (!record || !secret || extra !== undefined || record.roomCode !== roomCode || !timingSafeEqual(record.digest, digest(record.salt, secret))) {
      throw new ProtocolError('INVALID_SESSION', 'Reconnect token is invalid or expired.');
    }
    return record.playerId;
  }

  revoke(roomCode: string, playerId: string): void {
    const key = `${roomCode}:${playerId}`;
    const id = this.players.get(key);
    if (id) this.records.delete(id);
    this.players.delete(key);
  }

  destroyRoom(roomCode: string): void {
    for (const [id, record] of this.records) {
      if (record.roomCode !== roomCode) continue;
      this.records.delete(id);
      this.players.delete(`${roomCode}:${record.playerId}`);
    }
  }
}

function digest(salt: string, secret: string): Buffer {
  return createHash('sha256').update(salt).update(':').update(secret).digest();
}
