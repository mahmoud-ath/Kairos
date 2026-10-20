-- Rate-limit counters, so per-account limits are shared across instances.
--
-- One row per (bucket, identifier). The row is written with an atomic
-- INSERT … ON CONFLICT DO UPDATE in server/rate-limit.ts, so two overlapping
-- requests cannot both read "count = 59" and both let the 60th through.
--
-- Global table, no user column: see the model comment in prisma/schema.prisma.

-- CreateTable
CREATE TABLE "RateLimitCounter" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "resetAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateLimitCounter_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "RateLimitCounter_resetAt_idx" ON "RateLimitCounter"("resetAt");
