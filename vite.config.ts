import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { crx } from '@crxjs/vite-plugin';
import { resolve } from 'path';
import manifest from './src/manifest.json';

export default defineConfig({
  root: 'src',
  plugins: [
    preact(),
    crx({ manifest }),
  ],
  define: {
    'process.env': '{}',
    'process.platform': '""',
    'process.version': '""',
  },
  server: {
    port: 5173,
    strictPort: true,
    hmr: {
      port: 5173,
    },
    headers: {
      'Access-Control-Allow-Origin': '*',
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@shared': resolve(__dirname, 'src/shared'),
      '@background': resolve(__dirname, 'src/background'),
      '@popup': resolve(__dirname, 'src/popup'),
      '@options': resolve(__dirname, 'src/options'),
      // Preact compatibility
      'react': 'preact/compat',
      'react-dom': 'preact/compat',
    },
  },
  build: {
    outDir: resolve(__dirname, 'dist'),
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'src/popup/index.html'),
        options: resolve(__dirname, 'src/options/index.html'),
      },
    },
  },
  // @ts-expect-error - Vitest config is not part of Vite types but is valid
  test: {
    globals: true,
    environment: 'jsdom',
    root: resolve(__dirname),
    include: ['tests/**/*.{test,spec}.?(c|m)[jt]s?(x)'],
  },
});

