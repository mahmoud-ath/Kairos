# syntax=docker/dockerfile:1

# Kairos runs as a single Next.js process with one SQLite database on a
# persistent volume. One instance only — do not scale this service horizontally.

# ---------------------------------------------------------------------------
# Build base: Node 22 + Bun (install/scripts) + openssl for the Prisma engines
# ---------------------------------------------------------------------------
FROM node:22-bookworm-slim AS build-base
ENV NEXT_TELEMETRY_DISABLED=1 \
    BUN_INSTALL=/root/.bun \
    PATH=/root/.bun/bin:$PATH

RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates curl unzip \
    && rm -rf /var/lib/apt/lists/* \
    && curl -fsSL https://bun.sh/install | bash \
    && bun --version

# ---------------------------------------------------------------------------
# Dependencies — installed from the committed lockfile
# ---------------------------------------------------------------------------
FROM build-base AS deps
WORKDIR /app
COPY package.json bun.lock ./
# The schema is needed because `bun install` runs `prisma generate`.
COPY prisma ./prisma
RUN bun install --frozen-lockfile

# ---------------------------------------------------------------------------
# Build — Prisma client + Next.js production build
# ---------------------------------------------------------------------------
FROM build-base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# The database is only needed at runtime; point the build at a throw-away path.
ENV DATABASE_URL="file:/tmp/kairos-build.db"
RUN bunx prisma generate && bunx next build

# ---------------------------------------------------------------------------
# Runtime — no Bun, and nothing beyond the Prisma CLI used for migrations
# ---------------------------------------------------------------------------
FROM node:22-bookworm-slim AS runner
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    DATABASE_URL="file:/data/kairos.db"

RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/public ./public
COPY docker/entrypoint.sh /usr/local/bin/kairos-entrypoint

# /data holds the SQLite database and must be writable by the runtime user.
RUN chmod +x /usr/local/bin/kairos-entrypoint \
    && mkdir -p /data \
    && chown -R node:node /data

USER node

# The SQLite database always lives on this volume.
VOLUME ["/data"]

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=25s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Migrations are applied before the app starts (see docker/entrypoint.sh).
ENTRYPOINT ["kairos-entrypoint"]
