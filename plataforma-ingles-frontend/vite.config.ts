import { defineConfig } from 'vite'
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
    },
  }, // 👈 Acá cierra el server correctamente

  // 2. Configuración de los Alias (Al mismo nivel que 'server')
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});