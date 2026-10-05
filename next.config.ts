import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Prisma must not be bundled by the Next.js server compiler.
  serverExternalPackages: ["@prisma/client", "prisma"],
};

export default nextConfig;
