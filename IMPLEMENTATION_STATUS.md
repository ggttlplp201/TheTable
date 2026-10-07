# Implementation Status

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
| Desktop and mobile visuals | COMPLETE LOCALLY | Complete command UI, responsive 390px flow, reusable Three.js table/post-FX, a 7.2-second assigned-seat arrival, and public event clips are integrated and browser-tested. |
| Audio and intro sequence | COMPLETE LOCALLY | Pre-match gesture enablement, exhaustive semantic cue/event manifests, owner-private routing, ambience, accepted local-action feedback, and synchronized footstep/chair/table arrival beats are integrated. |
| Deployment | PACKAGED / NOT PROMOTED | Non-root single-owner Docker/Compose package, health checks, origin policy, and smoke scripts are complete. Docker runtime validation and a real hosting target/credentials remain external release gates. |
| Full multi-device playtest | LOCAL AUTOMATION COMPLETE | Six real-browser scenarios plus gameplay/presentation smokes cover desktop/phone admission, privacy, reconnect, Trade, exact deadlines, death/spectator, Results/scoring, rematch, intro policy, reduced motion, and teardown. A deployed four-device playtest remains a release gate. |
