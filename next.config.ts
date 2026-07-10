import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Keep the client Router Cache so revisiting a page within the window is
    // instant (no server round-trip). Freshness is handled by the client
    // useAutoRefresh hooks (focus + timer) on the live surfaces.
    staleTimes: { dynamic: 60, static: 300 },
    // Tree-shake big barrel packages so each page ships only the icons/helpers
    // it actually uses — meaningful JS reduction across the whole app.
    optimizePackageImports: ["lucide-react", "date-fns"],
  },
};

export default nextConfig;
