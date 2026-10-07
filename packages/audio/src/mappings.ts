import { AUDIO_CUE_IDS, type AudioCueId, type AudioCueRequest, type ProjectedAudioEvent } from './types.js';

export const EVENT_CUES: Readonly<Record<string, AudioCueId | undefined>> = {
  MATCH_STARTED: 'intro.sting',
  MATCH_ENDED: 'event.results',
  TURN_STARTED: 'turn.start',
  TURN_WARNING: 'turn.warning',
  RESPONSE_WARNING: 'turn.response-warning',
  TRADE_OFFERED: 'event.trade',
  TRADE_ACCEPTED: 'event.trade',
  TRADE_DECLINED: 'ui.reject',
  TRADE_CANCELLED: 'ui.reject',
  THREAT_OFFERED: 'event.threat',
  THREAT_COMPLIED: 'event.threat',
  THREAT_REFUSED: 'ui.reject',
  THREAT_CANCELLED: 'ui.reject',
  WEAPON_USED: 'item.pistol',
  POISON_APPLIED: 'item.poison',
  DAMAGE: 'item.pistol',
  POISON_DAMAGE: 'item.poison',
  HEALED: 'item.medicine',
  POISON_CURED: 'item.antidote',
  ARMOR_BLOCKED: 'item.armor',
  DOWNED: 'event.downed',
  REVIVED: 'item.medicine',
  DEATH: 'event.death',
  EXIT: 'event.exit',
  CHEST_OPENED: 'item.chest',
  CHEST_REFRESHED: 'item.chest',
  PURCHASE: 'ui.confirm',
  SOLD: 'ui.set-down',
  POCKET_FILLED: 'ui.set-down',
  MARKET_REROLLED: 'ui.select',
  DOOR_OPENED: 'world.door',
  FOOTSTEP: 'world.footstep',
};

export const ITEM_CUES: Readonly<Record<string, AudioCueId>> = {
  knife: 'item.knife',
  pistol: 'item.pistol',
  poison: 'item.poison',
  medicine: 'item.medicine',
  antidote: 'item.antidote',
  armor: 'item.armor',
  bag: 'item.bag',
  chest: 'item.chest',
};

export const AUDIO_MAP = Object.freeze({ event: EVENT_CUES, item: ITEM_CUES, ids: AUDIO_CUE_IDS });

export function routeEvent(event: ProjectedAudioEvent, selfId?: string): AudioCueRequest[] {
  const cue = EVENT_CUES[event.kind];
  const result: AudioCueRequest[] = cue === undefined
    ? []
    : [{ cue, audience: 'PUBLIC', ...(event.id === undefined ? {} : { eventId: event.id }) }];
  const payload = selfId === undefined ? undefined : event.privatePayloads?.[selfId];

  if (payload !== undefined) {
    const privateCue = typeof payload === 'object' && payload !== null && 'itemId' in payload
      ? ITEM_CUES[String((payload as { itemId: unknown }).itemId)]
      : event.kind === 'POCKET_INSPECTED' ? 'ui.confirm' : cue;
    if (privateCue !== undefined) {
      result.push({ cue: privateCue, audience: 'PRIVATE', ...(event.id === undefined ? {} : { eventId: event.id }) });
    }
  }
  return result;
}

export function itemCue(itemId: string): AudioCueId | undefined {
  return ITEM_CUES[itemId];
}
