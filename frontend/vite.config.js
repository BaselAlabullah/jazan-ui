import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const backendUrl =
    env.BACKEND_URL ||
    env.VITE_BACKEND_URL ||
    `http://${env.BACKEND_HOST || env.VITE_BACKEND_HOST || '127.0.0.1'}:${env.BACKEND_PORT || env.VITE_BACKEND_PORT || '8100'}`

  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api': {
          target: backendUrl,
          changeOrigin: true,
        },
      },
    },
  }
})
