# Audio coverage report

## Completed coverage

`packages/audio/src/mappings.ts` now centralizes every authoritative event currently emitted by `packages/game`: match/turn/intermission/order; all Trade and Threat outcomes; weapons, damage, poison, healing, Armor, Handcuffs, Downed/revive/loot/death; chest refresh/open/inspection; market purchase/sale/reroll; Pocket/pickpocket; objective/exit; and overflow resolution.

The local cue catalog covers all canonical content items: Knife, Pistol, Bullet, Poison, Antidote, Medicine, Armor, Cloth, Bag, Safe, Spyglass, Pickpocket, Key, Lockpick, Crowbar, Black Key, Handcuffs, Brass Idol, Glass Eye, Red Ledger, and Passage Token. It also provides semantic IDs for coins, inventory/Pocket handling, join/ready/match, turn/response warnings, door/footstep/chair/table/coin motion, room/shop ambience, and results. All cues are procedural, restrained analog placeholders behind replaceable stable IDs.

## Privacy contract

- Public event routing uses event kind only. It does not parse log text or inspect private payload values.
- Pocket and chest inspections receive the same generic public cue for every observer. An extra detail cue is allowed only when the viewer's own authorized private inspection payload is explicitly passed in; audio does not inspect that payload.
- Covered Threat cues are mode-agnostic before resolution. No sound encodes a committed item's identity.
- The receipt cache deduplicates an event ID before any public or private cues play.

## Machine check

`packages/audio/src/audio.test.ts` asserts that the authoritative-event manifest exactly matches the current engine event list, every listed event produces a public cue and a procedural tone, every canonical item has a local cue, and another player's private payload cannot produce a private cue.

## Structured public metadata integration

The final hub integration added narrow `ActionEvent.presentation` facts so exact public cues never need to parse prose:

- `WEAPON_USED` carries the resolved public weapon item ID.
- `CHEST_OPENED` carries public chest kind and the publicly used access item.
- Public Shop purchases and public sales may carry their public item ID.
- Covered Threat items appear only on resolution, never while the offer is pending.
- Black Market purchases intentionally carry no item or market metadata and use a generic public log entry/cue.

`PICKPOCKET` remains outcome-generic because success versus an empty/protected Pocket is not a public structured fact. That cue is deliberately privacy-safe.

## Authoritative privacy and semantic data

- The previously reported Black Market public-text leak is fixed and regression-tested.
- The obsolete partial `packages/content` audio registry was removed. `packages/audio/src/mappings.ts` and `types.ts` are the single complete runtime source of cue truth.

## Validation

- `pnpm --filter @the-table/audio typecheck`
- `pnpm --filter @the-table/audio test` — 8 tests passed
- `pnpm --filter @the-table/audio build`
