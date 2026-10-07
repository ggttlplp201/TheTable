import type { PublicRoomView } from '@the-table/game';
import type { PresentationClipId, SeatVisual } from '@the-table/visual';

export const TABLE_SEATS = [
  { position: [0, 0, 2.18], rotationY: Math.PI, color: 0xb4955c },
  { position: [2.65, 0, 0], rotationY: -Math.PI / 2, color: 0x875d49 },
  { position: [0, 0, -2.18], rotationY: 0, color: 0x536f78 },
  { position: [-2.65, 0, 0], rotationY: Math.PI / 2, color: 0x7a7450 },
] as const;

export function publicSeats(room: PublicRoomView): SeatVisual[] {
  return room.players.flatMap(player => {
    const seat = TABLE_SEATS[player.seat];
    return seat && player.roleId ? [{ ...seat, id: player.id, role: player.roleId, label: player.name }] : [];
  });
}

export type TableCue =
  | { type: 'item'; itemId: PresentationClipId; playerId: string }
  | { type: 'impact' | 'exit' | 'death'; playerId: string }
  | { type: 'chest'; kind: 'STANDARD' | 'BLACK' }
  | { type: 'shop' }
  | { type: 'exchange'; playerId: string };

const ITEM_EVENTS: Readonly<Record<string, PresentationClipId>> = {
  HEALED: 'medicine', REVIVED: 'medicine', POISON_CURED: 'antidote',
  POISON_APPLIED: 'poison', ARMOR_BLOCKED: 'armor', HANDCUFFED: 'handcuffs',
};

const PUBLIC_ITEM_CLIPS: Readonly<Record<string, PresentationClipId>> = {
  knife: 'knife', pistol: 'pistol', bullet: 'bullet', poison: 'poison', medicine: 'medicine', antidote: 'antidote', armor: 'armor', cloth: 'cloth', bag: 'bag', safe: 'safe', spyglass: 'spyglass', pickpocket: 'pickpocket', key: 'key', lockpick: 'lockpick', crowbar: 'crowbar', 'black-key': 'blackKey', handcuffs: 'handcuffs', 'passage-token': 'passageToken',
};
const STRUCTURED_ITEM_EVENTS = new Set(['WEAPON_USED', 'CHEST_OPENED', 'PURCHASE', 'SOLD', 'THREAT_COMPLIED', 'THREAT_REFUSED']);

export function publicImpactTilt(life: PublicRoomView['players'][number]['life'], seconds: number): number {
  const base = life === 'DOWNED' ? 0.25 : 0;
  return base + Math.sin(Math.PI * Math.max(0, Math.min(0.6, seconds)) / 0.6) * 0.12;
}

export function matchPresentationKey(room: PublicRoomView): string {
  const start = room.events?.find(event => event.kind === 'MATCH_STARTED');
  return `${room.id}:${start ? `${start.id}:${start.at}` : 'unobserved'}`;
}

/** Reads only public kinds, actor/target IDs and chest availability. Never reads prose or private payloads. */
export class PublicPresentationObserver {
  private roomId: string | undefined;
  private key: string | undefined;
  private sequence = 0;
  private revision = -1;
  private chestStates = new Map<string, string>();
  observe(room: PublicRoomView, now = Date.now()): TableCue[] {
    const key = matchPresentationKey(room);
    const freshMatch = key !== this.key;
    if (room.id === this.roomId && room.revision <= this.revision) return [];
    const cues: TableCue[] = [];
    const publicIds = new Set(room.players.map(player => player.id));
    for (const event of room.events ?? []) {
      if (freshMatch || event.sequence <= this.sequence) continue;
      // A reconnect snapshot catches up immediately, without a backlog of historical acting.
      if (now - event.at > 5000 || event.at - now > 5000) continue;
      const actor = event.actorId && publicIds.has(event.actorId) ? event.actorId : undefined;
      const target = event.targetIds.find(id => publicIds.has(id));
      const itemId = ITEM_EVENTS[event.kind];
      if (itemId && (actor || target)) cues.push({ type: 'item', itemId, playerId: (event.kind === 'ARMOR_BLOCKED' ? target : actor) ?? actor ?? target! });
      const structuredItem = event.presentation?.itemId ? PUBLIC_ITEM_CLIPS[event.presentation.itemId] : undefined;
      if (structuredItem && actor && STRUCTURED_ITEM_EVENTS.has(event.kind)) cues.push({ type: 'item', itemId: structuredItem, playerId: actor });
      if ((event.kind === 'DAMAGE' || event.kind === 'POISON_DAMAGE') && target) cues.push({ type: 'impact', playerId: target });
      if (event.kind === 'EXIT' && actor) cues.push({ type: 'exit', playerId: actor });
      if (event.kind === 'DEATH' && target) cues.push({ type: 'death', playerId: target });
      if (event.kind === 'INTERMISSION') cues.push({ type: 'shop' });
      if (['PURCHASE', 'SOLD', 'TRADE_ACCEPTED', 'THREAT_COMPLIED'].includes(event.kind) && actor) cues.push({ type: 'exchange', playerId: actor });
      if (event.kind === 'CHEST_OPENED') {
        const structuredKind = event.presentation?.chestKind;
        if (structuredKind && room.chests?.some(chest => chest.kind === structuredKind && chest.availability === 'OPENED')) cues.push({ type: 'chest', kind: structuredKind });
        for (const chest of room.chests ?? []) {
          if (chest.availability === 'OPENED' && this.chestStates.get(chest.kind) === 'AVAILABLE' && !cues.some(cue => cue.type === 'chest' && cue.kind === chest.kind)) cues.push({ type: 'chest', kind: chest.kind });
        }
      }
    }
    this.key = key;
    this.roomId = room.id;
    this.revision = room.revision;
    this.sequence = Math.max(freshMatch ? 0 : this.sequence, ...(room.events ?? []).map(event => event.sequence));
    this.chestStates = new Map((room.chests ?? []).map(chest => [chest.kind, chest.availability]));
    return cues.slice(-6);
  }
}

export const ARRIVAL_SEEN_KEY = 'the-table:arrival-seen:v1';
const ARRIVAL_STARTED_KEY = 'the-table:arrival-started:v1';
export interface IntroStorage { getItem(key: string): string | null; setItem(key: string, value: string): void }
let seenInThisPage = false;
const startedInThisPage = new Set<string>();
export function hasSeenArrival(storage?: IntroStorage): boolean {
  try { return seenInThisPage || storage?.getItem(ARRIVAL_SEEN_KEY) === '1'; } catch { return seenInThisPage; }
}
export function rememberArrival(storage?: IntroStorage): void {
  seenInThisPage = true;
  try { storage?.setItem(ARRIVAL_SEEN_KEY, '1'); } catch { /* Storage-denied mode still remembers within this page. */ }
}
export function hasStartedArrival(room: PublicRoomView, storage?: IntroStorage): boolean {
  const key = matchPresentationKey(room);
  try { return startedInThisPage.has(key) || storage?.getItem(`${ARRIVAL_STARTED_KEY}:${room.id}`) === key; } catch { return startedInThisPage.has(key); }
}
export function rememberArrivalStart(room: PublicRoomView, storage?: IntroStorage): void {
  const key = matchPresentationKey(room);
  startedInThisPage.add(key);
  try { storage?.setItem(`${ARRIVAL_STARTED_KEY}:${room.id}`, key); } catch { /* The current page still prevents duplicate playback. */ }
}
export function arrivalEligible(room: PublicRoomView, viewerId: string | undefined, reducedMotion: boolean, started: boolean, now = Date.now()): boolean {
  const start = room.events?.find(event => event.kind === 'MATCH_STARTED');
  return Boolean(viewerId && room.status === 'PLAYING' && !reducedMotion && !started && start && now - start.at >= -5000 && now - start.at < 8000
    && room.players.some(player => player.id === viewerId && player.life === 'ACTIVE'));
}
