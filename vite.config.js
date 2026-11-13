import { defineConfig } from 'vite';

export default defineConfig({
  root: './',
  publicDir: 'public',
  server: {
    port: 3005,
    open: false,
    proxy: {
      '/ws': {
        target: 'ws://localhost:3006',
        ws: true
      }
    }
  },
  build: {
    assetsInlineLimit: 0,
    outDir: 'dist'
  }
});

