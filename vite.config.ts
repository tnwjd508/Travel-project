import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { isTourApiEndpoint, requestTourApi } from './server/tourApi'

function tourApiDevelopmentProxy(serviceKey: string): Plugin {
  return {
    name: 'ongil-tour-api-development-proxy',
    configureServer(server) {
      server.middlewares.use('/api/tourism', async (request, response) => {
        if (request.method !== 'GET') {
          response.statusCode = 405
          response.setHeader('Content-Type', 'application/json; charset=utf-8')
          response.end(JSON.stringify({ message: 'GET 요청만 지원합니다.' }))
          return
        }

        const requestUrl = new URL(request.url ?? '/', 'http://localhost')
        const endpoint = requestUrl.searchParams.get('endpoint') ?? 'areaCode2'
        if (!isTourApiEndpoint(endpoint)) {
          response.statusCode = 400
          response.setHeader('Content-Type', 'application/json; charset=utf-8')
          response.end(JSON.stringify({ message: '지원하지 않는 TourAPI 기능입니다.' }))
          return
        }

        if (!serviceKey) {
          response.statusCode = 503
          response.setHeader('Content-Type', 'application/json; charset=utf-8')
          response.end(JSON.stringify({ message: 'TOUR_API_SERVICE_KEY 환경변수가 설정되지 않았습니다.' }))
          return
        }

        try {
          const result = await requestTourApi(endpoint, requestUrl.searchParams, serviceKey)
          response.statusCode = result.status
          response.setHeader('Content-Type', result.contentType)
          response.end(result.body)
        } catch (error) {
          response.statusCode = 502
          response.setHeader('Content-Type', 'application/json; charset=utf-8')
          response.end(JSON.stringify({
            message: error instanceof Error && error.name === 'TimeoutError'
              ? 'TourAPI 응답 시간이 초과되었습니다.'
              : 'TourAPI 요청 중 오류가 발생했습니다.',
          }))
        }
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', 'TOUR_')
  return {
  plugins: [react(), tourApiDevelopmentProxy(env.TOUR_API_SERVICE_KEY ?? '')],
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
