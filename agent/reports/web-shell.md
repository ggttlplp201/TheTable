# Web shell integration notes

## What the client owns

- `apps/web` is a React/Vite client with versioned reconnect storage (`the-table/session-v1`). The plaintext reconnect token remains browser-local.
- `TableClient` in `apps/web/src/socket.ts` is the sole Socket.IO boundary. Screens never emit raw events, and player/spectator projections have distinct types.
- Reconnect restoration is scoped to a Socket.IO connection generation. A stale reconnect response cannot replace a newer binding, while every later transport reconnect re-authenticates with the rotating browser-local token.
- The lobby renders only allowlisted public player data. The in-progress side panel reads only the authenticated player's private objective.
- The Three.js table is dynamically imported only after a room is playing through `GameTableScene.tsx`. Lobby, errors, and reconnect paths remain free of the renderer bundle. Renderer resources are recreated only for a room-code or visual-roster change, and a failed renderer import leaves a non-crashing status fallback.

## Realtime contract used by the client

- Session calls: `room:create`, `room:join`, `room:reconnect`, `room:sync`, and `room:spectate`. Only these return snapshots in their acknowledgements. Admission `playerId` is preferred for versioned reconnect identity.
- Live snapshots arrive through `room:view`. `room:public` is consumed as a compatibility update only. Spectator projections are identified by `spectator: true`, use `viewerPlayerId` for identity, and do not have a top-level `private` field.
- Mutations require a unique `idempotencyKey` and optionally send `expectedRevision`: `lobby:claim-role`, `lobby:ready`, `match:start`, and `room:rematch`.
- Mutation acknowledgements are `{ ok: true, data: { revision } }`; the client waits for the following authorized `room:view` rather than treating the acknowledgement as state.
- `room:spectate` takes `{}` after the socket has established room identity. `chat:send` and `voice:signal` are adapter methods for later game surfaces.

## Verification

- `pnpm --filter @the-table/web test` passes: 4 tests, including a later socket-generation restoration test.
- `pnpm --filter @the-table/web typecheck` passes.
- `pnpm --filter @the-table/web build` passes. The Three.js assets remain dynamic chunks and are not required by the lobby. Vite reports the expected >500 kB Three.js renderer chunk; it is loaded only after a match begins.
