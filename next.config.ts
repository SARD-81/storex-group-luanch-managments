import type { NextConfig } from "next";

// Opt-in only for a trusted local network hostname. Never allow all origins.
const allowedDevOrigins = (process.env.STOREX_DEV_ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((host) => host.trim())
  .filter((host) => /^[a-zA-Z0-9.-]+$/.test(host) && host.length <= 253);

const nextConfig: NextConfig = {
  ...(process.env.NODE_ENV === "development" && allowedDevOrigins.length
    ? { allowedDevOrigins }
    : {}),
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
