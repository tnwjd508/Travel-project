import type { MultiPolygon, Polygon, Position } from 'geojson'
import legacyMapJson from '@/assets/data/gwangju-neighborhood-map.json'
import type { NeighborhoodFeature } from '@/types/boundary'
import { toD3Feature, toLonLat } from '@/utils/geoRendering'

interface LegacyNeighborhood {
  code: string
  name: string
  districtCode: string
  districtName: string
  path: string
}

interface LegacyMapData {
  sourceDate: string
  projection: {
    longitudeScale: number
    minX: number
    maxY: number
    scale: number
    xOffset: number
    yOffset: number
  }
  neighborhoods: LegacyNeighborhood[]
}

const legacyMap = legacyMapJson as LegacyMapData

function formatSourceDate(value: string) {
  return `${value.slice(0, 4)}. ${value.slice(4, 6)}. ${value.slice(6, 8)}.`
}

export const STATIC_BOUNDARY_SOURCE_DATE = formatSourceDate(legacyMap.sourceDate)

// scripts/generate_gwangju_map.py 의 선형 투영(x = xOffset + (lon·longitudeScale − minX)·scale,
// y = yOffset + (maxY − lat)·scale)을 역산해 픽셀 좌표를 경위도로 되돌린다.
function unproject(x: number, y: number): Position {
  const { longitudeScale, minX, maxY, scale, xOffset, yOffset } = legacyMap.projection
  return [((x - xOffset) / scale + minX) / longitudeScale, maxY - (y - yOffset) / scale]
}

// 스크립트 출력은 "M x,y L x,y … Z" 형식만 사용한다. 부분 경로(Z 로 구분)는 각각 하나의 링이다.
function pathToRings(path: string): Position[][] {
  return path
    .split('Z')
    .filter((subPath) => subPath.trim().length > 0)
    .map((subPath) => {
      const points = subPath
        .replace(/^\s*M/, '')
        .split('L')
        .map((pair) => {
          const [x, y] = pair.split(',').map(Number)
          return unproject(x, y)
        })
      return [...points, points[0]]
    })
}

function toStaticFeature(neighborhood: LegacyNeighborhood): NeighborhoodFeature {
  const rings = pathToRings(neighborhood.path)
  // 현재 데이터는 동마다 링이 하나다. 여러 개면 섬처럼 떨어진 영역으로 보고 각각 별도 폴리곤으로 둔다.
  const geometry: Polygon | MultiPolygon = rings.length === 1
    ? { type: 'Polygon', coordinates: rings }
    : { type: 'MultiPolygon', coordinates: rings.map((ring) => [ring]) }

  return toD3Feature({
    type: 'Feature',
    geometry,
    properties: {
      code: neighborhood.code,
      name: neighborhood.name,
      districtCode: neighborhood.districtCode,
      districtName: neighborhood.districtName,
    },
  })
}

// 2025-06-30 기준 통계청 행정동 경계. VWorld 를 쓸 수 없을 때의 정적 폴백이다.
export const staticNeighborhoods: NeighborhoodFeature[] = legacyMap.neighborhoods.map(toStaticFeature)

export function getStaticNeighborhoods(districtCode: string) {
  return staticNeighborhoods.filter((feature) => feature.properties.districtCode === districtCode)
}

// 프록시가 돌려준 VWorld 법정동 경계를 d3 렌더링 규칙(좌표 순서, 링 방향)에 맞춘다.
export function normalizeBoundaryFeatures(features: NeighborhoodFeature[]): NeighborhoodFeature[] {
  return features.map((feature) => {
    const geometry: Polygon | MultiPolygon = feature.geometry.type === 'Polygon'
      ? { type: 'Polygon', coordinates: feature.geometry.coordinates.map((ring) => ring.map(toLonLat)) }
      : { type: 'MultiPolygon', coordinates: feature.geometry.coordinates.map((polygon) => polygon.map((ring) => ring.map(toLonLat))) }
    return toD3Feature({ ...feature, geometry })
  })
}
