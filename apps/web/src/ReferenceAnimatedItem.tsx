import { useEffect, useRef } from 'react';

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
