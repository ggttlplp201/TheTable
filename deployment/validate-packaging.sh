#!/bin/sh
set -eu

repo_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
failures=0

pass() {
  printf 'ok - %s\n' "$1"
}

fail() {
  printf 'not ok - %s\n' "$1" >&2
  failures=$((failures + 1))
}

require_text() {
  pattern=$1
  file=$2
  description=$3
  if grep -Eq "$pattern" "$repo_dir/$file"; then
    pass "$description"
  else
    fail "$description ($file)"
  fi
}

require_text '^USER node$' Dockerfile 'image runs as the non-root node user'
require_text '^ENV CI=true$' Dockerfile 'pnpm production prune is non-interactive'
require_text '^HEALTHCHECK ' Dockerfile 'image declares a readiness health check'
require_text 'STATIC_DIRECTORY=/app/apps/web/dist' Dockerfile 'image serves the built web client'
require_text '^WORKDIR /app/apps/server$' Dockerfile 'entry point resolves server production dependencies'
require_text 'io\.the-table\.authority-mode="single-owner-only"' Dockerfile 'image declares single-owner authority'
require_text 'io\.the-table\.max-replicas="1"' Dockerfile 'image declares a maximum of one replica'
require_text '^[[:space:]]+container_name: the-table-authority$' deployment/compose.yaml 'Compose rejects horizontal scaling'
require_text '^[[:space:]]+replicas: 1$' deployment/compose.yaml 'Compose documents one replica'
require_text '^[[:space:]]+read_only: true$' deployment/compose.yaml 'Compose uses a read-only root filesystem'
require_text 'CLIENT_ORIGIN:.*\$\{CLIENT_ORIGIN:\?' deployment/compose.yaml 'Compose requires an explicit client origin'
require_text '^CLIENT_ORIGIN=https://' .env.example 'example origin uses TLS'

if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
  if CLIENT_ORIGIN=https://table.example.invalid docker compose \
      -f "$repo_dir/deployment/compose.yaml" config --quiet; then
    pass 'Docker Compose accepts the deployment definition'
  else
    fail 'Docker Compose rejects the deployment definition'
  fi
else
  printf 'skip - Docker Compose is unavailable; static checks only\n'
fi

if [ "$failures" -ne 0 ]; then
  printf '%s packaging validation check(s) failed\n' "$failures" >&2
  exit 1
fi
