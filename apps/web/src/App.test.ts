import { describe, expect, it } from 'vitest';
import { preMatchMusic } from './App';

describe('application music routing', () => {
  it('uses The Table on the title and in the lobby without overriding match music', () => {
    expect(preMatchMusic('entry')).toBe('table');
    expect(preMatchMusic('lobby')).toBe('table');
    expect(preMatchMusic('connecting')).toBeUndefined();
    expect(preMatchMusic('playing')).toBeUndefined();
  });
});
