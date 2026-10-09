import { useEffect, useMemo, useState } from 'react';
import type { PublicRoomView } from '@the-table/game';
import { createDownedPresentation, presentedHealth, updateDownedPresentation } from './downed-presentation';

export function usePresentedHealth(room: PublicRoomView, sceneReady: boolean): PublicRoomView {
  const [motionAllowed, setMotionAllowed] = useState(() => typeof window !== 'undefined' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches && document.visibilityState !== 'hidden');
  const animate = motionAllowed && sceneReady;
  const [state, setState] = useState(() => createDownedPresentation(room, animate));
  let current = state;
  // Reconcile before committing the HUD, so a lethal snapshot cannot flash 0 HP before the shot.
  if (state.room !== room || state.animate !== animate) {
    current = updateDownedPresentation(state, room, Date.now(), animate);
    setState(current);
  }
  useEffect(() => {
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setMotionAllowed(!motion.matches && document.visibilityState !== 'hidden');
    update();
    motion.addEventListener('change', update); document.addEventListener('visibilitychange', update);
    return () => { motion.removeEventListener('change', update); document.removeEventListener('visibilitychange', update); };
  }, []);
  useEffect(() => {
    if (!current.pending.length) return;
    const until = Math.min(...current.pending.map(delay => delay.until));
    const timer = window.setTimeout(() => setState(previous => updateDownedPresentation(previous, previous.room, Date.now(), previous.animate)), Math.max(0, until - Date.now()));
    return () => window.clearTimeout(timer);
  }, [current.pending]);
  return useMemo(() => presentedHealth(room, current.pending), [room, current.pending]);
}
