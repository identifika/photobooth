import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',
  turbopack: {},
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
