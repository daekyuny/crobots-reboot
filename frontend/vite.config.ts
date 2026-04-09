import { defineConfig } from 'vite'

export default defineConfig({
  base: '/crobots-reboot/',
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    }
  },
  build: {
    target: 'esnext',
    rollupOptions: {
      external: ['/engine.js'],
    },
  },
  worker: {
    rollupOptions: {
      external: ['/engine.js'],
    },
  },
  optimizeDeps: { exclude: ['engine'] }
})
