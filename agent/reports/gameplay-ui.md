# Gameplay UI handoff

Implemented the player-facing match UI in `apps/web`. Gameplay and transport ownership remain in the game/server packages. The hub added the necessary `@the-table/content` workspace dependency and installed it; this task did not edit the root manifest or lockfile.

## Surfaces

- Round, fixed seat order, active player/shopper, life/connection/statuses, absolute turn/response/overflow countdowns and paused turn time.
- Public inventory/Coins/Pocket occupancy, owner-only Pocket contents, objective description/progress/target/contingency, and inspection history.
- Normal item use including Pocket items, attacks/inspection targets, self healing/revival, Quick Draw, chest tools and Locksmith inspection. Passive equipment is excluded from the use picker. Required opponent inputs default to an active opponent; Knife options preserve fixed-seat adjacency. These are input choices over public facts, not a client rules engine.
- Trade composition with visible assets/Coins, zero offers, terms and Accept/Decline; Open/Covered Threat composition, Cloth/committed item/Quick Draw, demand and Comply/Refuse. Covered commitments remain hidden in the public display.
- Immediate attacker loot and extra Downed loot/revive/help, owner overflow discard/replacement, explicit Stay/Leave Table and end turn.
- Public Shop, owner-private Black Market, purchases, selling, Pocket placement, Safe assignment, Red Ledger and Brass Idol options, and finish shopping.
- Global and one-recipient private text with server-routed message history, escaped text and an explicit voice availability state.
- Verified spectator god view for objectives, Pockets, markets, inspections and chest contents; no gameplay/chat action controls. Results shows projected final scores and reveal status. A host-only Results rematch is the permitted lifecycle exception, including for a spectator host.

## Authority and transport

`AnyRoomView` is one canonical projection. The App no longer mixes `room:public` updates into a potentially older private view. Commands are derived from the `GameCommand` union, include room ID, expected revision and a fresh idempotency key, and exclude server-owned start seeds/actor/time fields. Forms are gated by the projected command capabilities; spent abilities, ammo, locks, market eligibility and final target validity remain server decisions.

Mutation receipts are not treated as snapshots. Rejections display the server message and request a fresh snapshot. An uncertain acknowledgement retains the original request, revision and idempotency key for an explicit safe retry, and blocks new mutation submissions until resolved. The in-flight lock prevents duplicate clicks. Match state/drafts remain mounted during reconnect while controls wait for reauthentication. Reconnect credentials rotate through the existing session flow. Session replacement clears the old UI and reconnects transport to entry without erasing another tab's newly stored credential.

## Responsive and visual behavior

The supplied warm metal palette, light/dark themes, pixel treatment and dynamically imported Three.js/visual package remain. The compact table uses the supplied overview camera to avoid front-character occlusion. Only publicly available chests are instantiated. Reduced-motion mode stops the animated rendering loop and still redraws on resize. A renderer failure leaves all semantic controls available.

Desktop uses two columns. At phone widths, the table overview is followed by actions, public facts, private details and chat. Forms wrap, long names/text break within the viewport, and primary controls/selects have 56px targets. Incoming response and overflow decisions focus their heading and scroll into view so a phone user reading chat cannot miss the timer.

## Verification

Passed:

- `pnpm --filter @the-table/web test`: **49 tests across 5 files**.
- `pnpm --filter @the-table/web typecheck`.
- `pnpm --filter @the-table/web build`.
- `git diff --check -- apps/web agent/reports/gameplay-ui.md`.
- `node apps/web/test/browser-smoke.mjs` against a running Vite server: Chromium at 390px and 1440px, no horizontal overflow, 56px targets, actual form dispatch for item use/zero-asset Trade/covered Threat/private purchase, focused timed decisions, zero spectator buttons/forms, light/dark/reduced-motion rendering, zero browser runtime errors.

Component/adapter coverage includes every command family envelope, exact replay metadata, capability-only action gating, passive-item exclusion, opponent/self/chest input defaults, fixed-seat Knife targets, owner/spectator privacy, hidden Threat commitments, response defaults, visible-only overflow replacement, private markets, exit choices, unrevealed failed objectives, escaped chat, and spectator read-only behavior.

Visual captures were inspected at `/tmp/table-ui-phone.png`, `/tmp/table-ui-shop-phone.png`, `/tmp/table-ui-desktop.png`, and `/tmp/table-ui-desktop-dark.png`. The browser smoke uses authorized projection fixtures and a transport double; real multi-context gameplay E2E remains owned by `qa/e2e` and the hub.

## Remaining integration limits

The projection exposes command categories rather than exhaustive legal input combinations or spent role/artifact counters. The UI does not invent those missing facts; final server rejections remain possible and are visible. Actual microphone/WebRTC calling is not implemented by this task; chat states this explicitly. The build retains Vite's warning for the separate approximately 667 kB uncompressed Three.js chunk; that chunk is loaded only when the table mounts.
