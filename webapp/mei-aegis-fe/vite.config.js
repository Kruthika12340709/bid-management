import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Path-based routing convention: SPA is mounted under /<agent-name>-fe/ and
// the backend lives under /<agent-name>/api/. BASE_PATH lets the Dockerfile
// override the SPA mount point without editing this file.
export default defineConfig({
  plugins: [react()],
  base: process.env.BASE_PATH || '/mei-aegis-fe/',
  server: {
    port: 5173,
    proxy: {
      // Proxy only API calls to backend, not frontend assets
      '/mei-aegis/': {
        target: 'http://127.0.0.1:8001',
        changeOrigin: true,
      },
    },
  },
})
