# Implementation Status

**ZIP-priority mechanics sync implemented and verified locally (2026-10-13):** the latest handoff presentation is integrated with 60-second normal turns; 30-second Trade/Threat responses; 15-second overflow and immediate-loot decisions; 30-second Public and private market decisions; private Round Tasks with one +2 Gold reward; Tycoon's 15-Gold plus successful-Trade requirement; Phoenix's first eligible Medicine offer; and Stimulant/Temporary HP rules. The final gate passed 572 workspace tests, 79 beta-harness tests, 23 Playwright scenarios, the presentation smoke, all typechecks, and the production build.

**v14 and later playtest revisions remain incorporated:** the current rules and ZIP supersede affected historical acceptance claims below. A fresh human playtest and external promotion remain separate release gates.

Current acceptance scope is **desktop only**. The 2026-10-07 art/audio patch is integrated; inventory, integration corrections, and verification evidence are tracked in [Art patch integration](audit/ART_STYLE_PATCH_INTEGRATION.md). Earlier mobile foundation checks are not a claim of mobile visual-fidelity acceptance.

| Area | Status | Notes |
|---|---|---|
| Source review and mismatch audit | COMPLETE | Game, art, 3D, desktop/mobile UI, and design runtime audited. |
| Workflow and production docs | COMPLETE | Initial authoritative rules, schema, architecture, decisions, and workflow are in place. |
| Content configuration | COMPLETE | Canonical items, Roles, all 20 objectives, market/chest distributions, and balance constants are centralized in `packages/content`; the complete cue registry is centralized in `packages/audio`. |
| Room and lobby | FUNCTIONAL | Authoritative create/join/role/ready/start flow and responsive React lobby are implemented and tested. |
| Reconnect identity | FUNCTIONAL / IN-MEMORY | Salted rotating tokens restore the same seat and revoke stale sockets; durable restart recovery remains pending. |
| Roles and private objectives | COMPLETE | Unique Role claims, kits, deterministic compatible assignment, targets, contingencies, and private projections are implemented. |
| Turn and round engine | COMPLETE | Fixed seats, turns, responses, timeouts, rounds, Intermission, Results, and rematch transitions are deterministic. |
| Inventory and Pockets | COMPLETE | Visible slots, locked Pockets, Bag/Safe/Armor, stacking, atomic ownership, and overflow decisions are implemented. |
| Items and statuses | COMPLETE | Production item effects, equipment, Poison, healing, access, theft, information, and role abilities are implemented. |
| Trade and Threat | COMPLETE | Atomic transfers, covered/open threats, timeout defaults, disconnect cancellation, ammunition, and adjacency are tested. |
| Combat and Downed | COMPLETE | Damage, Armor, Downed rescue windows, loot/help/revive, poison pause, death, and fixed-seat expiry are tested. |
| Shops and chests | COMPLETE | Seeded Public/Black Markets, resale, shopper order, chest persistence/refresh, finite Artifacts, and Black Key guarantee are implemented. |
| Objectives, exits, scoring | COMPLETE | All objective predicates, readiness, forced banking, privacy, exit ordering, contingencies, and scores are tested. |
| Spectator and communication | COMPLETE | Verified god view, read-only enforcement, global/private text, Results/rematch, and opt-in authenticated WebRTC voice for connected living players are implemented. TURN remains an operator-supplied deployment input. |
| Desktop visuals and art patch | VERIFIED LOCALLY | Supplied patch integrated into the first-person table, target/chest action clips, reference overlays, and markets. Short-desktop, scene, interaction, and full-viewport guide checks pass. Mobile fidelity is deferred. |
| Audio and intro sequence | VERIFIED LOCALLY | Supplied designed cue palette and all five music tracks are integrated with scene transitions, source hit/use timing, persisted buses, trusted-interaction enablement, and lifecycle cleanup. All 93 cue IDs render nonzero browser output. |
| Deployment | PACKAGED / NOT PROMOTED | Non-root single-owner Docker/Compose package, health checks, origin policy, and smoke scripts are complete. Docker runtime validation and a real hosting target/credentials remain external release gates. |
| Full multi-device playtest | LOCAL AUTOMATION VERIFIED / HUMAN PENDING | Nineteen current Playwright scenarios plus focused v14 pointer/market checks cover desktop setup, privacy, reconnect, responses, deadlines, Downed/Concede, Intermission, death/spectator, scoring, and rematch. This is not a four-device human playtest or mobile-fidelity acceptance. A deployed four-device playtest remains a release gate. |
