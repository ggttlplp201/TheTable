# Current Task

## Goal

Promote the locally complete build through the external release gate: build/run the image on a Docker-capable host, configure an exact HTTPS origin and optional TURN service, then complete the specified four-device deployed playtest.

## Relevant rules

- Keep exactly one authoritative application replica; the current runtime is intentionally in-memory.
- Terminate TLS before the service and preserve WebSocket upgrades.
- Supply TURN credentials only if production voice must work across restrictive networks; credentials are delivered only after room authentication.
- Do not promote until four independent devices complete a full deployed match and rematch.

## Likely files

`Dockerfile`, `deployment/`, `.env.example`, the selected external host/TURN configuration, and the release evidence log. No local feature code is presently required.

## Acceptance criteria

- `deployment/smoke-image.sh` passes on a Docker-capable machine.
- The deployed HTTPS URL passes health, WebSocket, reconnect, and exact-origin checks.
- Four independent devices complete create/join, full match lifecycle, voice/text, spectator transition, Results, and rematch.
- Any release-only issue is reproduced and added to the deterministic local suite before promotion.

## Tests required

Docker image/Compose smoke, external Playwright smoke, and a recorded four-device playtest. Retain the passing local workspace, E2E, and packaging gates.

## Non-goals

Changing gameplay rules, introducing distributed room ownership, or tuning balance without playtest evidence.

## Risk

MEDIUM / EXTERNAL INPUT REQUIRED
