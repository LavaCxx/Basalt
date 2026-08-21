// @ts-check
import { defineConfig } from 'astro/config';

import solidJs from '@astrojs/solid-js';
import tailwindcss from '@tailwindcss/vite';
import cloudflare from '@astrojs/cloudflare';

// https://astro.build/config
export default defineConfig({
  integrations: [solidJs()],
  output: 'server',
  adapter: cloudflare({
    platformProxy: {
      enabled: true,
      persist: { path: '.wrangler/state/v3' }
    }
  }),
  vite: {
    plugins: [tailwindcss()]
  }
});
