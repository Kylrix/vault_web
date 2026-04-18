import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';
import { devtools } from '@tanstack/devtools-vite';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import viteReact from '@vitejs/plugin-react';
import { nitro } from 'nitro/vite';

export default defineConfig({
  build: { sourcemap: true },
  server: { sourcemapIgnoreList: false },
  resolve: {
    alias: {
      'next/navigation': fileURLToPath(new URL('./src/compat/next-navigation.ts', import.meta.url)),
      'next/link': fileURLToPath(new URL('./src/compat/next-link.tsx', import.meta.url)),
      'next/image': fileURLToPath(new URL('./src/compat/next-image.tsx', import.meta.url)),
      'next/dynamic': fileURLToPath(new URL('./src/compat/next-dynamic.tsx', import.meta.url)),
      'tiny-secp256k1': fileURLToPath(new URL('./src/compat/tiny-secp256k1.ts', import.meta.url)),
    },
    tsconfigPaths: true,
  },
  plugins: [
    devtools(),
    nitro({ rollupConfig: { external: [/^@sentry\//] } }),
    tanstackStart(),
    viteReact(),
  ],
});
