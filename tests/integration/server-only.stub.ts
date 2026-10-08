/**
 * Stub for the `server-only` package.
 *
 * `server-only` exists to make a client import fail at build time: outside the
 * `react-server` condition its entry point throws. The integration tests run the
 * server services directly in Node (no React runtime), so it is aliased to this
 * empty module in `vitest.integration.config.ts`.
 */
export {};
