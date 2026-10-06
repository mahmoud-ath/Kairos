import type { NextConfig } from "next";

/**
 * Content Security Policy.
 *
 * Everything Kairos needs (fonts included) is served from its own origin, so the
 * policy can stay tight. Next injects small inline bootstrap scripts, and `next
 * dev` additionally needs eval and a websocket for hot reloading. No nonce is
 * used, so `'unsafe-inline'` is required for those inline scripts.
 */
const isDev = process.env.NODE_ENV !== "production";

/**
 * Supabase Auth is talked to directly from the browser, so its origin (and its
 * realtime websocket) has to be reachable. Empty when auth is not configured.
 */
const supabaseOrigin = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, "") ?? "";
const supabaseConnectSrc = supabaseOrigin
  ? [supabaseOrigin, supabaseOrigin.replace(/^http/, "ws")]
  : [];

const connectSrc = [
  "'self'",
  ...(isDev ? ["ws:", "wss:"] : []),
  ...supabaseConnectSrc,
].join(" ");

const contentSecurityPolicy = [
  "default-src 'self'",
  isDev
    ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
    : "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src ${connectSrc}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  // Stop browsers from guessing content types, framing the app, or leaking the
  // current URL to third parties.
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
  // Ignored over plain HTTP; takes effect as soon as the app is served over TLS.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  // Prisma must not be bundled by the Next.js server compiler.
  serverExternalPackages: ["@prisma/client", "prisma"],
  // Do not advertise the framework in every response.
  poweredByHeader: false,
  experimental: {
    // Rewrite barrel imports to the module actually used, so the client does not
    // parse icons and date helpers it never renders.
    optimizePackageImports: ["lucide-react", "date-fns"],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
