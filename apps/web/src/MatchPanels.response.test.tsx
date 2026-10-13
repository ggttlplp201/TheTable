import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { PendingInteraction, responseShortcutIntent } from './MatchPanels';
import { ownerRoom } from './test-fixtures';

const keyEvent = (overrides: Partial<Parameters<typeof responseShortcutIntent>[0]> = {}): Parameters<typeof responseShortcutIntent>[0] => ({
  altKey: false,
  ctrlKey: false,
  defaultPrevented: false,
  isComposing: false,
  key: 'y',
  metaKey: false,
  repeat: false,
  shiftKey: false,
  target: null,
  ...overrides,
});

describe('response window v2', () => {
  it('maps only unmodified, non-repeating Y/N shortcuts outside editors', () => {
    expect(responseShortcutIntent(keyEvent({ key: 'y' }))).toBe(true);
    expect(responseShortcutIntent(keyEvent({ key: 'N' }))).toBe(false);
    expect(responseShortcutIntent(keyEvent({ key: 'x' }))).toBeUndefined();
    expect(responseShortcutIntent(keyEvent({ key: 'y', repeat: true }))).toBeUndefined();
    expect(responseShortcutIntent(keyEvent({ key: 'y', ctrlKey: true }))).toBeUndefined();
    expect(responseShortcutIntent(keyEvent({ key: 'y', shiftKey: true }))).toBeUndefined();
    expect(responseShortcutIntent(keyEvent({ key: 'y', isComposing: true }))).toBeUndefined();
    expect(responseShortcutIntent(keyEvent({ key: 'Process' }))).toBeUndefined();
    expect(responseShortcutIntent(keyEvent({ key: 'y', defaultPrevented: true }))).toBeUndefined();
    expect(responseShortcutIntent(keyEvent({ key: 'y', target: {} as EventTarget }))).toBe(true);
    expect(responseShortcutIntent(keyEvent({ key: 'y', target: { closest: () => ({}) } as unknown as EventTarget }))).toBeUndefined();
  });

  it('renders the threat timeline and accessible Y/N response controls', () => {
    const room = ownerRoom();
    room.private.capabilities = ['RESPOND_THREAT'];
    room.public.pendingThreat = { id: 'threat', actorId: 'p2', targetId: 'p1', mode: 'COVERED', demandedItems: [], demandedCoins: 2, status: 'PENDING', deadlineAt: Date.now() + 30000 };
    const html = renderToStaticMarkup(<PendingInteraction room={room} send={vi.fn(async () => true)} busy={false} />);
    expect(html).toContain('class="response-progress"');
    expect(html).toContain('aria-keyshortcuts="Y"');
    expect(html).toContain('<kbd aria-hidden="true">Y</kbd>Comply');
    expect(html).toContain('aria-keyshortcuts="N"');
    expect(html).toContain('<kbd aria-hidden="true">N</kbd>Refuse');
    expect(html).toContain('No response → Comply');
  });
});
