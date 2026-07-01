import type { FrameConfig } from './frame-types';

/**
 * Rewrites a raw MinIO URL to the configured CDN URL, if applicable.
 */
export function applyCdnToUrl(url?: string): string | undefined {
  if (!url) return url;
  
  const cdnUrl = process.env.NEXT_PUBLIC_CDN_URL;
  const minioEndpoint = process.env.NEXT_PUBLIC_MINIO_ENDPOINT;
  
  if (cdnUrl && minioEndpoint && url.includes(minioEndpoint)) {
    try {
      const parsedUrl = new URL(url);
      if (parsedUrl.hostname === minioEndpoint) {
         // Replace the origin (e.g., https://minio...app) with CDN URL
         const safeCdn = cdnUrl.replace(/\/$/, '');
         return url.replace(parsedUrl.origin, safeCdn);
      }
    } catch {
      // Ignore invalid URLs
    }
  }
  return url;
}

/**
 * Recursively rewrites URLs in a FrameConfig object.
 */
export function applyCdnToFrameConfig(config?: FrameConfig): FrameConfig | undefined {
  if (!config) return config;
  
  const newConfig = { ...config };
  
  // Rewrite legacy background.src if it exists
  if (newConfig.background && typeof newConfig.background === 'object' && 'src' in newConfig.background) {
    newConfig.background = {
      ...newConfig.background,
      src: applyCdnToUrl((newConfig.background as any).src),
    };
  }

  // Rewrite modern bgImage
  if (newConfig.bgImage) {
    newConfig.bgImage = applyCdnToUrl(newConfig.bgImage);
  }
  
  if (Array.isArray(newConfig.elements)) {
    newConfig.elements = newConfig.elements.map((el) => {
      if (el.type === 'image' && el.src) {
        return {
          ...el,
          src: applyCdnToUrl(el.src) || el.src,
        };
      }
      return el;
    });
  }
  
  return newConfig;
}
