import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const nextConfig: NextConfig = {
  experimental: {
    // Uploads can be large; proxy must not truncate the body.
    proxyClientMaxBodySize: "100mb",
  },
};

export default nextConfig;

initOpenNextCloudflareForDev();
