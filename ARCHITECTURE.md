# The Table Production Architecture

## Shape

The repository is a TypeScript workspace with three deployable concerns:

- `packages/game`: deterministic, framework-free content, validation, state transitions, projections, seeded randomness, and tests.
- `apps/server`: long-running Node server using HTTP plus Socket.IO. It owns rooms, sessions, timers, commands, persistence adapters, chat routing, and WebRTC signaling.
- `apps/web`: React/Vite client. It renders public/private projections, the Three.js table, responsive overlays, audio, and input. It never decides whether an action is legal.

The supplied `.dc.html` runtime is not shipped. Its `game-kit.js` geometry/material/shader/camera/clip code is ported behind renderer adapters. Three.js is dynamically loaded only for the table/preview routes so lobby and error paths stay light.

## Authoritative flow

1. Client authenticates with an opaque reconnect token and submits a typed command.
2. Server maps the socket to exactly one room/player session, rate-limits, parses, and validates the command.
3. A per-room command queue serializes mutations. The game package returns a new state and ordered events or a typed rejection.
4. Server persists the new revision before acknowledging when durable storage is enabled.
5. Server derives one public projection, owner-private projections, and verified spectator projections. It emits only the appropriate view to each socket.
6. Client renders the projection and may animate emitted events; animation never gates authoritative resolution.

## Rooms and identity

- Six-character room codes are generated with ambiguous characters removed and checked for collision.
- Player names are normalized for uniqueness within a room while preserving display form.
- First join receives a high-entropy reconnect token. Only a salted token hash is stored; the plaintext token remains in versioned browser storage.
- Reconnect rotates the token, rebinds the same player and seat, cancels stale socket authority, and sends a fresh authorized snapshot.
- Lobby rooms expire after inactivity. Active rooms have a longer recovery TTL. Results rooms remain long enough for rematch and then close.

## Timers and concurrency

- Store absolute server deadlines, never decrementing counters. A scheduler wakes near deadlines and enqueues the same deterministic timeout command used by tests.
- Exactly one mutation queue exists per room. Trade/Threat asset locks are state, validated on every command, and released atomically with resolution/cancellation.
- Commands use idempotency keys. Duplicate delivery returns the prior outcome without replaying effects.
- All item ownership is represented once by instance ID. Invariants reject duplicate instance IDs after every transition in development/tests.

## Persistence

The initial adapter supports in-memory development and Redis production snapshots with TTL. A room snapshot includes state revision, timer deadlines, processed idempotency keys, session-token hashes, and deterministic RNG state. Event logs are append-only within bounded retention. Redis atomic compare-and-set or a single owner process prevents split-brain room writes; horizontal scale uses sticky routing plus distributed room ownership.

No permanent user accounts or personal profiles are stored. Private chat is retained only for the match/reconnect window.

## Public and private state

Projection functions are allowlists, not object redaction. The server never sends another active player's objective, Pocket contents, Black Market, private messages, or inspection results. Spectator projection is a separate function gated by permanent `DEAD`/`EXITED` state and exposes no command capability.

Automated leakage tests serialize every view and assert forbidden sentinels are absent.

## Client responsibilities

- Keep one canonical server projection; use ephemeral local state only for drafts, hover, camera, animation, and audio.
- Treat server rejection as normal and reconcile to the included/current revision.
- Run Three.js outside React's render loop; high-frequency camera/animation values live in refs.
- Desktop and phone use separate compositions over the same semantic actions. Minimum touch target is 56px for primary game controls.
- Voice uses a mesh WebRTC topology for two to four active players with server signaling. Voice can be infrastructure-disabled without removing global text; the UI must report that state explicitly.

## Visual and audio boundaries

`game-kit.js` is split into model factories, scene builders, post-processing, and animation clips. Prototype gameplay data is removed. The production content package supplies labels and effects. The permanent center pistol and decorative interactables are removed; the center remains an event/order presentation area.

Audio uses centralized event-to-cue mappings. Public event cues follow public events; owner-private cues follow private events. Procedural/temporary sounds are replaceable assets with stable semantic IDs.

## Testing

- Unit/property tests: content, assignment, inventory invariants, state transitions, timers, scoring, and projections.
- Simulation tests: deterministic seeded 2P/3P/4P matches and edge-case turn/downed schedules.
- Server integration: multiple Socket.IO clients, reconnect/rotation, timeouts, locks, idempotency, privacy, teardown/rematch.
- Browser E2E: separate contexts on desktop and mobile viewports for full match flows.
- Visual tests: fixed seed/camera screenshots compared at desktop and phone sizes.
- Load/soak: many rooms with accelerated timers, reconnect churn, and invariant checks.

## Deployment

Ship one containerized Node service that serves the built client and owns Socket.IO, plus managed Redis for recovery and scale. Terminate TLS at the hosting platform, enable WebSocket upgrades and sticky routing, and expose `/health/live` and `/health/ready`. CI runs typecheck, unit/integration tests, client build, E2E smoke, and image build before promotion.

Deployment credentials and the final hosting vendor are external operational inputs; the application remains portable through environment variables and adapters.

## Initial mismatch audit

- Prototype permanent center Pistol: remove; Pistol is player inventory.
- Prototype Counterfeit Coin: remove entirely.
- Prototype Extra Pocket item: replace with visible Bag granting a second Pocket.
- Prototype item prices, rarity, use type, damage/healing, Handcuffs, Lockpick, Crowbar, Safe, Spyglass, and Cloth behavior: replace with `GAME_RULES.md` data.
- Prototype role kits/abilities and objective copy: replace with v13 definitions.
- Prototype animation may remain when visually compatible, but authoritative resolution timing is independent.
