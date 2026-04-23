import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /** Pin workspace root when multiple lockfiles exist (e.g. under the user home directory). */
  turbopack: {
    root: path.resolve(process.cwd()),
  },
};

export default nextConfig;
