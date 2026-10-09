# syntax=docker/dockerfile:1

# Kairos runs as a single Next.js process against a PostgreSQL database. The
# database is external — Supabase on Vercel, or the `db` service in
# compose.yaml — so nothing about the data lives inside this image.
#
# Build arguments: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY and
# NEXT_PUBLIC_APP_URL are consumed by `next build` (they are inlined into the
# bundle and into the CSP), so they are `ARG`s here, not `ENV`s of the runtime
# image. `docker build --build-arg …`, or `compose.yaml`, which maps them from
# `.env`. Omitting them is a valid build: the sign-in gate then fails closed.

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
# Public configuration. `next build` inlines NEXT_PUBLIC_* into the client
# bundle and the middleware, and next.config.ts compiles the CSP from the
# Supabase origin, so the values must be present here. They stay in this stage:
# the runtime image is configured through compose.yaml's `environment`.
ARG NEXT_PUBLIC_SUPABASE_URL=""
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY=""
ARG NEXT_PUBLIC_APP_URL="http://localhost:3000"
ENV NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL} \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY} \
    NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}
# No database is contacted during the build, but `@/server/db` is evaluated
# while Next collects route data, so give it a valid-looking placeholder.
ENV DATABASE_URL="postgresql://build:build@127.0.0.1:5432/build" \
    DIRECT_URL="postgresql://build:build@127.0.0.1:5432/build"
RUN bunx prisma generate && bunx next build

# ---------------------------------------------------------------------------
# Runtime — no Bun, and nothing beyond the Prisma CLI used for migrations
# ---------------------------------------------------------------------------
FROM node:22-bookworm-slim AS runner
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000

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

RUN chmod +x /usr/local/bin/kairos-entrypoint

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=25s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Migrations are applied before the app starts (see docker/entrypoint.sh).
ENTRYPOINT ["kairos-entrypoint"]
