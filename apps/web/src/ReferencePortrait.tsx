import { useEffect, useRef, useState } from 'react';
import { HandbookModel } from './ReferenceAnimatedItem';

/** All nine mugshots use the same standing models as the selected Handbook figure. */
export function HandbookCharacterThumbnail({ roleId, tint }: { roleId: string; tint: number }) {
  return <HandbookModel kind="chars" modelId={roleId} name={roleId === 'dealer' ? 'The Dealer' : roleId} tint={tint} thumbnail />;
}

export function AnimatedReferencePortrait({ roleId, className = '', fallback }: { roleId: string; className?: string; fallback: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    let detach: (() => void) | undefined;
    void import('./reference-portrait-runtime.js').then(({ animateReferencePortrait }) => {
      if (!cancelled && canvas.current) detach = animateReferencePortrait(canvas.current, roleId);
    }).catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; detach?.(); };
  }, [roleId]);
  const classes = `reference-portrait ${className}`;
  return failed
    ? <img className={classes} src={fallback} alt={`${roleId} portrait`} style={{ imageRendering: 'pixelated' }} />
    : <canvas ref={canvas} className={classes} width={120} height={170} role="img" aria-label={`${roleId} portrait`} style={{ imageRendering: 'pixelated' }} />;
}
