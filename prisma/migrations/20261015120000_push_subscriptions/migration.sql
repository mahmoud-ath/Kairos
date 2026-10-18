-- ===========================================================================
-- Web Push subscriptions.
--
-- One row per device that switched the daily reminder on: the push service
-- endpoint plus the two keys the browser issued, which is everything needed to
-- encrypt and deliver a notification to that device.
--
-- Purely additive: a new table, and no existing row is read or rewritten.
-- ===========================================================================

-- CreateTable
CREATE TABLE "PushSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSentDate" TEXT,

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
-- Global uniqueness is deliberate: a browser profile holds one subscription per
-- VAPID key, so a device that changes account must move the existing row instead
-- of adding a second one for the same endpoint.
CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");

-- CreateIndex
-- Every query is filtered by owner (the scoping layer injects it), and the daily
-- job reads the table in full, so no further index is needed.
CREATE INDEX "PushSubscription_userId_idx" ON "PushSubscription"("userId");
