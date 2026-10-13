import { useEffect, useState } from 'react';
import { itemName } from './gameplay';
import { AnimatedReferencePortrait } from './ReferencePortrait';

const EMPTY_IMAGE = 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';
const MODEL_IDS: Record<string, string> = { 'black-key': 'blackkey', 'brass-idol': 'brassidol', 'glass-eye': 'glasseye', 'red-ledger': 'redledger', 'passage-token': 'passage', bag: 'pocket' };
const ROLES = [
  { key: 'enforcer', hex: 0xe0a040 }, { key: 'medic', hex: 0xb84030 },
  { key: 'smuggler', hex: 0x7aa08a }, { key: 'locksmith', hex: 0x6a8ab8 },
  { key: 'broker', hex: 0x6a8ab8 }, { key: 'scavenger', hex: 0xe0a040 },
];
let art: { icons: Record<string, string>; tinyIcons: Record<string, string>; portraits: Record<string, string> } | undefined;
let pending: Promise<NonNullable<typeof art>> | undefined;

/** The HTML's own 48px icon renderer and 120×170 portraits, generated once per page. */
export function loadReferenceArt() {
  if (!pending) pending = Promise.all([import('three'), import('./reference-game-kit.js')]).then(async ([three, kit]) => {
    const tiny = kit.renderIconURLs(three, [...kit.ITEMS.map(item => item.id), ...kit.STATES.map(state => state.id)], 32);
    const tinyIcons = Object.fromEntries(await Promise.all(Object.entries(tiny).map(async ([id, url]) => [id, await kit.outlineIconURL(url)])));
    const large = kit.renderIconURLs(three, [...kit.ITEMS.map(item => item.id), ...kit.STATES.map(state => state.id)], 48);
    if (tinyIcons.stimulant) tinyIcons.stimulant = await kit.stimIconURL(tinyIcons.stimulant, 32);
    if (large.stimulant) large.stimulant = await kit.stimIconURL(large.stimulant, 48);
    art = {
      tinyIcons: { ...tinyIcons, coin: kit.coinIconURL(32) },
      icons: { ...large, coin: kit.coinIconURL(32) },
      portraits: kit.renderPortraitURLs(three, ROLES, 120, 170),
    };
    return art;
  });
  return pending;
}
function useReferenceArt() {
  const [value, setValue] = useState(art);
  useEffect(() => {
    if (value) return;
    let active = true;
    void loadReferenceArt().then(next => { if (active) setValue(next); }).catch(() => { /* Text labels remain accessible if WebGL is unavailable. */ });
    return () => { active = false; };
  }, [value]);
  return value;
}
export function ReferenceItemArt({ itemId, size = 48, className = '', label }: { itemId: string; size?: number; className?: string; label?: string }) {
  const urls = useReferenceArt();
  return <img className={`reference-item-art ${className}`} src={(size <= 32 ? urls?.tinyIcons : urls?.icons)?.[MODEL_IDS[itemId] ?? itemId] ?? EMPTY_IMAGE} width={size} height={size} alt={label ?? itemName(itemId)} style={{ width: size, height: size, imageRendering: 'pixelated' }} />;
}
export function ReferencePortrait({ roleId, className = '' }: { roleId: string; className?: string }) {
  const urls = useReferenceArt();
  return <AnimatedReferencePortrait roleId={roleId} className={className} fallback={urls?.portraits[roleId] ?? EMPTY_IMAGE} />;
}

export function CoinAmount({ amount }: { amount: number }) { return <span className="coin-amount" aria-label={`${amount} Gold`}><ReferenceItemArt itemId="coin" size={24} label="" />{amount}</span>; }
