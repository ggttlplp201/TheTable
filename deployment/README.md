# Production packaging

This package runs exactly one authoritative Node process. That process owns all
rooms and Socket.IO connections and serves the built Vite client from the same
origin. The current server is in-memory only: it does **not** implement Redis
snapshots, distributed room leases, or failover ownership.

## Build and run

Docker 24+ with BuildKit and Docker Compose v2 are the reference tools.

```sh
cp .env.example .env
# Edit CLIENT_ORIGIN in .env before continuing.
./deployment/validate-packaging.sh
docker compose --env-file .env -f deployment/compose.yaml build
docker compose --env-file .env -f deployment/compose.yaml up -d
curl --fail http://127.0.0.1:3001/health/live
curl --fail http://127.0.0.1:3001/health/ready
```

The image builds the web client, compile-checks the server, prunes development
dependencies, and then runs the server as the unprivileged `node` user. The
filesystem is read-only in the Compose definition; only a small, non-executable
`/tmp` tmpfs is writable. `STATIC_DIRECTORY` points at the web build so `/` and
client-side routes come from the same process as Socket.IO.

For a full local image check, run `./deployment/smoke-image.sh`. It builds a
temporary-tagged image, confirms its non-root/single-owner metadata, starts one
container, then probes liveness, readiness, and the web entry point. The script
removes only the container it created; it leaves the image for inspection.

## Origin, TLS, and reverse proxy

`CLIENT_ORIGIN` is a comma-separated allowlist used for both browser CORS and
direct WebSocket upgrade checks. Set exact browser origins, for example
`https://table.example.com` or
`https://table.example.com,https://preview.example.com`. Do not add a path or a
trailing slash. A missing/incorrect production value prevents browser clients
from connecting. `VITE_SERVER_URL` is intentionally unset: the packaged client
uses its own public origin.

The container speaks plain HTTP on port 3001. Terminate TLS at a trusted reverse
proxy or load balancer and expose one public HTTPS/WSS origin. The proxy must:

- forward `/socket.io/` to this container and preserve WebSocket `Upgrade` and
  `Connection` semantics;
- proxy `/`, client routes, and health paths to the same container without
  rewriting the Socket.IO path;
- allow long-lived WebSocket connections (an idle timeout of at least 60
  seconds; longer is safer for mobile networks); and
- pass the original `Host` and normal forwarded headers for observability.

The Compose port binds to loopback by default so the reverse proxy is the public
edge. If the proxy runs in another container, replace the host port with an
internal Docker network; do not expose container HTTP directly to the internet.

Example Nginx routing (certificate configuration deliberately omitted):

```nginx
location /socket.io/ {
    proxy_pass http://127.0.0.1:3001;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_read_timeout 300s;
}

location / {
    proxy_pass http://127.0.0.1:3001;
    proxy_set_header Host $host;
}
```

`/health/live` proves the process can answer HTTP. `/health/ready` returns 200
only while the room runtime is ready and should gate traffic. Neither endpoint
proves room durability or verifies a WebSocket round trip.

## Single-owner and restart limits

Run **exactly one replica**. Do not enable autoscaling, rolling overlap,
blue/green overlap, Kubernetes replicas greater than one, process clustering,
or a second host behind a load balancer. Multiple instances would accept the
same room code into independent memory and create split-brain behavior. Sticky
sessions alone do not fix that. The Compose file sets `replicas: 1` and a fixed
container name so an attempted `--scale authority=2` fails instead of appearing
to work; the image carries equivalent single-owner labels checked by the smoke
script.

A restart, crash, host replacement, or deployment loses every active room,
reconnect credential, timer, message, and idempotency receipt. The restart policy
restores service availability only; it does not recover matches. Deployments are
therefore disruptive and should happen during a drained maintenance window.
There is no safe zero-downtime rolling deployment in this version.

Horizontal scale becomes valid only after implementing and testing durable room
snapshots, atomic/distributed room ownership, transfer/fencing, recovery of
deadlines and idempotency receipts, and an appropriate routing strategy. Redis
is an architectural direction, not a capability of this image today.

## Environment reference

| Variable | Required | Meaning |
| --- | --- | --- |
| `CLIENT_ORIGIN` | yes | Exact comma-separated browser origin allowlist. |
| `VOICE_ENABLED` | no | `true` enables opt-in microphone/WebRTC voice; default `false`. |
| `VOICE_ICE_SERVERS` | no | JSON array of validated STUN/TURN entries passed only to authenticated room clients; default `[]`. |
| `TABLE_PORT` | no | Loopback host port used by Compose; default `3001`. |
| `HOST` | image default | Container bind address; keep `0.0.0.0`. |
| `PORT` | image default | Internal HTTP/Socket.IO port; default `3001`. |
| `STATIC_DIRECTORY` | image default | Built client directory; `/app/apps/web/dist`. |

Secrets do not belong in the image or `.env.example`. At present the server has
no database credentials because it has no production persistence adapter.

## Voice connectivity

Voice is an opt-in WebRTC mesh for the two to four players at a table. Media is
encrypted by WebRTC and travels peer-to-peer; the server authorizes presence and
forwards negotiation messages but does not receive audio. Microphone capture
requires the public site to use HTTPS (localhost is the normal development
exception).

Set `VOICE_ENABLED=true` only after deciding the expected connectivity level.
With an empty `VOICE_ICE_SERVERS`, browsers can try host/direct candidates and
the client prominently reports that no relay is available. That mode can fail
between mobile networks, corporate firewalls, or symmetric NATs while text chat
continues to work. Reliable production connectivity normally needs operator-
supplied TURN service credentials; no vendor or paid service is hardcoded.

`VOICE_ICE_SERVERS` is a JSON array in the standard browser shape. URLs must use
`stun:`, `stuns:`, `turn:`, or `turns:`. TURN entries require both `username` and
`credential`; malformed configuration fails server startup rather than silently
weakening voice. Example (replace every host and credential):

```dotenv
VOICE_ENABLED=true
VOICE_ICE_SERVERS=[{"urls":"stun:stun.example.net:3478"},{"urls":["turn:relay.example.net:3478?transport=udp","turns:relay.example.net:5349?transport=tcp"],"username":"short-lived-user","credential":"short-lived-secret"}]
```

TURN credentials are necessarily delivered to authenticated browser clients.
Use scoped, short-lived credentials where the selected TURN service supports
them, rotate them operationally, and never bake them into the image or source.
