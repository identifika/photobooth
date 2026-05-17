import type { NextConfig } from "next";

const isTauri = process.env.TAURI_ENV === '1';

const nextConfig: NextConfig = {
  ...(isTauri ? { output: 'export' } : {}),
  turbopack: {},
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
