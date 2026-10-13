import type { PublicRoomView } from '@the-table/game';
import type { PresentationClipId, SeatVisual } from '@the-table/visual';
import type { PublicActionKind } from './table-action-presentation';
import { publicWildcardSceneCue, type PublicWildcardSceneCue } from './wildcard-scene';

export const TABLE_SEATS = [
  { position: [0, 0, 2.18], rotationY: Math.PI, color: 0xe0a040 },
  { position: [-2.55, 0, 0], rotationY: Math.PI / 2, color: 0x6a8ab8 },
  { position: [0, 0, -2.08], rotationY: 0, color: 0x7aa08a },
  { position: [2.55, 0, 0], rotationY: -Math.PI / 2, color: 0xb84030 },
] as const;

/** Rotate presentation only: each authorized viewer owns the near row. */
export function publicSeats(room: PublicRoomView, viewerId?: string): SeatVisual[] {
  const players = [...room.players].sort((a, b) => a.seat - b.seat);
  const viewerIndex = Math.max(0, players.findIndex(player => player.id === viewerId));
  const layout = players.length === 2 ? [0, 2] : players.length === 3 ? [0, 1, 3] : [0, 1, 2, 3];
  return players.flatMap((player, index) => {
    const relative = (index - viewerIndex + players.length) % players.length;
    const seat = TABLE_SEATS[layout[relative]!];
    return seat && player.roleId ? [{ ...seat, id: player.id, role: room.mode === 'tutorial' && player.id === 'dealer' ? 'dealer' : player.roleId, label: player.name }] : [];
  });
}

export type TableCue =
  | { type: 'action'; itemId: PublicActionKind; playerId: string; targetId: string; sourceSlot?: number; sourceInstanceId?: string }
  /** A chest tool travels from its owner's slot into the real keyhole; the lid waits for it. */
  | { type: 'chest-tool'; itemId: ChestToolClip; kind: 'STANDARD' | 'BLACK'; playerId: string; sourceSlot?: number }
  | { type: 'impact' | 'exit' | 'death'; playerId: string }
  | { type: 'chest-loot'; kind: 'STANDARD' | 'BLACK'; playerId: string; instanceIds: string[]; delay?: number }
  | { type: 'chest'; kind: 'STANDARD' | 'BLACK'; delay?: number }
  | { type: 'shop' }
  | { type: 'exchange'; playerId: string }
  | PublicWildcardSceneCue;

const ITEM_EVENTS: Readonly<Record<string, PublicActionKind>> = {
  HEALED: 'medicine', REVIVED: 'medicine', STIMULANT_USED: 'stimulant', POISON_CURED: 'antidote',
  POISON_APPLIED: 'poison', ARMOR_BLOCKED: 'armor', HANDCUFFED: 'handcuffs',
};

export type ChestToolClip = Extract<PresentationClipId, 'key' | 'lockpick' | 'crowbar' | 'blackKey'>;
const CHEST_TOOLS: Readonly<Record<string, ChestToolClip>> = { key: 'key', lockpick: 'lockpick', crowbar: 'crowbar', 'black-key': 'blackKey' };
/** Seconds into each tool clip at which the lock gives. The lid and the loot wait for this beat. */
export const CHEST_TOOL_OPEN_AT: Readonly<Record<ChestToolClip, number>> = { key: .6, lockpick: .65, crowbar: .55, blackKey: .6 };
/* Buying, selling and complying are transfers, not uses: they get the brass exchange ring only.
   Playing an item's use clip for them (a knife stabbing the air on purchase) is never correct. */

export function publicImpactTilt(life: PublicRoomView['players'][number]['life'], seconds: number): number {
  const base = life === 'DOWNED' ? 0.25 : 0;
  return base + Math.sin(Math.PI * Math.max(0, Math.min(0.6, seconds)) / 0.6) * 0.12;
}

/** The projection deliberately omits covered identity. Never recover it from inventory. */
export function publicThreatPose(room: PublicRoomView, playerId: string): 'cloth' | 'pistol' | 'knife' | null {
  const threat = room.pendingThreat;
  if (!threat || threat.actorId !== playerId || room.players.find(player => player.id === playerId)?.life !== 'ACTIVE') return null;
  if (threat.mode === 'COVERED') return 'cloth';
  return threat.committedItemType === 'pistol' || threat.committedItemType === 'knife' ? threat.committedItemType : null;
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
  private visibleInstances = new Map<string, Set<string>>();
  private visibleSlots = new Map<string, Array<{ itemId: string; instanceId: string } | null>>();
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
      const wildcardCue = publicWildcardSceneCue(event);
      if (wildcardCue) cues.push(wildcardCue);
      const itemId = ITEM_EVENTS[event.kind];
      const action = (kind: PublicActionKind, playerId: string, targetId: string) => {
        const slots = this.visibleSlots.get(playerId), slot = slots?.findIndex(item => item?.itemId === kind) ?? -1;
        const source = slots?.[slot];
        cues.push({ type: 'action', itemId: kind, playerId, targetId, ...(source ? { sourceSlot: slot, sourceInstanceId: source.instanceId } : {}) });
      };
      if (itemId && (actor || target)) {
        const playerId = (event.kind === 'ARMOR_BLOCKED' ? target : actor) ?? actor ?? target!;
        action(itemId, playerId, target ?? playerId);
      }
      const structuredItem = event.presentation?.itemId;
      if (event.kind === 'WEAPON_USED' && actor && target && (structuredItem === 'knife' || structuredItem === 'pistol')) action(structuredItem, actor, target);
      const tool = event.kind === 'CHEST_OPENED' && structuredItem ? CHEST_TOOLS[structuredItem] : undefined;
      const toolChest = event.presentation?.chestKind;
      if (tool && actor && toolChest) {
        const slot = this.visibleSlots.get(actor)?.findIndex(item => item?.itemId === structuredItem) ?? -1;
        cues.push({ type: 'chest-tool', itemId: tool, kind: toolChest, playerId: actor, ...(slot >= 0 ? { sourceSlot: slot } : {}) });
      }
      const openDelay = tool ? CHEST_TOOL_OPEN_AT[tool] : 0;
      // The weapon timeline already drives the target's flinch on contact. A second
      // generic damage cue would make them react before the blade or bullet arrives.
      const weaponImpact = event.kind === 'DAMAGE' && cues.some(cue => cue.type === 'action' && cue.targetId === target && (cue.itemId === 'knife' || cue.itemId === 'pistol'));
      if ((event.kind === 'DAMAGE' || event.kind === 'POISON_DAMAGE') && target && !weaponImpact) cues.push({ type: 'impact', playerId: target });
      if (event.kind === 'EXIT' && actor) cues.push({ type: 'exit', playerId: actor });
      if (event.kind === 'DEATH' && target) cues.push({ type: 'death', playerId: target });
      if (event.kind === 'INTERMISSION') cues.push({ type: 'shop' });
      if (['PURCHASE', 'SOLD', 'TRADE_ACCEPTED', 'THREAT_COMPLIED'].includes(event.kind) && actor) cues.push({ type: 'exchange', playerId: actor });
      if (event.kind === 'CHEST_OPENED') {
        const structuredKind = event.presentation?.chestKind;
        if (structuredKind && room.chests?.some(chest => chest.kind === structuredKind && chest.availability === 'OPENED')) cues.push({ type: 'chest', kind: structuredKind, ...(openDelay ? { delay: openDelay } : {}) });
        if (structuredKind && actor && room.chests?.some(chest => chest.kind === structuredKind && chest.availability === 'OPENED')) {
          const before = this.visibleInstances.get(actor);
          const instanceIds = room.players.find(player => player.id === actor)!.visibleInventory.flatMap(item => item && before && !before.has(item.instanceId) ? [item.instanceId] : []);
          if (instanceIds.length) cues.push({ type: 'chest-loot', kind: structuredKind, playerId: actor, instanceIds, ...(openDelay ? { delay: openDelay } : {}) });
        }
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
    this.visibleInstances = new Map(room.players.map(player => [player.id, new Set(player.visibleInventory.flatMap(item => item ? [item.instanceId] : []))]));
    this.visibleSlots = new Map(room.players.map(player => [player.id, player.visibleInventory.map(item => item ? { itemId: item.itemId, instanceId: item.instanceId } : null)]));
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
  return Boolean(room.mode !== 'tutorial' && viewerId && room.status === 'PLAYING' && !reducedMotion && !started && start && now - start.at >= -5000 && now - start.at < 8000
    && room.players.some(player => player.id === viewerId && player.life === 'ACTIVE'));
}
