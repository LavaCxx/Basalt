/**
 * Environment variable handling for multiple runtimes
 * Supports: Cloudflare Workers, Node.js, Astro/Vite
 */

/**
 * Runtime environment variables injected from Cloudflare Workers
 * This is set by API routes before calling data fetchers
 */
let runtimeEnv: Record<string, string> | null = null;

/**
 * Set runtime environment variables (called from API routes)
 */
export function setRuntimeEnv(env: Record<string, any>) {
  runtimeEnv = {};
  for (const [key, value] of Object.entries(env)) {
    if (typeof value === 'string') {
      runtimeEnv[key] = value;
    }
  }
}

/**
 * Get environment variable (works in Astro, Node, and Cloudflare contexts)
 * Priority:
 * 1. Cloudflare Workers: runtimeEnv (injected via setRuntimeEnv)
 * 2. Astro/Vite: import.meta.env
 * 3. Node.js: process.env
 */
export const getEnv = (key: string): string | undefined => {
  // First, try runtime env (Cloudflare Workers, set by API route)
  if (runtimeEnv?.[key]) {
    return runtimeEnv[key];
  }

  // Try import.meta.env (Astro/Vite)
  if ((import.meta as any).env?.[key]) {
    return (import.meta as any).env[key];
  }

  // Try process.env (Node.js)
  if (typeof process !== 'undefined' && process.env?.[key]) {
    return process.env[key];
  }

  return undefined;
};
