import type { Position } from 'geojson'
import type { DistrictBoundaryCollection, NeighborhoodFeature } from '../src/types/boundary.js'

export const VWORLD_WFS_URL = 'https://api.vworld.kr/req/wfs'

// GeoServer 레이어 이름은 대소문자를 구분한다. 대문자(LT_C_ADEMD_INFO)로 보내면 "Feature type unknown" 오류가 난다.
export const VWORLD_LEGAL_DONG_LAYER = 'lt_c_ademd_info'

export interface ProxyDistrict {
  slug: string
  code: string
  name: string
  // EPSG:4326, WFS 1.1 축 순서: 위도 최소, 경도 최소, 위도 최대, 경도 최대
  bbox: [number, number, number, number]
}

// bbox 는 src/assets/data/gwangju-districts.json 의 경계에 0.01° 여유를 더한 값이다. 조회 범위를 좁힐 뿐이며
// 실제 선택은 응답의 full_nm(예: "전남광주통합특별시 동구 지산동")의 자치구 이름으로 한다.
export const PROXY_DISTRICTS: readonly ProxyDistrict[] = [
  { slug: 'donggu', code: '24010', name: '동구', bbox: [35.0625, 126.8972, 35.1755, 127.0143] },
  { slug: 'seogu', code: '24020', name: '서구', bbox: [35.0809, 126.7906, 35.1886, 126.9197] },
  { slug: 'namgu', code: '24030', name: '남구', bbox: [35.0409, 126.7431, 35.1625, 126.9396] },
  { slug: 'bukgu', code: '24040', name: '북구', bbox: [35.1111, 126.8249, 35.2685, 127.0323] },
  { slug: 'gwangsangu', code: '24050', name: '광산구', bbox: [35.0602, 126.6347, 35.2687, 126.8704] },
]

const districtBySlug = new Map(PROXY_DISTRICTS.map((district) => [district.slug, district]))

export function getProxyDistrict(slug: string | undefined) {
  return slug ? districtBySlug.get(slug) ?? null : null
}

interface WfsFeature {
  type?: string
  geometry?: { type?: string; coordinates?: unknown }
  properties?: Record<string, unknown>
}

interface WfsCollection {
  type?: string
  features?: WfsFeature[]
}

function readProperty(properties: Record<string, unknown> | undefined, name: string) {
  if (!properties) return ''
  const entry = Object.entries(properties).find(([key]) => key.toLowerCase() === name)
  return entry?.[1] == null ? '' : String(entry[1]).trim()
}

export function parseWfsException(body: string) {
  const ows = body.match(/<ows:Exception[^>]*exceptionCode=["']([^"']+)["'][^>]*>([\s\S]*?)<\/ows:Exception>/i)
  if (ows) {
    return {
      code: ows[1],
      message: ows[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
    }
  }
  const service = body.match(/<ServiceException[^>]*code=["']([^"']+)["'][^>]*>([\s\S]*?)<\/ServiceException>/i)
  if (service) {
    return { code: service[1], message: service[2].replace(/\s+/g, ' ').trim() }
  }
  return { code: 'UNKNOWN', message: 'VWorld 가 오류를 반환했습니다.' }
}

// 더글라스-포이커 단순화. 지도 축척에서 1px 이 약 15m 이므로 0.0001°(약 11m)는 화면에서 구분되지 않는다.
export const SIMPLIFY_TOLERANCE_DEGREES = 0.0001

function perpendicularDistance(point: Position, start: Position, end: Position) {
  const dx = end[0] - start[0]
  const dy = end[1] - start[1]
  if (dx === 0 && dy === 0) return Math.hypot(point[0] - start[0], point[1] - start[1])
  return Math.abs(dy * point[0] - dx * point[1] + end[0] * start[1] - end[1] * start[0]) / Math.hypot(dx, dy)
}

function simplifyOpenLine(points: Position[], tolerance: number) {
  if (points.length <= 2) return points
  const keep = new Array<boolean>(points.length).fill(false)
  keep[0] = true
  keep[points.length - 1] = true
  const stack: Array<[number, number]> = [[0, points.length - 1]]
  while (stack.length > 0) {
    const [first, last] = stack.pop() as [number, number]
    let maxDistance = 0
    let splitIndex = -1
    for (let index = first + 1; index < last; index += 1) {
      const distance = perpendicularDistance(points[index], points[first], points[last])
      if (distance > maxDistance) {
        maxDistance = distance
        splitIndex = index
      }
    }
    if (splitIndex !== -1 && maxDistance > tolerance) {
      keep[splitIndex] = true
      stack.push([first, splitIndex], [splitIndex, last])
    }
  }
  return points.filter((_, index) => keep[index])
}

export function simplifyRing(ring: Position[], tolerance = SIMPLIFY_TOLERANCE_DEGREES): Position[] {
  if (ring.length < 5) return ring
  const closed = ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1]
  const open = closed ? ring.slice(0, -1) : ring
  // 닫힌 링은 서로 가장 먼 두 점을 기준으로 두 개의 열린 선으로 나눠 단순화한다.
  let farIndex = 1
  let farDistance = -1
  for (let index = 1; index < open.length; index += 1) {
    const distance = Math.hypot(open[index][0] - open[0][0], open[index][1] - open[0][1])
    if (distance > farDistance) {
      farDistance = distance
      farIndex = index
    }
  }
  const firstArc = simplifyOpenLine(open.slice(0, farIndex + 1), tolerance)
  const secondArc = simplifyOpenLine([...open.slice(farIndex), open[0]], tolerance)
  const simplified = [...firstArc.slice(0, -1), ...secondArc.slice(0, -1)]
  if (simplified.length < 3) return ring
  return [...simplified, simplified[0]]
}

function isPosition(value: unknown): value is Position {
  return Array.isArray(value) && value.length >= 2 && typeof value[0] === 'number' && typeof value[1] === 'number'
}

function toRings(value: unknown): Position[][] | null {
  if (!Array.isArray(value)) return null
  const rings: Position[][] = []
  for (const ring of value) {
    if (!Array.isArray(ring) || !ring.every(isPosition)) return null
    const simplified = simplifyRing(ring.map(([x, y]) => [x, y]))
    if (simplified.length >= 4) rings.push(simplified)
  }
  return rings.length > 0 ? rings : null
}

function toNeighborhoodFeature(feature: WfsFeature, district: ProxyDistrict): NeighborhoodFeature | null {
  const tokens = readProperty(feature.properties, 'full_nm').split(/\s+/).filter(Boolean)
  // 예: "광주광역시 동구 충장동" 또는 통합 이후 "전남광주통합특별시 동구 지산동"
  if (tokens.length < 3 || !tokens[0].includes('광주') || tokens[1] !== district.name) return null

  const code = readProperty(feature.properties, 'emd_cd')
  const name = readProperty(feature.properties, 'emd_kor_nm') || tokens[tokens.length - 1]
  if (!code || !name) return null

  const geometryType = feature.geometry?.type
  const coordinates = feature.geometry?.coordinates
  let geometry: NeighborhoodFeature['geometry'] | null = null
  if (geometryType === 'Polygon') {
    const rings = toRings(coordinates)
    if (rings) geometry = { type: 'Polygon', coordinates: rings }
  } else if (geometryType === 'MultiPolygon' && Array.isArray(coordinates)) {
    const polygons = coordinates.map(toRings).filter((rings): rings is Position[][] => rings !== null)
    if (polygons.length > 0) geometry = { type: 'MultiPolygon', coordinates: polygons }
  }
  if (!geometry) return null

  return {
    type: 'Feature',
    geometry,
    properties: { code, name, districtCode: district.code, districtName: district.name },
  }
}

export interface VWorldProxyResult {
  status: number
  contentType: string
  body: string
}

export const CACHE_CONTROL = 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800'

const CACHE_TTL_MS = 60 * 60 * 1000
const responseCache = new Map<string, { expiresAt: number; body: string }>()

export function buildVWorldUrl(district: ProxyDistrict, apiKey: string, domain: string) {
  const url = new URL(VWORLD_WFS_URL)
  url.searchParams.set('service', 'WFS')
  url.searchParams.set('request', 'GetFeature')
  url.searchParams.set('version', '1.1.0')
  url.searchParams.set('typename', VWORLD_LEGAL_DONG_LAYER)
  url.searchParams.set('bbox', district.bbox.join(','))
  url.searchParams.set('srsname', 'EPSG:4326')
  url.searchParams.set('output', 'application/json')
  url.searchParams.set('maxfeatures', '500')
  url.searchParams.set('key', apiKey.trim())
  url.searchParams.set('domain', domain.trim())
  return url
}

function jsonResult(status: number, payload: unknown): VWorldProxyResult {
  return { status, contentType: 'application/json; charset=utf-8', body: JSON.stringify(payload) }
}

// 자치구 하나의 법정동 경계를 VWorld 에서 받아 앱이 쓰는 모양으로 정리한다. 인증키는 서버에만 머문다.
export async function requestDistrictLegalDongs(
  district: ProxyDistrict,
  apiKey: string,
  domain: string,
): Promise<VWorldProxyResult> {
  const cached = responseCache.get(district.slug)
  if (cached && cached.expiresAt > Date.now()) {
    return { status: 200, contentType: 'application/json; charset=utf-8', body: cached.body }
  }

  const response = await fetch(buildVWorldUrl(district, apiKey, domain), {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(20_000),
  })
  const body = await response.text()

  if (!response.ok || body.trimStart().startsWith('<')) {
    const exception = parseWfsException(body)
    return jsonResult(502, {
      message: exception.message || `VWorld WFS 요청에 실패했습니다. (${response.status})`,
      code: exception.code,
    })
  }

  let payload: WfsCollection
  try {
    payload = JSON.parse(body) as WfsCollection
  } catch {
    return jsonResult(502, { message: 'VWorld 응답을 GeoJSON으로 해석할 수 없습니다.', code: 'INVALID_RESPONSE' })
  }
  if (payload.type !== 'FeatureCollection' || !Array.isArray(payload.features)) {
    return jsonResult(502, { message: 'VWorld가 올바른 경계 데이터를 반환하지 않았습니다.', code: 'INVALID_RESPONSE' })
  }

  const features = payload.features
    .map((feature) => toNeighborhoodFeature(feature, district))
    .filter((feature): feature is NeighborhoodFeature => feature !== null)
    .sort((left, right) => left.properties.code.localeCompare(right.properties.code))

  const collection: DistrictBoundaryCollection = {
    type: 'FeatureCollection',
    source: 'vworld',
    layer: VWORLD_LEGAL_DONG_LAYER,
    district: { slug: district.slug, code: district.code, name: district.name },
    fetchedAt: new Date().toISOString(),
    features,
  }
  const serialized = JSON.stringify(collection)
  if (features.length > 0) responseCache.set(district.slug, { expiresAt: Date.now() + CACHE_TTL_MS, body: serialized })
  return { status: 200, contentType: 'application/json; charset=utf-8', body: serialized }
}
