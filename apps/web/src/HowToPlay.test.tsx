import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { HowToPlay } from './HowToPlay';

describe('HowToPlay', () => {
  it('keeps the essential rules concise and leaves reference catalogs in the handbook', () => {
    const html = renderToStaticMarkup(<HowToPlay />);
    for (const chapter of ['Goal', 'Turns', 'Trade &amp; threats', 'Combat &amp; Downed', 'Shopping', 'Wildcards', 'Chests', 'Exit &amp; score', 'Chat &amp; spectators']) expect(html).toContain(chapter);
    expect(html).toContain('>60</strong><span>seconds per turn');
    expect(html).toContain('30 seconds');
    expect(html).toContain('10s prepare');
    expect(html).toContain('30s grace');
    expect(html).toContain('<dt>Timeout</dt><dd>Decline</dd>');
    expect(html).toContain('<dt>Timeout</dt><dd>Comply</dd>');
    expect(html).toContain('<strong>Free:</strong>');
    expect(html).toContain('Still Downed when the attacker returns: die.');
    expect(html).toContain('Concede');
    expect(html).toContain('New purchases wait until next Intermission.');
    expect(html).toContain('reusable Crowbar');
    expect(html).toContain('<td>100</td>');
    expect(html).toContain('get <strong>+2 Gold</strong>');
    expect(html).toContain('rules-wildcards');
    expect(html).toContain('once per match');
    expect(html).toContain('Handbook → Wildcards');
    expect(html).toContain('Handbook → Items');
    expect(html).not.toContain('Tycoon requires');
    expect(html).not.toContain('Temporary HP');
    expect(html).not.toContain('Search Warrant');

    const text = html.replace(/<[^>]+>/g, ' ').replace(/&[^;]+;/g, ' ').trim();
    expect(text.split(/\s+/).length).toBeLessThan(700);
  });
});
