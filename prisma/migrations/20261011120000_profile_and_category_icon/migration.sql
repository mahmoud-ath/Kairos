-- ===========================================================================
-- Profiles and category icons.
--
-- Additive and non-destructive: every column has a default, so existing rows
-- keep working and no backfill is needed.
--
--   Settings.nickname  – how the account is greeted ("Welcome back, …").
--                        NULL means "not chosen yet".
--   Settings.avatarId  – the chosen avatar. Avatars beyond the two free ones
--                        are unlocked by completing tasks; the catalog lives in
--                        src/lib/avatars.ts.
--   Category.icon      – a Lucide icon name (see src/lib/category-icons.ts).
-- ===========================================================================

-- AlterTable
ALTER TABLE "Settings"
    ADD COLUMN "nickname" TEXT,
    ADD COLUMN "avatarId" TEXT NOT NULL DEFAULT 'spark';

-- AlterTable
ALTER TABLE "Category"
    ADD COLUMN "icon" TEXT NOT NULL DEFAULT 'Folder';
