import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

/**
 * Where the backend is, from the launcher that started it.
 *
 * Read here and nowhere else: the browser talks to this dev server's own origin, so the app never
 * learns a port and never crosses an origin. Not a `VITE_` name, because nothing in the bundle
 * should be able to see it.
 */
const backendUrl = process.env['TODO_BOARD_API_URL'];

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    // Same origin as the page, so the same-origin policy has nothing to object to. In production
    // whatever serves the built app plays this part.
    proxy: backendUrl
      ? {
          '/api': {
            target: backendUrl,
            changeOrigin: true,
            rewrite: (path) => path.replace(/^\/api/, ''),
          },
        }
      : undefined,
  },
  build: {
    rolldownOptions: {
      output: {
        entryFileNames: 'js/[name]-[hash].js',
        chunkFileNames: 'js/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
});
