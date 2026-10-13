import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { HudClock } from './MatchView';

describe('UI-kit turn clock', () => {
  it('escalates only the active viewer and clamps the bar to the authoritative duration', () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(100_000);
    try {
      const clock = (seconds: number, mine = true) => renderToStaticMarkup(<HudClock deadline={100_000 + seconds * 1000} mine={mine} />);
      expect(clock(41)).toContain('data-clock="calm"');
      expect(clock(10)).toContain('data-clock="warn"');
      expect(clock(5)).toContain('data-clock="critical"');
      expect(clock(0)).toContain('--left:0');
      expect(clock(-20)).toContain('0:00');
      expect(clock(60)).toContain('1:00');
      expect(clock(120)).toContain('--left:1');
      expect(clock(4, false)).toContain('data-clock="other"');
      expect(clock(4, false)).not.toContain('core-clock-bar');
    } finally { now.mockRestore(); }
  });
  it('keeps a paused turn frozen even after its previous deadline passes', () => {
    const markup = renderToStaticMarkup(<HudClock deadline={0} mine pausedRemainingMs={27_000} />);
    expect(markup).toContain('data-paused="true"');
    expect(markup).toContain('27 seconds (paused)');
    expect(markup).toContain('--left:0.45');
  });
});
