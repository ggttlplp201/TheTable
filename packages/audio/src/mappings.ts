import { AUDIO_CUE_IDS, type AudioAudience, type AudioCueId, type AudioCueRequest, type ProjectedAudioEvent } from './types.js';

/** Every event currently emitted by packages/game. Add an entry here in the
 * same change that adds an engine event; audio never parses publicText. */
export const AUTHORITATIVE_EVENT_KINDS = [
  'MATCH_STARTED', 'MATCH_ENDED', 'TURN_STARTED', 'TURN_ENDED', 'INTERMISSION', 'SHOPPER_SKIPPED',
  'TRADE_OFFERED', 'TRADE_ACCEPTED', 'TRADE_DECLINED', 'TRADE_CANCELLED',
  'THREAT_OFFERED', 'THREAT_COMPLIED', 'THREAT_REFUSED', 'THREAT_CANCELLED',
  'WEAPON_USED', 'DAMAGE', 'POISON_DAMAGE', 'POISON_APPLIED', 'POISON_CURED', 'HEALED', 'ARMOR_BLOCKED', 'HANDCUFFED',
  'DOWNED', 'REVIVED', 'LOOTED', 'DEATH',
  'CHEST_REFRESHED', 'CHEST_OPENED', 'CHEST_INSPECTED',
  'PURCHASE', 'SOLD', 'POCKET_FILLED', 'MARKET_REROLLED', 'POCKET_INSPECTED', 'PICKPOCKET',
  'OBJECTIVE_READY', 'OBJECTIVE_LOCKED', 'DEATH_OBJECTIVE_BANKED', 'EXIT',
  'OVERFLOW', 'OVERFLOW_RESOLVED',
  'TRADE_EXPIRED_DECLINED', 'OBJECTIVE_FAILED', 'PLAYER_CONCEDED',
  'INTERMISSION_PREP_STARTED', 'PUBLIC_SHOP_TURN_STARTED', 'PUBLIC_SHOP_PASSED', 'BLACK_MARKET_UNLOCKED', 'INTERMISSION_PLAYER_FINISHED',
] as const;

export type AuthoritativeEventKind = typeof AUTHORITATIVE_EVENT_KINDS[number];

export interface EventCueCoverage {
  cue: AudioCueId;
  audience: AudioAudience;
  /** Why the cue is appropriate without inspecting private state. */
  detail: string;
}

/** Public cues branch solely on the public event kind. This prevents a sound
 * from becoming an oracle for hidden committed items, Pocket contents, or offers. */
export const EVENT_COVERAGE: Readonly<Record<AuthoritativeEventKind, EventCueCoverage>> = {
  MATCH_STARTED: { cue: 'event.match-started', audience: 'PUBLIC', detail: 'match begins' },
  MATCH_ENDED: { cue: 'event.match-ended', audience: 'PUBLIC', detail: 'results' },
  TURN_STARTED: { cue: 'event.turn-started', audience: 'PUBLIC', detail: 'turn opportunity' },
  TURN_ENDED: { cue: 'event.turn-ended', audience: 'PUBLIC', detail: 'turn closes' },
  INTERMISSION: { cue: 'event.intermission', audience: 'PUBLIC', detail: 'market interval' },
  SHOPPER_SKIPPED: { cue: 'event.shopper-skipped', audience: 'PUBLIC', detail: 'shopping opportunity skipped' },
  TRADE_OFFERED: { cue: 'event.trade-offered', audience: 'PUBLIC', detail: 'proposal' },
  TRADE_ACCEPTED: { cue: 'event.trade-accepted', audience: 'PUBLIC', detail: 'atomic transfer completed' },
  TRADE_DECLINED: { cue: 'event.trade-declined', audience: 'PUBLIC', detail: 'proposal declined' },
  TRADE_CANCELLED: { cue: 'event.trade-cancelled', audience: 'PUBLIC', detail: 'proposal cancelled' },
  THREAT_OFFERED: { cue: 'event.threat-offered', audience: 'PUBLIC', detail: 'open or covered threat; no item inference' },
  THREAT_COMPLIED: { cue: 'event.threat-complied', audience: 'PUBLIC', detail: 'demand transferred' },
  THREAT_REFUSED: { cue: 'event.threat-refused', audience: 'PUBLIC', detail: 'refusal; no pre-resolution weapon inference' },
  THREAT_CANCELLED: { cue: 'event.threat-cancelled', audience: 'PUBLIC', detail: 'threat cancelled' },
  WEAPON_USED: { cue: 'event.weapon-used', audience: 'PUBLIC', detail: 'generic: no structured weapon id exists' },
  DAMAGE: { cue: 'event.damage', audience: 'PUBLIC', detail: 'direct damage' },
  POISON_DAMAGE: { cue: 'event.poison-tick', audience: 'PUBLIC', detail: 'status tick' },
  POISON_APPLIED: { cue: 'item.poison', audience: 'PUBLIC', detail: 'poison status' },
  POISON_CURED: { cue: 'event.poison-cured', audience: 'PUBLIC', detail: 'status removed' },
  HEALED: { cue: 'event.healed', audience: 'PUBLIC', detail: 'healing' },
  ARMOR_BLOCKED: { cue: 'event.armor-blocked', audience: 'PUBLIC', detail: 'blocked hit' },
  HANDCUFFED: { cue: 'event.handcuffed', audience: 'PUBLIC', detail: 'status applied' },
  DOWNED: { cue: 'event.downed', audience: 'PUBLIC', detail: 'rescue window opens' },
  REVIVED: { cue: 'event.revived', audience: 'PUBLIC', detail: 'revived' },
  LOOTED: { cue: 'event.looted', audience: 'PUBLIC', detail: 'visible downed loot' },
  DEATH: { cue: 'event.death', audience: 'PUBLIC', detail: 'permanent death' },
  CHEST_REFRESHED: { cue: 'event.chest-refreshed', audience: 'PUBLIC', detail: 'chest becomes available' },
  CHEST_OPENED: { cue: 'event.chest-opened', audience: 'PUBLIC', detail: 'opens without describing loot' },
  CHEST_INSPECTED: { cue: 'event.chest-inspected', audience: 'PUBLIC', detail: 'generic public inspection' },
  PURCHASE: { cue: 'event.purchased', audience: 'PUBLIC', detail: 'purchase confirmation' },
  SOLD: { cue: 'event.sold', audience: 'PUBLIC', detail: 'sale confirmation' },
  POCKET_FILLED: { cue: 'event.pocket-filled', audience: 'PUBLIC', detail: 'occupancy changed; never item identity' },
  MARKET_REROLLED: { cue: 'event.market-rerolled', audience: 'PUBLIC', detail: 'private-market refresh without offer identity' },
  POCKET_INSPECTED: { cue: 'event.pocket-inspected', audience: 'PUBLIC', detail: 'generic inspection without contents' },
  PICKPOCKET: { cue: 'event.pickpocketed', audience: 'PUBLIC', detail: 'generic: no structured success result exists' },
  OBJECTIVE_READY: { cue: 'event.objective-ready', audience: 'PUBLIC', detail: 'generic readiness' },
  OBJECTIVE_LOCKED: { cue: 'event.objective-locked', audience: 'PUBLIC', detail: 'readiness withdrawn' },
  DEATH_OBJECTIVE_BANKED: { cue: 'event.objective-banked', audience: 'PUBLIC', detail: 'qualifying objective resolution' },
  EXIT: { cue: 'event.exit', audience: 'PUBLIC', detail: 'successful exit' },
  OVERFLOW: { cue: 'event.overflow', audience: 'PUBLIC', detail: 'inventory choice required' },
  OVERFLOW_RESOLVED: { cue: 'event.overflow-resolved', audience: 'PUBLIC', detail: 'inventory choice resolved' },
  TRADE_EXPIRED_DECLINED: { cue: 'event.trade-declined', audience: 'PUBLIC', detail: 'expired proposal declined without transfer' },
  OBJECTIVE_FAILED: { cue: 'event.objective-locked', audience: 'PUBLIC', detail: 'generic failed contract, without its identity or reason' },
  PLAYER_CONCEDED: { cue: 'event.exit', audience: 'PUBLIC', detail: 'concession, not a kill or scoring exit' },
  INTERMISSION_PREP_STARTED: { cue: 'event.intermission', audience: 'PUBLIC', detail: 'preparation begins' },
  PUBLIC_SHOP_TURN_STARTED: { cue: 'event.turn-started', audience: 'PUBLIC', detail: 'next public decision begins' },
  PUBLIC_SHOP_PASSED: { cue: 'event.shopper-skipped', audience: 'PUBLIC', detail: 'public purchase passed' },
  BLACK_MARKET_UNLOCKED: { cue: 'event.market-rerolled', audience: 'PUBLIC', detail: 'private market available without offer identities' },
  INTERMISSION_PLAYER_FINISHED: { cue: 'event.turn-ended', audience: 'PUBLIC', detail: 'player finished Intermission' },
};

export const EVENT_CUES: Readonly<Record<AuthoritativeEventKind, AudioCueId>> = Object.fromEntries(
  AUTHORITATIVE_EVENT_KINDS.map((kind) => [kind, EVENT_COVERAGE[kind].cue]),
) as Readonly<Record<AuthoritativeEventKind, AudioCueId>>;

/** All canonical item IDs receive a local, replaceable interaction cue. */
export const ITEM_CUES: Readonly<Record<string, AudioCueId>> = {
  knife: 'item.knife', pistol: 'item.pistol', bullet: 'item.bullet', poison: 'item.poison', medicine: 'item.medicine', antidote: 'item.antidote', armor: 'item.armor', cloth: 'item.cloth', bag: 'item.bag', safe: 'item.safe', spyglass: 'item.spyglass', pickpocket: 'item.pickpocket', key: 'item.key', lockpick: 'item.lockpick', crowbar: 'item.crowbar', 'black-key': 'item.black-key', handcuffs: 'item.handcuffs', 'brass-idol': 'item.brass-idol', 'glass-eye': 'item.glass-eye', 'red-ledger': 'item.red-ledger', 'passage-token': 'item.passage-token', chest: 'item.chest',
};

/** Material of each item when it is handled, bought, sold, pocketed or handed over. */
export const ITEM_HANDLE_CUES: Readonly<Record<string, AudioCueId>> = {
  knife: 'handle.metal', pistol: 'handle.metal', bullet: 'handle.metal', armor: 'handle.metal', safe: 'handle.metal', spyglass: 'handle.metal', pickpocket: 'handle.metal', key: 'handle.metal', lockpick: 'handle.metal', crowbar: 'handle.metal', 'black-key': 'handle.metal', handcuffs: 'handle.metal', 'brass-idol': 'handle.metal',
  poison: 'handle.glass', medicine: 'handle.glass', antidote: 'handle.glass', 'glass-eye': 'handle.glass',
  cloth: 'handle.cloth', bag: 'handle.cloth', 'red-ledger': 'handle.paper', 'passage-token': 'handle.coin', chest: 'handle.wood',
};

/** Seconds from the event to the moment the scene shows contact. Damage-type cues that
 * arrive with a weapon wait for this so the hit is heard when the blade or bullet lands. */
export const WEAPON_HIT_AT: Readonly<Record<string, number>> = { knife: 0.93, pistol: 1.5 };

/** Only an already-authorized owner payload may cause these detail cues. Audio
 * never reads the payload, so it cannot encode a hidden result in the sound. */
export const PRIVATE_EVENT_CUES: Readonly<Partial<Record<AuthoritativeEventKind, AudioCueId>>> = {
  POCKET_INSPECTED: 'private.inspection',
  CHEST_INSPECTED: 'private.chest-inspection',
};

export const AUDIO_MAP = Object.freeze({ event: EVENT_CUES, item: ITEM_CUES, handle: ITEM_HANDLE_CUES, ids: AUDIO_CUE_IDS });

export function routeEvent(event: ProjectedAudioEvent, selfId?: string): AudioCueRequest[] {
  // The active player gets the brass bell; everyone else hears the soft turn knock.
  const ownTurn = event.kind === 'TURN_STARTED' && selfId !== undefined && event.actorId === selfId;
  const cue = ownTurn ? 'turn.start' : EVENT_CUES[event.kind as AuthoritativeEventKind];
  const result: AudioCueRequest[] = cue === undefined ? [] : [{ cue, audience: 'PUBLIC', ...(event.id === undefined ? {} : { eventId: event.id }) }];
  const publicItemCue = event.presentation?.itemId === undefined ? undefined : ITEM_CUES[event.presentation.itemId];
  // Use sounds only for actual uses. A transfer is heard as the item's material changing hands.
  if (publicItemCue !== undefined && publicItemCue !== cue && ['WEAPON_USED', 'CHEST_OPENED'].includes(event.kind)) {
    result.push({ cue: publicItemCue, audience: 'PUBLIC', ...(event.id === undefined ? {} : { eventId: event.id }) });
  }
  const handlingCue = event.presentation?.itemId === undefined ? undefined : ITEM_HANDLE_CUES[event.presentation.itemId];
  if (handlingCue !== undefined && ['PURCHASE', 'SOLD', 'THREAT_COMPLIED'].includes(event.kind)) {
    result.push({ cue: handlingCue, audience: 'PUBLIC', ...(event.id === undefined ? {} : { eventId: event.id }) });
  }
  const payload = selfId === undefined ? undefined : event.privatePayloads?.[selfId];
  const privateCue = PRIVATE_EVENT_CUES[event.kind as AuthoritativeEventKind];
  if (payload !== undefined && privateCue !== undefined) result.push({ cue: privateCue, audience: 'PRIVATE', ...(event.id === undefined ? {} : { eventId: event.id }) });
  return result;
}

export function itemCue(itemId: string): AudioCueId | undefined { return ITEM_CUES[itemId]; }
export function handleCue(itemId: string): AudioCueId | undefined { return ITEM_HANDLE_CUES[itemId]; }
