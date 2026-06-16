import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 9001,
    proxy: {
      '/api/v1/auth': {
        target: 'http://localhost:8081',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/v1\/auth/, '/auth')
      },
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        rewrite: (path) => {
          console.log('Proxying request:', path);
          return path;
        }
      }
    }
  }
})
