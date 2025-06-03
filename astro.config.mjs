// @ts-check
import { defineConfig } from 'astro/config';
import solid from '@astrojs/solid-js';
import tailwind from '@astrojs/tailwind';
import node from '@astrojs/node';

// https://astro.build/config
export default defineConfig({
  integrations: [solid(), tailwind()],
  output: 'server',
  adapter: node({
    mode: 'standalone'
  })
});
