import { useEffect, useRef } from 'react';
import type { AudioEngine } from '@the-table/audio';

/**
 * React StrictMode immediately replays effects in development. Defer terminal
 * disposal by one task so the replacement setup can retain the same engine,
 * while a real unmount still closes its context and disconnects every node.
 */
export function useOwnedAudioEngineLifecycle(engine: AudioEngine, owned = true): void {
  const pendingDispose = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (!owned) return undefined;
    if (pendingDispose.current !== undefined) {
      clearTimeout(pendingDispose.current);
      pendingDispose.current = undefined;
    }
    return () => {
      pendingDispose.current = setTimeout(() => {
        pendingDispose.current = undefined;
        void engine.dispose();
      }, 0);
    };
  }, [engine, owned]);
}
