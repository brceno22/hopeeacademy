import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  
  // 1. Configuración del Servidor y Proxy
  server: {
    proxy: {
      '/moodle-files': {
        target: 'http://127.0.0.1:8080',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/moodle-files/, ''),
      },
      // La sesión de admin va en una cookie. Sobre HTTP cross-site el navegador
      // no la enviaría (haría falta SameSite=None, que exige HTTPS), así que en
      // dev la API se sirve por este proxy para quedar same-origin.
      '/api': {
        target: process.env.VITE_DEV_API_TARGET || 'http://localhost:3003',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  }, // 👈 Acá cierra el server correctamente

  // 2. Configuración de los Alias (Al mismo nivel que 'server')
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },

  // 3. Vitest
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    css: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.{test,spec}.{ts,tsx}', 'src/test/**'],
    },
  },
});