import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { SceneChestPrompt, SceneExitPrompt, SceneItemCard } from './SceneContext';
import { ownerRoom } from './test-fixtures';

describe('capability-gated world prompts', () => {
  it('shows authoritative use tags and accessible shortcuts on selected items', () => {
    const room = ownerRoom();
    const markup = (itemId: string) => renderToStaticMarkup(<SceneItemCard item={{ instanceId: 'selected', itemId, quantity: 1 }} room={room} aiming={false} busy={false} onUse={() => {}} onPutDown={() => {}} send={async () => true} />);
    expect(markup('glass-eye')).toContain('TARGETED');
    expect(markup('glass-eye')).toContain('✧ ARTIFACT');
    expect(markup('knife')).toContain('ONE-USE');
    expect(markup('knife')).toContain('aria-keyshortcuts="E"');
    expect(markup('knife')).toContain('aria-keyshortcuts="Q"');
    expect(markup('knife')).toContain('aria-keyshortcuts="Escape"');
    expect(markup('passage-token')).toContain('⬡ QUEST');
  });
  it('never offers chest contents or an illegal opening, and offers the authorized key', () => {
    const room = ownerRoom(), send = vi.fn(async () => true);
    const markup = () => renderToStaticMarkup(<SceneChestPrompt room={room} kind="STANDARD" busy={false} send={send} onClose={() => {}} />);
    expect(markup()).toContain('You need a Key, Lockpick or Crowbar.'); expect(markup()).not.toContain('YES, OPEN');
    room.public.players[0]!.visibleInventory[2] = { instanceId: 'key', itemId: 'key', quantity: 1 };
    expect(markup()).toContain('YES, OPEN'); expect(markup()).not.toContain('ownerInspectionSentinel');
    room.private.capabilities = []; expect(markup()).not.toContain('YES, OPEN');
    room.public.chests![0]!.availability = 'OPENED'; expect(markup()).toContain('Already opened');
  });
  it('renders only the provided exit capabilities', () => {
    const markup = renderToStaticMarkup(<SceneExitPrompt busy={false} canStay={false} send={async () => true} />);
    expect(markup).toContain('LEAVE TABLE'); expect(markup).not.toContain('>STAY<');
  });
});
