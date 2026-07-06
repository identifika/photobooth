import type { NextConfig } from "next";
import { readFileSync } from "fs";

const isTauri = process.env.TAURI_ENV === '1';
const isStatic = process.env.STATIC_EXPORT === '1';
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

const nextConfig: NextConfig = {
  ...((isTauri || isStatic) ? { output: 'export' } : {}),
  ...(basePath ? { basePath, assetPrefix: basePath } : {}),
  // @ts-ignore - added to allow cross-origin dev testing from other devices on the same network
  ...(process.env.DEV_ORIGINS ? { allowedDevOrigins: process.env.DEV_ORIGINS.split(',') } : {}),
  turbopack: {},
  images: {
    unoptimized: true,
  },
  env: {
    NEXT_PUBLIC_APP_VERSION: process.env.npm_package_version || (() => {
      try {
        return JSON.parse(readFileSync('./package.json', 'utf8')).version;
      } catch {
        return '1.0.0';
      }
    })(),
  },
  // Rewrites removed — using /api/turn-credentials server route instead
  // (rewrites don't work in static export mode for Tauri/Capacitor)
};

export default nextConfig;
