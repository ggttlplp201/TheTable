import { useEffect, useState } from 'react';
import type { AnyRoomView } from './protocol';
import { isSpectatorView } from './protocol';
import { readTutorialPreferences, saveTutorialPreferences } from './tutorial-storage';
const HINTS: Record<string, [string, string]> = {
  pocket: ['POCKET', 'Other players can see that it is occupied, but not what is inside.'],
  covered: ['COVERED THREAT', 'The hidden item may be a weapon or a bluff.'],
  downed: ['DOWNED — NOT DEAD', 'You can still talk and inspect the table. Medicine can revive you before the rescue window closes.'],
  market: ['BLACK MARKET', 'These offers are private. Only you can see them.'],
  wildcard: ['WILDCARD', 'Draw once per match. Use reveals the card; Burn keeps it secret.'],
};
export function hintCandidates(room: AnyRoomView, blackMarketOpen: boolean): string[] {
  if (isSpectatorView(room) || room.public.mode === 'tutorial') return [];
  const id = room.private.playerId;
  const player = room.public.players.find(player => player.id === id);
  return [room.public.pendingThreat?.targetId === id && room.public.pendingThreat.mode === 'COVERED' && 'covered', player?.life === 'DOWNED' && 'downed', blackMarketOpen && 'market', room.private.pockets.some(pocket => pocket.item) && 'pocket', room.public.wildcard?.unlocked && 'wildcard'].filter((id): id is string => typeof id === 'string');
}
export function MultiplayerHints({ room, blackMarketOpen }: { room: AnyRoomView; blackMarketOpen: boolean }) {
  const [prefs, setPrefs] = useState(readTutorialPreferences);
  const [active, setActive] = useState<string>();
  const candidates = hintCandidates(room, blackMarketOpen).join(',');
  useEffect(() => { const update = () => setPrefs(readTutorialPreferences()); window.addEventListener('tutorial-preferences', update); return () => window.removeEventListener('tutorial-preferences', update); }, []);
  useEffect(() => {
    if (prefs.tutorialHintsDisabled || active) return;
    const next = candidates.split(',').find(id => id && !prefs.seenHints.includes(id));
    if (next) { setActive(next); saveTutorialPreferences({ seenHints: [...prefs.seenHints, next] }); }
  }, [candidates, active, prefs]);
  useEffect(() => { if (!active) return; const timeout = window.setTimeout(() => setActive(undefined), 4000); return () => window.clearTimeout(timeout); }, [active]);
  if (!active || prefs.tutorialHintsDisabled) return null;
  return <aside className="multiplayer-hint" role="status"><strong>{HINTS[active]![0]}</strong>{HINTS[active]![1]}<button type="button" aria-label="Dismiss hint" onClick={() => setActive(undefined)}>×</button></aside>;
}
