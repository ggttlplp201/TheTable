# Implementation Status

| Area | Status | Notes |
|---|---|---|
| Source review and mismatch audit | COMPLETE | Game, art, 3D, desktop/mobile UI, and design runtime audited. |
| Workflow and production docs | COMPLETE | Initial authoritative rules, schema, architecture, decisions, and workflow are in place. |
| Content configuration | COMPLETE | Canonical items, Roles, all 20 objectives, market/chest distributions, balance constants, and semantic audio keys are centralized in `packages/content`. |
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
| Spectator and communication | SERVER COMPLETE / UI PARTIAL | Verified god-view projection, private/global chat routing, and voice signaling boundary exist; complete gameplay/chat/spectator UI and media negotiation remain. |
| Desktop and mobile visuals | FOUNDATION COMPLETE | Responsive lobby/game shell and reusable Three.js scenes/models/post-FX are integrated; full command HUD and playtest polish remain. |
| Audio and intro sequence | DATA ONLY | Semantic audio map exists; audio assets, playback, mixing, and intro sequence remain. |
| Deployment | BLOCKED | Requires a hosting target and credentials after the local build is verified. |
| Full multi-device playtest | NEEDS PLAYTESTING | Deterministic engine and live Socket.IO integration pass; complete browser command surfaces and Playwright multi-device E2E remain. |
