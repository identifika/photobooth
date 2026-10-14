export interface CacheHit<T> {
  value: T;
  state: 'fresh' | 'stale';
}

interface Entry<T> {
  value: T;
  expiresAt: number;
  staleUntil: number;
}

/**
 * LRU cache with a fresh window and a stale-while-revalidate tail.
 * Map insertion order is the LRU order: oldest key is first.
 */
export class TtlCache<T> {
  private readonly map = new Map<string, Entry<T>>();

  constructor(private readonly maxEntries: number) {}

  get size(): number {
    return this.map.size;
  }

  get(key: string): CacheHit<T> | null {
    const entry = this.map.get(key);
    if (!entry) return null;
    const now = Date.now();
    if (now >= entry.staleUntil) {
      this.map.delete(key);
      return null;
    }
    this.map.delete(key);
    this.map.set(key, entry);
    return {
      value: entry.value,
      state: now < entry.expiresAt ? 'fresh' : 'stale',
    };
  }

  set(key: string, value: T, ttlMs: number, swrMs: number): void {
    if (this.map.has(key)) this.map.delete(key);
    const now = Date.now();
    this.map.set(key, {
      value,
      expiresAt: now + Math.max(0, ttlMs),
      staleUntil: now + Math.max(0, ttlMs) + Math.max(0, swrMs),
    });
    while (this.map.size > this.maxEntries) {
      const oldest = this.map.keys().next().value;
      if (oldest === undefined) break;
      this.map.delete(oldest);
    }
  }

  delete(key: string): void {
    this.map.delete(key);
  }

  deletePrefix(prefix: string): number {
    let removed = 0;
    for (const key of this.map.keys()) {
      if (key.startsWith(prefix)) {
        this.map.delete(key);
        removed += 1;
      }
    }
    return removed;
  }

  clear(): void {
    this.map.clear();
  }
}

/** Collapses identical in-flight work onto one promise. */
export class SingleFlight {
  private readonly inflight = new Map<string, Promise<unknown>>();

  get size(): number {
    return this.inflight.size;
  }

  async do<T>(key: string, fn: () => Promise<T>, onJoin?: () => void): Promise<T> {
    const existing = this.inflight.get(key);
    if (existing) {
      onJoin?.();
      return existing as Promise<T>;
    }
    const pending = fn().finally(() => {
      this.inflight.delete(key);
    });
    this.inflight.set(key, pending);
    return pending;
  }
}

export const metrics = {
  hits: 0,
  misses: 0,
  stale: 0,
  coalesced: 0,
  bypass: 0,
  negative: 0,
  upstreamErrors: 0,
  aiProviderCalls: 0,
  aiCacheHits: 0,
};
