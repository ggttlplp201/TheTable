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
| Spectator and communication | COMPLETE EXCEPT VOICE MEDIA | Verified god view, read-only enforcement, global/private text, voice signaling boundary, Results, and rematch UI are implemented; microphone/WebRTC peer media remains. |
| Desktop and mobile visuals | FUNCTIONAL / POLISH ACTIVE | Complete command UI, responsive 390px flow, public/private views, and reusable Three.js table/post-FX are integrated. First-person arrival and public event clips remain. |
| Audio and intro sequence | FUNCTIONAL / COVERAGE ACTIVE | Gesture-gated procedural audio, privacy-aware event routing, persisted mixing, ambience, and a skippable presentation intro exist. The specified 5–8 second spatial intro and exhaustive cue coverage remain. |
| Deployment | PACKAGED / NOT PROMOTED | Non-root single-owner Docker/Compose package, health checks, origin policy, and smoke scripts are complete. Docker runtime validation and a real hosting target/credentials remain external release gates. |
| Full multi-device playtest | LOCAL AUTOMATION COMPLETE | Six real-browser scenarios cover desktop/phone admission, privacy, reconnect, Trade, exact deadlines, death/spectator, Results/scoring, and rematch. A deployed four-device playtest remains a release gate. |
