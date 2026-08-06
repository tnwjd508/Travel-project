export const VWORLD_BOUNDARY_LAYERS = {
  sido: 'LT_C_ADSIDO_INFO',
  sigungu: 'LT_C_ADSIGG_INFO',
  eupMyeonDong: 'LT_C_ADEMD_INFO',
  ri: 'LT_C_ADRI_INFO',
} as const

type Position = [number, number]

export interface VWorldPolygonGeometry {
  type: 'Polygon'
  coordinates: Position[][]
}

export interface VWorldMultiPolygonGeometry {
  type: 'MultiPolygon'
  coordinates: Position[][][]
}

export type VWorldBoundaryGeometry = VWorldPolygonGeometry | VWorldMultiPolygonGeometry

export interface VWorldBoundaryFeature {
  type: 'Feature'
  id?: string
  geometry: VWorldBoundaryGeometry
  properties: Record<string, string | number | null | undefined>
}

export interface VWorldBoundaryCollection {
  type: 'FeatureCollection'
  features: VWorldBoundaryFeature[]
  totalFeatures?: number
  numberOfFeatures?: number
}

export class VWorldApiError extends Error {
  constructor(message: string, public readonly code?: string) {
    super(message)
    this.name = 'VWorldApiError'
  }
}

export function getVWorldClientConfig() {
  const browserOrigin = typeof window === 'undefined' ? '' : window.location.origin
  return {
    apiKey: (import.meta.env.VITE_VWORLD_API_KEY ?? '').trim(),
    domain: (import.meta.env.VITE_VWORLD_DOMAIN ?? '').trim() || browserOrigin,
  }
}

export function isVWorldConfigured() {
  const { apiKey, domain } = getVWorldClientConfig()
  return Boolean(apiKey && domain)
}

// VWorld 2D 지도 API를 실제 지도 뷰어로 전환할 때 사용할 수 있는 스크립트 URL입니다.
export function buildVWorld2DMapScriptUrl() {
  const { apiKey, domain } = getVWorldClientConfig()
  if (!apiKey) throw new VWorldApiError('VWorld 인증키가 설정되지 않았습니다.', 'MISSING_KEY')

  const url = new URL('https://map.vworld.kr/js/vworldMapInit.js.do')
  url.searchParams.set('version', '2.0')
  url.searchParams.set('apiKey', apiKey)
  if (domain) url.searchParams.set('domain', domain)
  return url.toString()
}

function getServiceException(payload: string) {
  return {
    code: payload.match(/ServiceException[^>]*code=["']([^"']+)/i)?.[1],
    message: payload.match(/<ServiceException[^>]*>([\s\S]*?)<\/ServiceException>/i)?.[1]?.trim(),
  }
}

export interface VWorldWfsOptions {
  // EPSG:4326 WFS 1.1 BBOX 순서: 위도 최소, 경도 최소, 위도 최대, 경도 최대
  bbox: [number, number, number, number]
  maxFeatures?: number
  signal?: AbortSignal
}

export async function getVWorldLegalDongBoundaries({
  bbox,
  maxFeatures = 500,
  signal,
}: VWorldWfsOptions): Promise<VWorldBoundaryCollection> {
  const { apiKey, domain } = getVWorldClientConfig()
  if (!apiKey) throw new VWorldApiError('VWorld 인증키가 설정되지 않았습니다.', 'MISSING_KEY')

  const url = new URL('https://api.vworld.kr/req/wfs')
  url.searchParams.set('service', 'WFS')
  url.searchParams.set('request', 'GetFeature')
  url.searchParams.set('version', '1.1.0')
  url.searchParams.set('typename', VWORLD_BOUNDARY_LAYERS.eupMyeonDong)
  url.searchParams.set('bbox', bbox.join(','))
  url.searchParams.set('srsname', 'EPSG:4326')
  url.searchParams.set('output', 'application/json')
  url.searchParams.set('maxfeatures', String(maxFeatures))
  url.searchParams.set('key', apiKey)
  if (domain) url.searchParams.set('domain', domain)

  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal,
  })
  const body = await response.text()

  if (!response.ok || body.trimStart().startsWith('<')) {
    const exception = getServiceException(body)
    throw new VWorldApiError(
      exception.message || `VWorld WFS 요청에 실패했습니다. (${response.status})`,
      exception.code,
    )
  }

  let payload: VWorldBoundaryCollection
  try {
    payload = JSON.parse(body) as VWorldBoundaryCollection
  } catch {
    throw new VWorldApiError('VWorld 응답을 GeoJSON으로 해석할 수 없습니다.', 'INVALID_RESPONSE')
  }

  if (payload.type !== 'FeatureCollection' || !Array.isArray(payload.features)) {
    throw new VWorldApiError('VWorld가 올바른 경계 데이터를 반환하지 않았습니다.', 'INVALID_RESPONSE')
  }

  return payload
}

