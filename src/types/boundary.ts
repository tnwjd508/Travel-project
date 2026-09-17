import type { Feature, MultiPolygon, Polygon } from 'geojson'

export interface NeighborhoodProperties {
  code: string
  name: string
  // gwangjuDistricts.ts 및 gwangju-districts.json 과 같은 통계청 자치구 코드(24010 …)
  districtCode: string
  districtName: string
}

export type NeighborhoodFeature = Feature<Polygon | MultiPolygon, NeighborhoodProperties>
export type NeighborhoodSource = 'vworld' | 'static'

// /api/vworld 프록시가 돌려주는 자치구별 법정동 경계 묶음
export interface DistrictBoundaryCollection {
  type: 'FeatureCollection'
  source: 'vworld'
  layer: string
  district: { slug: string; code: string; name: string }
  fetchedAt: string
  features: NeighborhoodFeature[]
}
