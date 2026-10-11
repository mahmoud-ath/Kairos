-- ===========================================================================
-- Text size.
--
-- The interface is sized entirely in rem, so the root font size scales all of
-- it together. This stores the chosen scale; the default (112.5%, i.e. 18px)
-- is the value the CSS already used, so existing rows are unchanged.
-- ===========================================================================

-- AlterTable
ALTER TABLE "Settings"
    ADD COLUMN "fontScale" TEXT NOT NULL DEFAULT 'default';
