import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// En développement, l'API (OAuth Google) tourne sur le port 8787 via `node server/index.js`.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    proxy: { '/api': 'http://localhost:8787' },
  },
  build: { target: 'es2020', sourcemap: false },
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
} as any);
