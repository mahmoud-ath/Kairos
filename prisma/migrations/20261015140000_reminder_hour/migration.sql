-- ===========================================================================
-- Per-account reminder hour.
--
-- The daily reminder is one shared job, so the hour an account wants is matched
-- against that account's own clock instead of running a job per account.
--
-- Purely additive: one column with a default, so every existing account keeps the
-- 01:00 behaviour it already had.
-- ===========================================================================

-- AlterTable
ALTER TABLE "Settings" ADD COLUMN "reminderHour" INTEGER NOT NULL DEFAULT 1;
