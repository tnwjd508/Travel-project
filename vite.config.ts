import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', ['FASTAPI_'])
  const token = process.env.FASTAPI_PROXY_TOKEN || env.FASTAPI_PROXY_TOKEN
  const proxyHeaders = token ? { 'X-Ongil-Proxy-Token': token } : undefined
  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api/monthly-briefing': {
          headers: proxyHeaders,
          target: process.env.FASTAPI_BASE_URL || env.FASTAPI_BASE_URL || 'http://127.0.0.1:8000',
          changeOrigin: true, timeout: 300000, proxyTimeout: 300000,
        },
        '/api': {
          headers: proxyHeaders,
          target: process.env.FASTAPI_BASE_URL || env.FASTAPI_BASE_URL || 'http://127.0.0.1:8000',
          changeOrigin: true,
          timeout: 30000,
          proxyTimeout: 30000,
          configure(proxy) {
            proxy.on('error', (_error, _request, response) => {
              if ('writeHead' in response && !response.headersSent) {
                response.writeHead(502, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
                response.end(JSON.stringify({ code: 'BACKEND_UNAVAILABLE', message: 'FastAPI 서버에 연결할 수 없습니다.' }))
              }
            })
          },
        },
      },
    },
    resolve: { alias: { '@': '/src' } },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            charts: ['recharts'],
            motion: ['framer-motion'],
            vendor: ['react', 'react-dom', 'react-router-dom'],
          },
        },
      },
    },
  }
})
