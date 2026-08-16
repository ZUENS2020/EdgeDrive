import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["localhost", "127.0.0.1"],
  transpilePackages: [
    "@refinedev/core",
    "@refinedev/mui",
    "@refinedev/nextjs-router",
    "@refinedev/simple-rest",
  ],
};

export default nextConfig;

initOpenNextCloudflareForDev();
