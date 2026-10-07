# Browser E2E handoff

## Scope

`playwright.config.ts` starts the local Socket.IO server and Vite client, then runs one deterministic worker with independent desktop (`1440x900`) and touch-phone (`390x844`) browser contexts. Run it with:

```sh
pnpm test:e2e
```

The suite covers the currently reachable UI path: desktop room creation, phone join, distinct role selection, both ready states, host start, a live trade/response path, reconnect-token rotation, stale-page replacement, allowlisted private-objective DOM/socket/storage sentinels, and phone overflow/touch-target checks.

## Current surface limits

- The client now renders spectator and Results/rematch surfaces. They are intentionally outside the executable browser suite because the production server CLI exposes neither a fixed seed nor an injected clock/fixture for deterministically producing a verified dead player or completed match. The server integration suite covers spectator gates, permanent-death projections, and rematch identity; the web component tests cover the rendered controls. Add a seeded browser fixture before promoting either to end-to-end coverage.
- The 56px touch-target gate is active and passes for the current entry and lobby controls. No gameplay, server, or web implementation was changed by QA.
- The suite drives an actual Trade/Accept interaction. Timer-expiry coverage remains blocked until the browser server command can use the engine's injected clock/deadline scheduler; it deliberately does not sleep for live timers.

## Determinism and isolation

The harness never sleeps or depends on wall-clock game timers. Each test receives a fresh server process and room, uses explicit UI state assertions, serial execution, and separate browser contexts (rather than shared storage) for desktop and phone identities. Playwright retains trace, screenshot, and video artifacts on a failure.
