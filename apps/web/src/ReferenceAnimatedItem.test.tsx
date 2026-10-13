import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ReferenceAnimatedItem } from './ReferenceAnimatedItem';

describe('ReferenceAnimatedItem', () => {
  it('renders only the animated canvas layer', () => {
    const html = renderToStaticMarkup(<ReferenceAnimatedItem itemId="antidote" size={120} />);
    expect(html).toContain('<canvas');
    expect(html).toContain('antidote rotating item model');
    expect(html).not.toContain('<img');
  });
});
