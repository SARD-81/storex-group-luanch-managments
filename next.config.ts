import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingExcludes: {
    "/*": [
      "./.env*",
      "./.automation-spool/**/*",
      "./verification-output/**/*",
      "./upload/**/*",
    ],
  },
  experimental: { serverActions: { bodySizeLimit: "3mb" } },
};

export default nextConfig;
