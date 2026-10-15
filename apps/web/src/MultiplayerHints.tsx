import { useEffect, useState } from 'react';
import type { AnyRoomView } from './protocol';
import { isSpectatorView } from './protocol';
import { readTutorialPreferences, saveTutorialPreferences } from './tutorial-storage';
const HINTS: Record<string, [string, string]> = {
  pocket: ['POCKET', 'Occupied is public. Contents are private.'],
  covered: ['COVERED THREAT', 'The hidden item may be real or a bluff.'],
  downed: ['DOWNED — NOT DEAD', 'You can still communicate. You die before the attacker’s next normal turn.'],
  market: ['BLACK MARKET', 'Only you can see these offers.'],
  wildcard: ['WILDCARD', 'Once per match. Draw → Use or Burn.'],
};
export function hintCandidates(room: AnyRoomView, blackMarketOpen: boolean): string[] {
  if (isSpectatorView(room) || room.public.mode === 'tutorial') return [];
  const id = room.private.playerId;
  const player = room.public.players.find(player => player.id === id);
  return [room.public.pendingThreat?.targetId === id && room.public.pendingThreat.mode === 'COVERED' && 'covered', player?.life === 'DOWNED' && 'downed', blackMarketOpen && 'market', room.private.pockets.some(pocket => pocket.item) && 'pocket', room.public.wildcard?.unlocked && 'wildcard'].filter((id): id is string => typeof id === 'string');
}
export function latestHintAction(room: AnyRoomView): string | undefined {
  if (isSpectatorView(room)) return;
  return [...room.public.events ?? []].reverse().find(event => event.actorId === room.private.playerId && event.publicText && !['PLAYER_CONNECTED', 'PLAYER_DISCONNECTED'].includes(event.kind))?.id;
}
export function MultiplayerHints({ room, blackMarketOpen }: { room: AnyRoomView; blackMarketOpen: boolean }) {
  const [prefs, setPrefs] = useState(readTutorialPreferences);
  const [active, setActive] = useState<{ id: string; action: string | undefined }>();
  const action = latestHintAction(room);
  const candidates = hintCandidates(room, blackMarketOpen).join(',');
  useEffect(() => { const update = () => setPrefs(readTutorialPreferences()); window.addEventListener('tutorial-preferences', update); return () => window.removeEventListener('tutorial-preferences', update); }, []);
  useEffect(() => {
    if (prefs.tutorialHintsDisabled || active) return;
    const next = candidates.split(',').find(id => id && !prefs.seenHints.includes(id));
    if (next) { setActive({ id: next, action }); saveTutorialPreferences({ seenHints: [...prefs.seenHints, next] }); }
  }, [candidates, active, prefs, action]);
  useEffect(() => { if (active && active.action !== action) setActive(undefined); }, [active, action]);
  useEffect(() => { if (!active) return; const timeout = window.setTimeout(() => setActive(undefined), 4000); return () => window.clearTimeout(timeout); }, [active]);
  if (!active || prefs.tutorialHintsDisabled) return null;
  return <aside className="multiplayer-hint" role="status"><strong>{HINTS[active.id]![0]}</strong>{HINTS[active.id]![1]}<button type="button" aria-label="Dismiss hint" onClick={() => setActive(undefined)}>×</button></aside>;
}
