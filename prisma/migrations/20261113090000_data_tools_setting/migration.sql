-- ===========================================================================
-- Header task export/import tools.
--
-- Off by default: the top bar only shows the JSON export/import controls when
-- the account asked for them, so nobody gets a control they never use.
--
-- Purely additive: one boolean with a default, so every existing account keeps
-- the top bar it already has.
-- ===========================================================================

-- AlterTable
ALTER TABLE "Settings" ADD COLUMN "dataToolsEnabled" BOOLEAN NOT NULL DEFAULT false;
