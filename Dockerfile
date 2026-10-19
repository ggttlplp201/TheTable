# syntax=docker/dockerfile:1.7

FROM node:22.20.0-bookworm-slim AS build

ENV CI=true
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.18.1 --activate

# Copy manifests first so dependency installation remains cacheable.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/server/package.json apps/server/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/audio/package.json packages/audio/package.json
COPY packages/content/package.json packages/content/package.json
COPY packages/game/package.json packages/game/package.json
COPY packages/visual/package.json packages/visual/package.json

RUN --mount=type=cache,target=/pnpm/store \
    pnpm install --frozen-lockfile

COPY apps ./apps
COPY packages ./packages

# The server intentionally executes workspace TypeScript through its production
# tsx dependency; compile it here as a build-time correctness check. The web
# bundle is served by that same process in the final image.
RUN pnpm --filter @the-table/server build \
    && pnpm --filter @the-table/web build \
    && pnpm install --prod --offline --frozen-lockfile

FROM node:22.20.0-bookworm-slim AS runtime

LABEL org.opencontainers.image.title="The Table" \
      org.opencontainers.image.description="Single-owner realtime server and web client" \
      io.the-table.authority-mode="single-owner-only" \
      io.the-table.max-replicas="1"

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3001 \
    STATIC_DIRECTORY=/app/apps/web/dist

# Preserve the workspace links created by pnpm. The install was pruned to
# production dependencies in the build stage.
COPY --chown=node:node --from=build /app /app

WORKDIR /app/apps/server

USER node

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + process.env.PORT + '/health/ready').then(r => { if (!r.ok) process.exit(1) }).catch(() => process.exit(1))"

CMD ["node", "--import", "tsx", "src/index.ts"]
