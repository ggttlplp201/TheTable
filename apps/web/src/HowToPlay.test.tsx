import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { HowToPlay } from './HowToPlay';

describe('HowToPlay', () => {
  it('organizes the complete player guide separately from the item catalog', () => {
    const html = renderToStaticMarkup(<HowToPlay />);
    for (const chapter of ['Goal &amp; objective', 'Turns &amp; rounds', 'Trade &amp; threats', 'Inventory &amp; combat', 'Intermission', 'Chests &amp; items', 'Leaving the table', 'Communication']) expect(html).toContain(chapter);
    expect(html).toContain('>60</strong><span>seconds on your turn');
    expect(html).toContain('30 seconds');
    expect(html).toContain('10s preparation');
    expect(html).toContain('30s final grace');
    expect(html).toContain('Trade timeout = Decline. Threat timeout = Comply.');
    expect(html).toContain('Free Action · once per complete Round');
    expect(html).toContain('immediately before the original attacker receives their next normal turn');
    expect(html).toContain('Concede');
    expect(html).toContain('cannot be sold until the next Intermission');
    expect(html).toContain('reusable Crowbar');
    expect(html).toContain('revives another player to 3 HP');
    expect(html).toContain('<td>100</td>');
    expect(html).not.toContain('search items');
    expect(html).toContain('Round Income pays +2 Gold');
    expect(html).toContain('rules-wildcards');
    expect(html).toContain('once per match');
    expect(html).toContain('Tycoon requires at least 15 Gold and one successful Trade');
    expect(html).toContain('Temporary HP');
    for (const card of ['Seize', 'Destroy', 'Supply Drop', 'Shatter', 'Forced Exchange', 'Search Warrant', 'Windfall', 'Redistribution', 'Scramble', 'Second Chance']) expect(html.toLowerCase()).toContain(card.toLowerCase());
  });
});
