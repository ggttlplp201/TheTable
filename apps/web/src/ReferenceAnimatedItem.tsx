import { useEffect, useRef, useState } from 'react';
import type { HandbookModelOptions } from './handbook-item-renderer';

export function HandbookModel({ kind, modelId, name, description = '', tint = 0x8a6a3a, thumbnail = false }: HandbookModelOptions) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let disposed = false;
    let detach: (() => void) | undefined;
    setFailed(false);
    void import('./handbook-item-renderer').then(({ attachHandbookModel }) => {
      if (!disposed && canvas.current) detach = attachHandbookModel(canvas.current, { kind, modelId, name, description, tint, thumbnail });
    }).catch(() => { if (!disposed) setFailed(true); });
    return () => { disposed = true; detach?.(); };
  }, [kind, modelId, name, description, tint, thumbnail]);
  return <div className={thumbnail ? 'handbook-character-thumbnail' : 'handbook-viewer'} data-model-kind={kind}>
    <canvas ref={canvas} role="img" aria-label={`${name} ${thumbnail ? 'portrait' : '3D model. Drag or use arrow keys to rotate.'}`} tabIndex={thumbnail ? -1 : 0} width={thumbnail ? 44 : 235} height={thumbnail ? 44 : 330} />
    {failed && <span className="handbook-model-fallback">{name}{!thumbnail && ' · Model unavailable'}</span>}
  </div>;
}

export function ReferenceAnimatedItem({ itemId, size = 48 }: { itemId: string; size?: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let disposed = false;
    let detach: (() => void) | undefined;
    void import('./handbook-item-renderer').then(({ attachHandbookItem }) => {
      if (!disposed && canvas.current) detach = attachHandbookItem(canvas.current, itemId);
    });
    return () => { disposed = true; detach?.(); };
  }, [itemId]);
  return <span className="reference-animated-item" style={{ width: size, height: size }} aria-label={`${itemId.replace(/-/g, ' ')} rotating item model`}>
    <canvas ref={canvas} width={size} height={size} aria-hidden="true" />
  </span>;
}
