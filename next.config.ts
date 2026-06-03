import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverExternalPackages: ["@mediapipe/pose"],
  },
};

export default nextConfig;
