import type { NextConfig } from "next";
import path from "path";

const isProd = process.env.NODE_ENV === "production";

const nextConfig: NextConfig = {
  ...(isProd && {
    output: "standalone",
    outputFileTracingRoot: path.join(__dirname, "../../"),
  }),
};

export default nextConfig;
