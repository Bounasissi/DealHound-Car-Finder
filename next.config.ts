import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allows CI/review builds to avoid racing an active local Next dev server.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
};

export default nextConfig;
