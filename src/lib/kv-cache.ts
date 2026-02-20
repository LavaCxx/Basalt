/**
 * Cloudflare KV Cache wrapper
 * Provides a simple interface for caching API responses in Cloudflare KV
 */

/**
 * Get the KV namespace from Astro runtime
 */
function getKVNamespace(): KVNamespace | null {
  // Astro Cloudflare adapter makes bindings available via globalThis
  if (typeof globalThis !== 'undefined') {
    const runtime = (globalThis as any).Astro?.runtime;
    if (runtime?.env?.NOTION_CACHE) {
      return runtime.env.NOTION_CACHE;
    }
    // Fallback: direct binding on globalThis
    if ((globalThis as any).NOTION_CACHE) {
      return (globalThis as any).NOTION_CACHE;
    }
  }
  return null;
}

/**
 * Check if KV is available
 */
export function isKVAvailable(): boolean {
  return getKVNamespace() !== null;
}

/**
 * Get cached data from KV
 */
export async function kvGet<T>(key: string): Promise<T | null> {
  const kv = getKVNamespace();
  if (!kv) return null;

  try {
    const data = await kv.get(key, 'json');
    return data as T | null;
  } catch (error) {
    console.error(`KV get error for key ${key}:`, error);
    return null;
  }
}

/**
 * Set data in KV with TTL (in seconds)
 */
export async function kvSet<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
  const kv = getKVNamespace();
  if (!kv) return;

  try {
    await kv.put(key, JSON.stringify(value), {
      expirationTtl: ttlSeconds,
    });
  } catch (error) {
    console.error(`KV set error for key ${key}:`, error);
  }
}

/**
 * Delete a key from KV
 */
export async function kvDelete(key: string): Promise<void> {
  const kv = getKVNamespace();
  if (!kv) return;

  try {
    await kv.delete(key);
  } catch (error) {
    console.error(`KV delete error for key ${key}:`, error);
  }
}

/**
 * Cache wrapper: get from cache or fetch and cache
 */
export async function withKVCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlSeconds: number = 3600 // Default 1 hour
): Promise<T> {
  // Try to get from KV cache first
  const cached = await kvGet<T>(key);
  if (cached !== null) {
    console.log(`KV cache hit: ${key}`);
    return cached;
  }

  // Cache miss - fetch fresh data
  console.log(`KV cache miss: ${key}, fetching...`);
  const data = await fetcher();

  // Store in KV (async, don't wait)
  kvSet(key, data, ttlSeconds).catch((err) => {
    console.error(`Failed to cache ${key}:`, err);
  });

  return data;
}
