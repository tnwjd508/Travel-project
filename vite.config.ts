import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { isTourApiEndpoint, requestTourApi } from './server/tourApi'
import { CACHE_CONTROL, getProxyDistrict, requestDistrictLegalDongs } from './server/vworld'
import { handleDistrictHttp } from './server/districtHttp'
import { handleRegions } from './server/regions'
import { createBriefingService, type BriefingEnvironment } from './server/briefing/service'

function monthlyBriefingDevelopmentProxy(environment: BriefingEnvironment): Plugin {
  const service = createBriefingService(environment)
  return {
    name: 'ongil-monthly-briefing-development-proxy',
    configureServer(server) {
      server.middlewares.use('/api/monthly-briefing', async (request, response) => {
        const query = new URL(request.url ?? '/', 'http://localhost').searchParams
        const result = await service(request.method, query)
        response.statusCode = result.status
        response.setHeader('Content-Type', 'application/json; charset=utf-8')
        response.setHeader('Cache-Control', 'no-store')
        if (result.status === 405) response.setHeader('Allow', 'GET')
        if (result.status === 429) response.setHeader('Retry-After', '30')
        response.end(JSON.stringify(result.body))
      })
    },
  }
}

function districtDevelopmentProxy(env: Record<string, string | undefined>): Plugin {
  return {
    name: 'ongil-district-development-proxy',
    configureServer(server) {
      server.middlewares.use('/api/regions', (request, response) => {
        const result = handleRegions(request.method)
        response.statusCode = result.status
        for (const [key, value] of Object.entries(result.headers)) response.setHeader(key, value)
        response.end(JSON.stringify(result.body))
      })
      server.middlewares.use('/api/district', async (request, response) => {
        const url = new URL(request.url ?? '/', 'http://localhost')
        const result = await handleDistrictHttp({ method: request.method, resource: url.pathname.slice(1), params: url.searchParams }, env)
        response.statusCode = result.status
        for (const [key, value] of Object.entries(result.headers)) response.setHeader(key, value)
        response.end(JSON.stringify(result.body))
      })
    },
  }
}

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

// VWorld WFS 는 CORS 헤더를 주지 않아 브라우저에서 직접 호출할 수 없다. 로컬에서도 api/vworld.ts 와 같은 프록시를 둔다.
function vworldDevelopmentProxy(apiKey: string, domain: string): Plugin {
  return {
    name: 'ongil-vworld-development-proxy',
    configureServer(server) {
      server.middlewares.use('/api/vworld', async (request, response) => {
        const sendJson = (status: number, payload: unknown) => {
          response.statusCode = status
          response.setHeader('Content-Type', 'application/json; charset=utf-8')
          response.end(JSON.stringify(payload))
        }

        if (request.method !== 'GET') {
          sendJson(405, { message: 'GET 요청만 지원합니다.' })
          return
        }

        const requestUrl = new URL(request.url ?? '/', 'http://localhost')
        const district = getProxyDistrict(requestUrl.searchParams.get('district') ?? undefined)
        if (!district) {
          sendJson(400, { message: '지원하지 않는 자치구입니다.', code: 'UNKNOWN_DISTRICT' })
          return
        }

        if (!apiKey || !domain) {
          sendJson(503, { message: 'VWORLD_API_KEY 또는 VWORLD_DOMAIN 환경변수가 설정되지 않았습니다.', code: 'MISSING_KEY' })
          return
        }

        try {
          const result = await requestDistrictLegalDongs(district, apiKey, domain)
          response.statusCode = result.status
          response.setHeader('Content-Type', result.contentType)
          if (result.status === 200) response.setHeader('Cache-Control', CACHE_CONTROL)
          response.end(result.body)
        } catch (error) {
          sendJson(502, {
            message: error instanceof Error && error.name === 'TimeoutError'
              ? 'VWorld 응답 시간이 초과되었습니다.'
              : 'VWorld 요청 중 오류가 발생했습니다.',
            code: 'PROXY_ERROR',
          })
        }
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, '.', ['TOUR_', 'VWORLD_', 'GEMINI_']), ...Object.fromEntries(Object.entries(process.env).filter(([key]) => /^(TOUR_|VWORLD_|GEMINI_)/.test(key))) }
  return {
    plugins: [
      react(),
      districtDevelopmentProxy(env),
      monthlyBriefingDevelopmentProxy(env),
      tourApiDevelopmentProxy(env.TOUR_API_SERVICE_KEY ?? ''),
      vworldDevelopmentProxy(env.VWORLD_API_KEY ?? '', env.VWORLD_DOMAIN ?? ''),
    ],
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
