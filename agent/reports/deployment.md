# Deployment packaging report

## Outcome

The production path is a single multi-stage Docker image containing the built
Vite client and exactly one authoritative Node/Socket.IO room owner. The same
process serves static client routes, `/health/live`, `/health/ready`, and
`/socket.io/`. No paid hosting vendor was selected or contacted.

The runtime image uses Node 22, runs as the image's unprivileged `node` user,
declares a readiness health check, and carries machine-checkable labels for the
single-owner topology. The Compose reference adds init/signal handling, a
read-only root filesystem, a bounded `/tmp` tmpfs, restart policy, loopback-only
port publishing, health gating, and two independent one-replica guards:
`deploy.replicas: 1` and a fixed container name that makes Compose scaling fail.

## Operational contract

- `CLIENT_ORIGIN` must contain the exact public HTTPS browser origin(s); it gates
  CORS and WebSocket upgrades.
- TLS terminates at the reverse proxy. The upstream container receives HTTP and
  the proxy must preserve Socket.IO WebSocket upgrades and long-lived sessions.
- The bundled browser client uses the same origin, so no production
  `VITE_SERVER_URL` is baked into the image.
- `/health/live` checks HTTP process liveness. `/health/ready` reflects the room
  runtime's readiness and is the traffic gate.
- Voice remains disabled by default. Enabling it activates opt-in browser WebRTC;
  reliable restrictive-network connectivity still requires operator-supplied TURN.

## Persistence and scale limits

The shipped server has only in-memory ownership. Restarting or replacing the
container loses active rooms, sessions/reconnect credentials, timers, chat, and
idempotency receipts. A restart policy restores the process but cannot restore a
match. Deployments must drain active games and accept downtime.

Multiple replicas are unsafe even with sticky sessions because no durable
snapshot adapter, atomic ownership lease, fencing, or handoff exists. Autoscale,
rolling overlap, blue/green overlap, cluster mode, and multi-host load balancing
must remain disabled. The Redis/scaling description in `ARCHITECTURE.md` is a
future architecture, not current runtime behavior.

## Files

- `Dockerfile`: build, compile check, web bundle, production prune, non-root
  runtime, health check, and authority labels.
- `.dockerignore`: excludes local dependencies, build output, credentials,
  reports, and test artifacts from the Docker build context.
- `.env.example`: public origin, conservative voice default, and host port.
- `deployment/compose.yaml`: vendor-neutral one-owner reference deployment.
- `deployment/README.md`: build/run, TLS/proxy, origin, health, persistence, and
  scaling runbook.
- `deployment/validate-packaging.sh`: fast static policy checks plus optional
  `docker compose config` validation.
- `deployment/smoke-image.sh`: image build/metadata/runtime/static-site smoke.

## Verification

Commands executed in this environment:

```sh
./deployment/validate-packaging.sh
pnpm --filter @the-table/server build
pnpm --filter @the-table/web build
cd apps/server
CLIENT_ORIGIN=https://table.example.invalid \
  STATIC_DIRECTORY=../../apps/web/dist HOST=127.0.0.1 PORT=43179 \
  node --import tsx src/index.ts
curl --fail http://127.0.0.1:43179/health/live
curl --fail http://127.0.0.1:43179/health/ready
curl --fail http://127.0.0.1:43179/
git diff --check -- Dockerfile .dockerignore .env.example deployment agent/reports/deployment.md
```

The packaging validator, shell syntax checks, server build, and whitespace check
passed. A clean temporary workspace using the pinned pnpm 10.18.1 completed
`CI=true pnpm install --prod --offline --frozen-lockfile`; after pruning, the
image entry command could import `tsx`, `@the-table/game`, and the server module.
The exact entry command also ran locally and returned `{"ok":true}` from both
health routes plus the existing built HTML document from `/`.

The final current-checkout web and server production builds pass. The browser
bundle keeps the Three.js runtime in a lazy 519 kB chunk (136 kB gzip), with the
expected Vite size warning; entry/lobby paths remain in the smaller main chunk.

Docker and Docker Compose were not installed in the local environment, so image
construction, Compose rendering, container health, read-only execution, and the
HTTP smoke probes could not be executed here. Run these on a Docker-capable
machine before promotion:

```sh
./deployment/validate-packaging.sh
./deployment/smoke-image.sh
CLIENT_ORIGIN=https://table.example.invalid docker compose -f deployment/compose.yaml config --quiet
```
