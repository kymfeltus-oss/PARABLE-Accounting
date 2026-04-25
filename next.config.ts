import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

/** Directory that contains this config file (the real app root). */
const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  /**
   * Next infers workspace root from lockfiles. A `package-lock.json` higher up
   * (e.g. under the user profile) makes Next treat the wrong folder as root,
   * which can drop App Router output and cause production 404s on Vercel.
   */
  outputFileTracingRoot: projectRoot,
  turbopack: {
    root: projectRoot,
  },
};

export default nextConfig;
