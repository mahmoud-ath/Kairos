-- Runs once, when the Compose `db` volume is first created.
--
-- The Playwright suite drops and recreates its schema against a throw-away
-- database, so it needs one of its own (see playwright.config.ts).
CREATE DATABASE kairos_e2e;
