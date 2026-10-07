# Table arrival and public presentation

## Implementation

Owned files are `packages/visual`, `apps/web/src/GameTableScene.tsx`, the new `table-presentation`/`table-scene-runtime` modules and styles/tests, and `apps/web/test/presentation-smoke.mjs`. No gameplay authority, rules, audio package, MatchView, voice implementation, root dependencies or shared agent status documents were edited by this task.

Read build brief sections 9/11/12, GAME_RULES, CURRENT_TASK, DECISIONS, gameplay-ui report and visual source/README. `agent/reports/visual-3d.md` is absent from this checkout.

- A deterministic 7.2-second first-person path works for all four assigned seats: four subtle walking beats, approach behind the chair, visible chair pull, sit, push/settle, brief glance, and return to the existing overview. Chairs use the supplied wood/materials and now have a named group and four legs. The viewer body is implicit during arrival.
- `TableArrival` exposes deterministic camera samples, once-only semantic beats, finish, and idempotent disposal. Frame callbacks never advance or delay authoritative timers.
- The React scene dynamically loads the visual runtime. Incoming public snapshots update the same renderer; chest changes do not recreate the canvas. There is no transport/command import or dispatch capability in presentation code.
- Reduced motion skips the arrival and clips, stops the continuous frame loop, and still redraws snapshots/resizes. Changing the preference mid-arrival immediately restores overview. Background tabs stop animation; stale feedback is not queued.
- Skip Intro appears only after a completed first viewing. The existing `the-table:arrival-seen:v1` localStorage key is preserved and written on completion. Fresh rematches still play; previously seen players can skip immediately. A per-room match marker in sessionStorage prevents reload/reconnect replay, with in-memory fallbacks for blocked storage. Late joins remain overview-only. The semantic HUD and commands remain usable during the first viewing.
- The runtime owns/disposes frame requests, media/visibility/context listeners, ResizeObserver, transient shop kits, shadow targets, postprocessing, visual kit and renderer. WebGL initialization/runtime/context-loss failure leaves the semantic UI available. Transient clips have at most six concurrent channels, no backlog, bounded cached public item/character models, and deterministic absolute impact poses.

## Public event coverage

The observer primes its first snapshot, deduplicates revisions/sequences, rejects stale revisions, skips old catch-up events and resets at each match start. It reads public kinds, actor/target IDs and public chest availability. It never parses `publicText`, examines a private payload, infers a used item from inventory changes, or reads objectives/Pockets/Black Market offers.

| Public evidence | Presentation |
| --- | --- |
| HEALED / REVIVED | Supplied Medicine lift/cap/seal clip at the actor's table edge |
| POISON_CURED / POISON_APPLIED / HANDCUFFED | Supplied Antidote / Poison / Handcuffs clips |
| ARMOR_BLOCKED | Supplied Armor impact clip at the target |
| DAMAGE / POISON_DAMAGE | Restrained absolute target recoil, composed with current Downed pose |
| CHEST_OPENED plus AVAILABLE → OPENED | Open the matching public chest lid, without contents or an inferred tool |
| INTERMISSION plus public Shop offers | Present the actual public offer models; updates/removals follow snapshots |
| PURCHASE / SOLD / TRADE_ACCEPTED / THREAT_COMPLIED | Neutral brass resolution marker at the actor; no inferred asset or coin quantity |
| EXIT / DEATH | Public character departure around the table perimeter / slump; public life state applies immediately |

## Final hub integration

`MatchView` supplies the authenticated viewer identity to `GameTableScene`; spectators omit it and remain in the safe overview. The application-owned, gesture-gated audio engine receives `footstep`, `chair-pull`, `sit`, `chair-settle`, and `table-creak` arrival beats, so the sequence has synchronized procedural sound without creating a second engine.

The authority layer now emits deliberately narrow public `ActionEvent.presentation` metadata for resolved public facts: used weapon, chest kind and tool, Public Shop purchase, sale, and the revealed item after a covered Threat resolves. Black Market purchases expose no item or market metadata, and unresolved or cancelled covered Threats expose no covered item. The observer uses these fields for exact public clips and never parses event prose or infers private state.

## Verification

- Visual package: 11 tests across 2 files pass, including all-seat path continuity, exact overview restoration, beat deduplication, skip/disposal and existing model/resource coverage.
- Web package: 70 tests across 7 files pass, including 10 presentation tests for privacy, replay/stale snapshots, chest transitions, bounded effects, absolute impact pose and intro/rematch policy. Counts also include voice ownership and reconnect-race coverage.
- Visual/web typechecks and production builds pass with the corrected intro policy. `git diff --check` passes for all owned files.
- Presentation browser smoke covers the full cadence, first-view completion, rematch/skip, reload policy, updates during arrival, usable adjacent command control, same-canvas updates, chest/shop/life clips, 390px phone, reduced motion, context-loss fallback and teardown. Existing gameplay browser smoke also passed for real UI command payloads, phone/desktop overflow and spectator controls.
- Captures inspected: `/tmp/table-arrival-approach.png`, `/tmp/table-arrival-chair.png`, `/tmp/table-presentation-overview.png`, `/tmp/table-presentation-phone.png`.
- The lazy visual runtime is approximately 519 kB uncompressed / 136 kB gzip; Vite retains its >500 kB chunk warning.

The browser presentation harness tests the renderer against public fixtures, not live server authority or real audio. Multiplayer E2E remains the hub/QA responsibility.
