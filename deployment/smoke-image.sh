#!/bin/sh
set -eu

repo_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
image=${IMAGE_NAME:-the-table:smoke}
container="the-table-smoke-$$"

if ! command -v docker >/dev/null 2>&1; then
  printf 'docker is required for the image smoke test\n' >&2
  exit 127
fi

cleanup() {
  docker rm -f "$container" >/dev/null 2>&1 || true
}
trap cleanup EXIT HUP INT TERM

docker build --tag "$image" "$repo_dir"

user=$(docker image inspect --format '{{.Config.User}}' "$image")
[ "$user" = node ] || {
  printf 'expected image user node, got %s\n' "$user" >&2
  exit 1
}

mode=$(docker image inspect --format '{{index .Config.Labels "io.the-table.authority-mode"}}' "$image")
replicas=$(docker image inspect --format '{{index .Config.Labels "io.the-table.max-replicas"}}' "$image")
[ "$mode" = single-owner-only ] && [ "$replicas" = 1 ] || {
  printf 'image does not declare the required single-owner topology\n' >&2
  exit 1
}

docker run --detach --name "$container" \
  --read-only --tmpfs /tmp:rw,noexec,nosuid,size=64m \
  --env CLIENT_ORIGIN=https://table.example.invalid \
  --publish 127.0.0.1::3001 "$image" >/dev/null

host_port=$(docker port "$container" 3001/tcp | sed -n 's/.*://p' | head -n 1)
[ -n "$host_port" ] || {
  printf 'could not determine the published smoke-test port\n' >&2
  exit 1
}

attempt=0
while [ "$attempt" -lt 30 ]; do
  if curl --silent --show-error --fail \
      "http://127.0.0.1:$host_port/health/ready" >/dev/null 2>&1; then
    break
  fi
  attempt=$((attempt + 1))
  sleep 1
done

if [ "$attempt" -eq 30 ]; then
  docker logs "$container" >&2
  printf 'server did not become ready\n' >&2
  exit 1
fi

curl --silent --show-error --fail \
  "http://127.0.0.1:$host_port/health/live" | grep -Eq '"ok"[[:space:]]*:[[:space:]]*true'
curl --silent --show-error --fail \
  "http://127.0.0.1:$host_port/health/ready" | grep -Eq '"ok"[[:space:]]*:[[:space:]]*true'
curl --silent --show-error --fail \
  "http://127.0.0.1:$host_port/" | grep -Eqi '<!doctype html>|<html'

printf 'image smoke test passed on 127.0.0.1:%s (%s)\n' "$host_port" "$image"
