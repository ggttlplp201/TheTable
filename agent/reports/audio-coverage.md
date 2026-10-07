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

## Engine metadata needed for higher-fidelity public clips

The audio layer intentionally uses generic cues for the following facts because `ActionEvent` exposes only `kind`, public prose, actor, and targets. Parsing prose would be brittle and would weaken the privacy boundary.

- `WEAPON_USED`: add public `itemId`/`weaponKind` to distinguish Knife from Pistol.
- `PICKPOCKET`: add public `outcome: 'STOLEN' | 'EMPTY_OR_PROTECTED'` if different public resolution cues are desired.
- `PURCHASE`/`SOLD`: add a public market/category field only if the game rules permit it; do not expose an item ID for a private Black Market purchase.
- `CHEST_OPENED`: add a public chest kind if Standard and Black chest clips should differ without reading prose.

Until those fields are authoritative, the generic public cues are deliberate and privacy-safe.

## Hub follow-up: authoritative privacy and semantic data

- `packages/game/src/actions.ts` emits `PURCHASE` with the purchased item name for both Public and Black Market buys, and public projection forwards event text. If Black Market purchase identity is meant to remain owner-private, that is an engine/projection privacy leak independent of audio; emit a generic public purchase event plus an owner-private item payload instead.
- `packages/content`'s exported `AUDIO` object is a legacy subset (it omits most engine events and canonical items). `packages/audio/src/mappings.ts` is now the complete runtime source of cue truth. Consolidation would require a content-package change, which was intentionally left outside this task's ownership.

## Validation

- `pnpm --filter @the-table/audio typecheck`
- `pnpm --filter @the-table/audio test` — 8 tests passed
- `pnpm --filter @the-table/audio build`
