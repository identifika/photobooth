import type { NextConfig } from "next";

const isTauri = process.env.TAURI_ENV === '1';
const isStatic = process.env.STATIC_EXPORT === '1';
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

const nextConfig: NextConfig = {
  ...((isTauri || isStatic) ? { output: 'export' } : {}),
  ...(basePath ? { basePath, assetPrefix: basePath } : {}),
  // @ts-ignore - added to allow cross-origin dev testing from other devices on the same network
  allowedDevOrigins: ['192.168.0.186', '4d52-103-156-227-0.ngrok-free.app', '37a9-103-19-231-198.ngrok-free.app', '0605-103-19-231-198.ngrok-free.app'],
  turbopack: {},
  images: {
    unoptimized: true,
  },
  env: {
    NEXT_PUBLIC_APP_VERSION: process.env.npm_package_version || require('./package.json').version,
  },
  // Rewrites removed — using /api/turn-credentials server route instead
  // (rewrites don't work in static export mode for Tauri/Capacitor)
};

export default nextConfig;
