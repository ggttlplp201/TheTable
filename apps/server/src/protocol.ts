import { createHash } from 'node:crypto';
import { z } from 'zod';

export class ProtocolError extends Error {
  constructor(readonly code: string, message: string) { super(message); }
}

const name = z.string().trim().min(1).max(24);
const code = z.string().trim().toUpperCase().regex(/^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6}$/);
export const createInput = z.object({ name }).strict();
export const joinInput = z.object({ name, code }).strict();
export const reconnectInput = z.object({ code, reconnectToken: z.string().min(40).max(200), idempotencyKey: z.string().min(16).max(100).regex(/^[A-Za-z0-9._:-]+$/).optional() }).strict();
const metadata = {
  idempotencyKey: z.string().min(1).max(100).regex(/^[A-Za-z0-9._:-]+$/),
  expectedRevision: z.number().int().nonnegative().optional(),
  roomId: z.string().min(1).max(100).optional(),
};
export const commandInput = z.object({
  ...metadata,
  type: z.string().min(1).max(64),
  payload: z.record(z.string(), z.unknown()).default({}),
}).strict();
export const roleInput = z.object({ ...metadata, roleId: z.enum(['enforcer', 'medic', 'smuggler', 'locksmith', 'broker', 'scavenger']) }).strict();
export const readyInput = z.object({ ...metadata, ready: z.boolean() }).strict();
export const metadataInput = z.object(metadata).strict();
export const chatInput = z.object({ ...metadata, text: z.string().trim().min(1).max(1000), toPlayerId: z.string().max(100).optional() }).strict();
export const signalInput = z.object({
  toPlayerId: z.string().min(1).max(100),
  signal: z.union([
    z.object({ type: z.enum(['offer', 'answer']), sdp: z.string().max(16000) }).strict(),
    z.object({ type: z.literal('candidate'), candidate: z.string().max(2000), sdpMid: z.string().max(100).nullable().optional(), sdpMLineIndex: z.number().int().min(0).max(100).nullable().optional() }).strict(),
  ]),
}).strict();
export const emptyInput = z.object({}).strict();
export type CommandInput = z.infer<typeof commandInput>;
export interface GameCommand { type: string; payload: Record<string, unknown> }
export type Reply = { ok: true; data: unknown } | { ok: false; error: { code: string; message: string; revision?: number } };

export function rejection(error: unknown, revision?: number): Reply {
  if (revision === undefined && error instanceof Error && 'revision' in error && typeof error.revision === 'number') revision = error.revision;
  const body = error instanceof z.ZodError
    ? { code: 'INVALID_INPUT', message: error.issues[0]?.message ?? 'Invalid input.' }
    : error instanceof Error && 'code' in error && typeof error.code === 'string'
      ? { code: error.code, message: error.message }
      : { code: 'INTERNAL_ERROR', message: 'The table failed to resolve that action.' };
  return { ok: false, error: { ...body, ...(revision === undefined ? {} : { revision }) } };
}

// Canonical key ordering makes retries independent of JSON property order.
// Store a fixed-size digest rather than retaining untrusted request payloads.
export function fingerprint(value: unknown): string {
  let nodes = 0;
  const canonical = (current: unknown, depth: number): string => {
    if (depth > 16 || ++nodes > 4096) throw new ProtocolError('INVALID_INPUT', 'Command payload is too complex.');
    if (Array.isArray(current)) return `[${current.map(item => canonical(item, depth + 1)).join(',')}]`;
    if (current && typeof current === 'object') return `{${Object.entries(current).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item, depth + 1)}`).join(',')}}`;
    return JSON.stringify(current) ?? 'null';
  };
  return createHash('sha256').update(canonical(value, 0)).digest('hex');
}
