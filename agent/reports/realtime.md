# Realtime server integration

The server owns socket authority, salted reconnect credentials, serialized room work, request validation, idempotency, absolute deadline scheduling, chat routing, voice signaling, and room expiry. Gameplay legality and private projections belong to `packages/game` through `GameAdapter`.

## Client contract

Every acknowledgement is `{ ok: true, data }` or `{ ok: false, error: { code, message, revision? } }`. Supply an acknowledgement callback when a reply is needed; malformed fire-and-forget packets do not crash the server.

| Event | Input | Successful data |
| --- | --- | --- |
| `room:create` | `{ name }` | `{ playerId, reconnectToken, view, voiceEnabled }` |
| `room:join` | `{ code, name }` | `{ playerId, reconnectToken, view, voiceEnabled }` |
| `room:reconnect` | `{ code, reconnectToken }` | `{ playerId, reconnectToken, view, voiceEnabled }` |
| `room:sync` | `{}` | `{ view, voiceEnabled }` |
| `room:spectate` | `{}` | `{ view, voiceEnabled }`; only authenticated DEAD/EXITED players |
| `room:command` | `{ idempotencyKey, type, payload?, expectedRevision?, roomId? }` | `{ revision }` |
| `lobby:claim-role` | `{ idempotencyKey, roleId, expectedRevision?, roomId? }` | `{ revision }` |
| `lobby:ready` | `{ idempotencyKey, ready, expectedRevision?, roomId? }` | `{ revision }` |
| `match:start` | `{ idempotencyKey, expectedRevision?, roomId? }` | `{ revision }` |
| `room:rematch` | `{ idempotencyKey, expectedRevision?, roomId? }` | `{ revision }` |
| `room:close` | `{ idempotencyKey, expectedRevision?, roomId? }` | `{ revision, closed: true }`; host only |
| `chat:send` | `{ idempotencyKey, text, toPlayerId?, expectedRevision?, roomId? }` | `{ revision }` |
| `voice:signal` | `{ toPlayerId, signal }` | `{ delivered: true }` |

Client commands use `type` plus `payload` containing the remaining engine-command fields. The server generates the start seed. `DOWNED_INTERACTION.kind` accepts `LOOT`, `REVIVE`, and `HELP`; the engine validates whether the supplied Medicine or Antidote is legal for the selected help action. It rejects arbitrary actor, player, clock, seed, connection, and timeout fields. Mutating aliases require idempotency keys too. Use a new key for each deliberate action; keep the same key and payload when retrying that action.

The server emits `room:view` separately to each authenticated socket after state changes. It contains the engine owner or verified spectator projection, `viewerPlayerId` for the authenticated player, `spectator: true` only on spectator views, and `messages`, an array of global messages and only that player's sent/received private messages. No room-wide private emission exists. The compatibility `room:public` event contains only the projection's public portion. Clients should render `room:view`; mutation acknowledgements contain a receipt revision, not another snapshot.

Each message has `{ id, at, fromPlayerId, channel: 'GLOBAL' | 'PRIVATE', text, toPlayerId? }`. The room retains the newest 200 messages and clears them on rematch or teardown. Spectators may read the global history and their own prior private correspondence, but cannot send chat or voice. Private messages between other players remain private from spectators.

`server:capabilities` carries `{ voiceEnabled }`. Voice is disabled by default and still leaves text available. Enable it with `VOICE_ENABLED=true`. Signals are strict offer/answer `{ type, sdp }` or ICE `{ type: 'candidate', candidate, sdpMid?, sdpMLineIndex? }`; only a connected living peer in the same room receives `voice:signal` with the authenticated `fromPlayerId`.

`session:replaced` revokes the old socket and disconnects it. The new socket must persist the returned rotated reconnect token. Admission/reconnect replies include `playerId` even when a spectator view has no top-level `private`; do not derive spectator identity from `view.private`. `room:closed` supplies `{ code, reason }`, including `ROOM_EXPIRED`, `HOST_CLOSED`, or `SERVER_SHUTDOWN`.

## Authority and concurrency

One socket binds to one room/player. A second create, join, or reconnect on a bound socket fails with `ALREADY_JOINED`. Reconnect credentials carry a random lookup ID and 256-bit secret; only a per-session random salt and SHA-256 digest are retained. Rotation and socket replacement happen within the room queue. Queued work checks the current socket generation before it may mutate.

Every room has one queue for commands, admission, reconnect, disconnect, snapshots, voice routing and deadline work. Deadline checks also run before commands, so delayed scheduler delivery cannot extend a turn or response window. Before resolving deadlines, the runtime observes actual socket liveness and applies disconnected state through the engine; a queued disconnect cannot accidentally auto-accept an interaction after the target socket is gone.

Idempotency records are scoped to player and room lifetime, survive reconnect and rematch, and retain both successful and rejected outcomes. A reused key with different content fails with `IDEMPOTENCY_CONFLICT`. Fingerprints use canonical JSON ordering and SHA-256; request bodies are not retained. The default room limit is 20,000 receipts; reaching it rejects new commands rather than evicting records and risking duplicate effects. Maximum queue depths, packet sizes, payload complexity and per-socket request budgets are bounded.

Spectator status is recomputed from server-side life state for every projection and command. DOWNED players are not spectators. Gameplay and communication are read-only after permanent death/exit; host room closure and results rematch remain lifecycle operations.

## Lifetime and operation

Defaults are 30 minutes of lobby inactivity, 24 hours of active-room recovery, and one hour after results activity. Successful commands or membership changes refresh the appropriate expiry; reads and duplicate delivery do not. Automatic turn expiry does not keep an abandoned active room alive indefinitely. Teardown clears timers, sessions, members, chat, receipts and the engine room. Rematch preserves identity and fixed seats through the game transition while removing old chat.

`createTableServer` is an importable HTTP/Socket.IO factory for tests and embedding. `/health/live` and `/health/ready` are available. `CLIENT_ORIGIN` accepts a comma-separated allowlist and is checked for WebSocket upgrades as well as CORS. `HOST`, `PORT`, and optional `STATIC_DIRECTORY` configure the executable. SIGINT/SIGTERM close the runtime and sockets. `pnpm --filter @the-table/server start` uses tsx because workspace packages currently export TypeScript source.

The approved Intermission policy skips a disconnected active shopper atomically, without buying or transferring anything, and also skips previously disconnected players when they reach the front of the queue. Reconnect preserves their seat and future participation; it does not rewind their skipped shopping opportunity. If a final shopper has an existing overflow, its existing 15-second decision/default resolves before the round advances. This adds no new gameplay timer.

This runtime has one in-memory owner process. Restart recovery, Redis persistence, distributed room ownership, TURN service configuration, and real microphone negotiation are not implemented by this server task. Do not deploy multiple independent room owners behind a load balancer and assume shared state.

## Verification

Final checks: 39 tests pass across actual Socket.IO runtime tests, strict command/session boundary tests, and the QA-owned lobby suite. Production and test TypeScript checks pass. Server compilation passes.

Coverage includes 2/3/4-client admission, duplicate roles, owner-private and public sentinel isolation, private chat, spectator gates, simultaneous token replay, rotation/seat restoration, queued stale-socket commands, command deduplication across reconnect, altered-key rejection, stale revisions, packet/ack handling, voice recipient isolation, delayed scheduler wakes, disconnect cancellation, the timeout-before-disconnect queue race, room expiry, timer cleanup and rematch identity.

The production `RoomStoreAdapter` uses the pure `applyCommand`, `applyTimeout`, `setConnection`, `getNextDeadline`, `projectAuthorizedRoom`, and `projectSpectatorRoom` exports. It replaces state only on successful transitions and disables unused RoomStore credentials with `issueSessions: false`. Ten real-engine Socket.IO tests exercise 2/3/4-player initialization, item locks and transfer idempotency, connected timeout defaults, disconnect cancellation, permanent death/spectating, rematch, and private Intermission markets. The deterministic adapter double separately stresses adversarial transport queue ordering. The real-engine suite also confirms active and previously disconnected shopper skipping, no-spend behavior, and reconnect into a verified spectator view before rematch. No failing privacy or concurrency regression remains in this suite.

Commands run successfully: `pnpm --filter @the-table/server test`, `pnpm --filter @the-table/server typecheck` (production and test harness), `pnpm --filter @the-table/server build`, and `git diff --check -- apps/server agent/reports/realtime.md`.
