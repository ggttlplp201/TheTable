import { randomInt } from 'node:crypto';
import { z } from 'zod';
import type { GameCommand as EngineCommand } from '@the-table/game';
import { ProtocolError, type GameCommand } from './protocol.js';

const id = z.string().min(1).max(100);
const coins = z.number().int().min(0).max(1_000_000);
const items = z.array(id).max(6).refine(values => new Set(values).size === values.length, 'Item IDs must be unique.');
const pocket = z.number().int().min(0).max(1);
const empty = z.object({}).strict();
const payloads: Record<EngineCommand['type'], z.ZodType> & Record<string, z.ZodType> = {
  START_MATCH: empty,
  REMATCH: empty,
  READY: z.object({ ready: z.boolean() }).strict(),
  SET_READY: z.object({ ready: z.boolean() }).strict(),
  CLAIM_ROLE: z.object({ roleId: z.enum(['enforcer', 'medic', 'smuggler', 'locksmith', 'broker', 'scavenger']) }).strict(),
  END_TURN: empty,
  LEAVE_TABLE: empty,
  CONCEDE: empty,
  STAY: empty,
  FINISH_SHOPPING: empty,
  SKIP_PUBLIC_SHOP: empty,
  LOCK_SETUP: z.object({ instanceId: id }).strict(),
  USE_ITEM: z.object({ instanceId: id, targetId: id.optional(), pocketIndex: pocket.optional(), useQuickDraw: z.boolean().optional() }).strict(),
  TRADE: z.object({ targetId: id, offeredItems: items, offeredCoins: coins, requestedItems: items, requestedCoins: coins }).strict(),
  RESPOND_TRADE: z.object({ accept: z.boolean() }).strict(),
  THREAT: z.object({ targetId: id, mode: z.enum(['OPEN', 'COVERED']), committedItemId: id, clothItemId: id.optional(), demandedItems: items, demandedCoins: coins, useQuickDraw: z.boolean().optional() }).strict(),
  RESPOND_THREAT: z.object({ comply: z.boolean() }).strict(),
  DOWNED_INTERACTION: z.object({ targetId: id, kind: z.enum(['LOOT', 'REVIVE', 'HELP']), instanceId: id }).strict(),
  LOOT_DOWNED: z.object({ targetId: id, instanceId: id }).strict(),
  OVERFLOW_CHOICE: z.object({ overflowId: id, replaceInstanceId: id.optional() }).strict(),
  BUY: z.object({ market: z.enum(['PUBLIC', 'BLACK']), offerId: id, useRedLedger: z.boolean().optional() }).strict(),
  SELL: z.object({ instanceId: id }).strict(),
  POCKET: z.object({ instanceId: id, pocketIndex: pocket }).strict(),
  ASSIGN_SAFE: z.object({ instanceId: id, pocketIndex: pocket }).strict(),
  INSPECT_CHEST: empty,
  REROLL_MARKET: z.object({ offerId: id }).strict(),
};

/** Identity, time and initial randomness are always supplied by the server. */
export function parseGameCommand(command: GameCommand, seed: () => number = () => randomInt(0x1_0000_0000)): EngineCommand {
  const schema = Object.hasOwn(payloads, command.type) ? payloads[command.type] : undefined;
  if (!schema) throw new ProtocolError('UNKNOWN_COMMAND', 'That command is not supported.');
  const payload = schema.parse(command.payload) as Record<string, unknown>;
  if (command.type === 'START_MATCH') return { type: 'START_MATCH', seed: seed() };
  return { type: command.type, ...payload } as EngineCommand;
}
