import type { PublicRoomView } from '@the-table/game';

/** Statistics use structured public facts, never private markets or parsed event prose. */
export function matchResultSummary(room: PublicRoomView) {
  const events = [...(room.events ?? [])].sort((a, b) => a.sequence - b.sequence);
  const start = events.find(event => event.kind === 'MATCH_STARTED');
  const end = [...events].reverse().find(event => event.kind === 'MATCH_ENDED');
  const seconds = start && end ? Math.max(0, Math.floor((end.at - start.at) / 1000)) : undefined;
  const duration = seconds === undefined ? undefined : `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  const threats = new Map<string, number>(), chests = new Map<string, number>(), survived = new Map<string, number>();
  const incapacitated = new Set<string>();
  const add = (map: Map<string, number>, id: string | undefined, amount = 1) => { if (id) map.set(id, (map.get(id) ?? 0) + amount); };
  for (const event of events) {
    if (event.kind === 'THREAT_OFFERED') add(threats, event.actorId);
    if (event.kind === 'CHEST_OPENED') add(chests, event.actorId);
    if (event.kind === 'DOWNED' || event.kind === 'DEATH') for (const id of event.targetIds) incapacitated.add(id);
    if (event.kind === 'REVIVED') for (const id of event.targetIds) incapacitated.delete(id);
    if (event.kind === 'THREAT_REFUSED') for (const id of event.targetIds) if (!incapacitated.has(id)) add(survived, id);
  }
  const leader = (counts: Map<string, number>, suffix = '') => {
    const winner = [...room.players].sort((a, b) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0) || a.seat - b.seat)[0];
    const count = winner ? counts.get(winner.id) ?? 0 : 0;
    return winner && count > 0 ? `${winner.name.toUpperCase()} · ${count}${suffix}` : '—';
  };
  // Public PURCHASE events deliberately omit private-market prices and discounts.
  // Do not fabricate a total from base prices or reveal additional private metadata.
  return { duration, mostThreats: leader(threats), coinsSpent: '—', chestsOpened: leader(chests), refusedAndLived: leader(survived) };
}
