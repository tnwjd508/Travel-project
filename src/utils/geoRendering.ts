import type { Feature, FeatureCollection, Geometry, Position } from 'geojson'

type Ring = Position[]

// 평면(경도 x, 위도 y) 기준 부호 있는 면적. 반시계 방향이면 양수, 시계 방향이면 음수.
export function ringSignedArea(ring: Ring) {
  let doubleArea = 0
  for (let index = 0, count = ring.length; index < count; index += 1) {
    const [x1, y1] = ring[index]
    const [x2, y2] = ring[(index + 1) % count]
    doubleArea += x1 * y2 - x2 * y1
  }
  return doubleArea / 2
}

function orientRing(ring: Ring, clockwise: boolean) {
  const isClockwise = ringSignedArea(ring) < 0
  return isClockwise === clockwise ? ring : [...ring].reverse()
}

// d3-geo 구면 규칙: 외곽 링은 시계 방향, 구멍은 반시계 방향이어야 작은 쪽 영역으로 해석된다.
function orientPolygon(rings: Ring[]) {
  return rings.map((ring, index) => orientRing(ring, index === 0))
}

// RFC 7946(외곽 반시계)과 d3-geo(외곽 시계)의 링 방향 차이를 흡수한다. 원본 데이터는 바꾸지 않는다.
export function toD3Geometry<G extends Geometry>(geometry: G): G {
  if (geometry.type === 'Polygon') {
    return { ...geometry, coordinates: orientPolygon(geometry.coordinates) } as G
  }
  if (geometry.type === 'MultiPolygon') {
    return { ...geometry, coordinates: geometry.coordinates.map(orientPolygon) } as G
  }
  return geometry
}

export function toD3Feature<G extends Geometry, P>(feature: Feature<G, P>): Feature<G, P> {
  return { ...feature, geometry: toD3Geometry(feature.geometry) }
}

export function toD3FeatureCollection<G extends Geometry, P>(collection: FeatureCollection<G, P>): FeatureCollection<G, P> {
  return { ...collection, features: collection.features.map((feature) => toD3Feature(feature)) }
}

// GeoJSON은 [경도, 위도] 순서지만 일부 WFS 변환기는 EPSG:4326 축 순서([위도, 경도])를 유지한다.
// 한반도 범위에서는 경도(126~131)와 위도(33~39)가 겹치지 않아 값 크기로 구분할 수 있다.
export function toLonLat(position: Position): Position {
  const [first, second] = position
  return first > 90 ? [first, second] : [second, first]
}
