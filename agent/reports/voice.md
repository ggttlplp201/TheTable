# Browser voice completion

## Outcome

The web client now provides opt-in global voice for two to four connected living
players. Audio uses a browser WebRTC mesh; Socket.IO carries only authenticated
presence and negotiation messages. Gameplay commands, timing, projections, and
authority are unchanged.

## Authorization and privacy

- `voice:join` is required before a socket may send or receive a signal.
- The room runtime derives eligibility from the authoritative player record on
  every join/signal/publish: the player must be connected and may not be `DEAD`
  or `EXITED`.
- `voice:signal` requires both authenticated endpoints to be opted in, living,
  connected, distinct players in the same room. The server supplies the sender
  identity; clients cannot forge it.
- Disconnect and session replacement remove voice membership. Reconnect never
  inherits the old browser's microphone opt-in; an already-running client
  explicitly rejoins after its rotated session is restored.
- Death/exit and view changes prune peers and close their browser connections.
  Spectator UI mounts no voice controls, and the server rejects spectator join
  or signaling attempts.
- TURN credentials are returned only after room authentication, not on an
  unbound Socket.IO connection.

## Browser media lifecycle

`apps/web/src/voice.ts` isolates microphone, peer-connection, and remote-audio
DOM APIs behind `VoiceBrowserAdapter`. `VoiceMesh` is testable with injected
doubles and does not need a real microphone.

- The microphone is requested only after `Join table voice` is pressed.
- Player-ID lexical ordering chooses the initial offerer. The mesh also uses a
  deterministic polite/impolite perfect-negotiation rule for colliding offers,
  including rollback on the polite side and collision ignore on the other.
- ICE candidates arriving before the remote description are buffered.
- Mute disables every local audio track. Leave/unmount/ineligibility stops all
  tracks, closes all peer connections, detaches remote audio elements, and
  removes event handlers.
- A transport interruption stops capture and closes peers while retaining the
  user's prior explicit intent. After session restoration the client reacquires
  the microphone, explicitly rejoins server presence, and builds fresh peers.
  Leaving or losing eligibility clears that intent and stops capture completely.
- The panel reports microphone errors, signaling/peer failures, per-player
  connecting/connected/reconnecting/failure state, mute state, and availability.
  Text remains available throughout voice failure.

## ICE and deployment

`VOICE_ENABLED` remains false by default. `VOICE_ICE_SERVERS` accepts a bounded
JSON array using only `stun:`, `stuns:`, `turn:`, and `turns:` URLs. TURN entries
must contain both username and credential; malformed JSON or unsafe schemes fail
startup. No service or paid vendor is selected or hardcoded.

The authenticated capability contains `{ enabled, iceServers,
relayConfigured }`. With voice enabled but no TURN URL, the client explicitly
warns that connections are direct-only and may fail on restrictive networks.
Deployment examples and the HTTPS/microphone requirement are documented in
`.env.example`, `deployment/compose.yaml`, and `deployment/README.md`.

## Verification

Focused checks:

- server voice configuration and runtime integration: 20 tests passed;
- injected browser mesh: 6 tests passed.

Full checks:

- `pnpm --filter @the-table/server test`: 46 tests passed;
- `pnpm --filter @the-table/web test`: 66 tests passed;
- server and web `typecheck`: passed;
- server and web production `build`: passed;
- `node apps/web/test/browser-smoke.mjs`: passed phone/desktop overflow,
  touch-target, action payload, spectator-control, and browser-error checks.

The web production build retains the existing warning for the dynamically
loaded table-scene chunk exceeding 500 kB; voice adds no dependency and does not
change that boundary.
