import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.100.1", "localhost", "127.0.0.1"],
};

export default nextConfig;

initOpenNextCloudflareForDev();
