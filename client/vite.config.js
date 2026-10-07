import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiTarget = env.VITE_DEV_API_TARGET || 'http://localhost:4000';

  return {
    plugins: [react()],
    server: {
      port: 5173,
      // En desarrollo el navegador habla siempre con el mismo origen; Vite reenvía la API y el socket.
      proxy: {
        '/api': { target: apiTarget, changeOrigin: false },
        '/socket.io': { target: apiTarget, ws: true, changeOrigin: false },
      },
    },
    build: {
      sourcemap: false,
      chunkSizeWarningLimit: 700,
      // Librerías en chunks propios: cambian poco y el navegador las mantiene en caché entre despliegues.
      rollupOptions: {
        output: {
          manualChunks: {
            react: ['react', 'react-dom', 'react-router-dom'],
            data: ['@tanstack/react-query', 'axios', 'socket.io-client', 'zustand'],
            ui: [
              '@radix-ui/react-dialog',
              '@radix-ui/react-dropdown-menu',
              '@radix-ui/react-popover',
              '@radix-ui/react-tabs',
              '@radix-ui/react-tooltip',
              'sonner',
            ],
            forms: ['react-hook-form', '@hookform/resolvers', 'zod'],
            dates: ['date-fns'],
          },
        },
      },
    },
  };
});
