import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Don't reuse cached RSC payloads for dynamic (auth-gated) pages, so every
    // navigation re-renders with fresh DB data. Static marketing/legal pages
    // keep their default caching.
    staleTimes: { dynamic: 0 },
  },
};

export default nextConfig;
