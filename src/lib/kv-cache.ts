/**
 * Cloudflare KV Cache wrapper
 * Provides a simple interface for caching API responses in Cloudflare KV
 */

// Store runtime env with KV binding (set by API routes)
let runtimeEnvWithKV: Record<string, any> | null = null;

export function setRuntimeKVEnv(env: Record<string, any>): void {
  runtimeEnvWithKV = env;
}

/**
 * Get the KV namespace from runtime env
 */
function getKVNamespace(): KVNamespace | null {
  // First check runtime env injected by API route
  if (runtimeEnvWithKV?.NOTION_CACHE) {
    return runtimeEnvWithKV.NOTION_CACHE;
  }

  // Fallback: try globalThis (for local dev with wrangler)
  if (typeof globalThis !== 'undefined') {
    const runtime = (globalThis as any).Astro?.runtime;
    if (runtime?.env?.NOTION_CACHE) {
      return runtime.env.NOTION_CACHE;
    }
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
export async function kvGet<T>(key: string): Promise<{ data: T | null; error?: string }> {
  const kv = getKVNamespace();
  if (!kv) return { data: null, error: 'KV namespace not available' };

  try {
    const data = await kv.get(key, 'json');
    if (!data) return { data: null };

    // Revive Date objects in the cached data
    const revived = reviveDates(data);
    return { data: revived as T };
  } catch (error) {
    console.error(`KV get error for key ${key}:`, error);
    return { data: null, error: String(error) };
  }
}

/**
 * Recursively convert date strings back to Date objects
 */
function reviveDates(obj: any): any {
  if (obj === null || obj === undefined) return obj;

  if (Array.isArray(obj)) {
    return obj.map(reviveDates);
  }

  if (typeof obj === 'object') {
    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      if (key === 'date' && typeof value === 'string') {
        result[key] = new Date(value);
      } else if (typeof value === 'object' && value !== null) {
        result[key] = reviveDates(value);
      } else {
        result[key] = value;
      }
    }
    return result;
  }

  return obj;
}

/**
 * Set data in KV with TTL (in seconds)
 */
export async function kvSet<T>(key: string, value: T, ttlSeconds: number): Promise<{ success: boolean; error?: string }> {
  const kv = getKVNamespace();
  if (!kv) return { success: false, error: 'KV namespace not available' };

  try {
    await kv.put(key, JSON.stringify(value), {
      expirationTtl: ttlSeconds,
    });
    return { success: true };
  } catch (error) {
    console.error(`KV set error for key ${key}:`, error);
    return { success: false, error: String(error) };
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
  // Check if KV is available
  if (!isKVAvailable()) {
    return fetcher();
  }

  // Try to get from KV cache first
  const { data: cached } = await kvGet<T>(key);
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
