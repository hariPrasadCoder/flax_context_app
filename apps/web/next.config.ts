import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  output: "standalone",
  experimental: {
    // Needed for pnpm monorepo — traces dependencies from the workspace root
    outputFileTracingRoot: path.join(__dirname, "../../"),
  },
};

export default nextConfig;
