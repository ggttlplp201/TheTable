# Current Task

## Goal

Close the remaining presentation and communication gaps from the production brief: a real first-person table-arrival sequence, exhaustive replaceable audio/event feedback, and browser microphone/WebRTC voice built on the existing authoritative signaling boundary.

## Relevant rules

- Presentation may react to authoritative events but must never mutate, delay, or gate gameplay.
- The arrival sequence targets 5–8 seconds, uses the supplied room/table language, and is skippable after first viewing.
- Public cues/clips go only to authorized observers; private inspection/Pocket information remains owner-only.
- Voice is global only for connected living players. Spectators and inactive players cannot signal or transmit.
- Missing TURN credentials must degrade clearly to text/audio UI without weakening server authorization.

## Likely files

`packages/audio`, `packages/visual`, `apps/web` presentation/voice modules, focused tests, and agent reports. Gameplay legality remains in `packages/game`; identity and signaling authorization remain in `apps/server`.

## Acceptance criteria

- Match start presents a short first-person walk/chair/settle sequence without blocking commands or authoritative updates.
- Every material interaction named by the build brief has a centralized public/private-aware cue or an explicit documented visual-only decision.
- Authoritative public events drive appropriate table clips without exposing covered/private assets.
- Opt-in browser voice connects living peers through the existing signal gate, with mute/leave/error states and clean teardown.

## Tests required

Audio mapping completeness/privacy tests, intro/clip lifecycle tests, WebRTC adapter tests with injected browser doubles, desktop/phone browser smoke, and full workspace tests/typechecks/builds.

## Non-goals

Changing gameplay rules, introducing distributed room ownership, selecting or purchasing a TURN/hosting vendor, or tuning prototype balance without playtest evidence.

## Risk

HIGH
