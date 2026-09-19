import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { geoArea } from 'd3-geo'
import type { FeatureCollection, Geometry } from 'geojson'
import { simplifyRing } from '../server/vworld.js'
import { tourismProvinces, districtsForRegion } from '../src/data/tourismRegions.js'

// 통계청 2018 경계를 시도별로 분리합니다. 원본 지도 코드와 관광 API 코드는 다르므로 이름과 시도 소속을 함께 검증합니다.
const sourceUrl = 'https://raw.githubusercontent.com/southkorea/southkorea-maps/master/kostat/2018/json/skorea-municipalities-2018-geo.json'
await mkdir('outputs', { recursive: true })
let raw: string
try { raw = await readFile('outputs/kostat-municipalities-2018.json', 'utf8') } catch {
  const response = await fetch(sourceUrl, { signal: AbortSignal.timeout(60000) })
  if (!response.ok) throw new Error('공개 지도 원본을 내려받지 못했습니다.')
  raw = await response.text()
  await writeFile('outputs/kostat-municipalities-2018.json', raw)
}
const source = JSON.parse(raw) as FeatureCollection<Geometry, { code: string; name: string }>
if (source.type !== 'FeatureCollection' || source.features.length !== 250) throw new Error('지도 원본의 형식이나 항목 수를 확인해 주세요.')
const provinceByPrefix: Record<string, string> = { '11': 'seoul', '21': 'busan', '22': 'daegu', '23': 'incheon', '24': 'jeonnam-gwangju', '25': 'daejeon', '26': 'ulsan', '29': 'sejong', '31': 'gyeonggi', '32': 'gangwon', '33': 'chungbuk', '34': 'chungnam', '35': 'jeonbuk', '36': 'jeonnam-gwangju', '37': 'gyeongbuk', '38': 'gyeongnam', '39': 'jeju' }
await mkdir('public/maps', { recursive: true })
for (const province of tourismProvinces) {
  const districts = districtsForRegion(province.id)
  const features = source.features.filter(feature => {
    // 군위군의 시도 이관만 반영하고 분구 경계를 임의로 만들지는 않습니다.
    const region = feature.properties.code.startsWith('37') && feature.properties.name === '군위군' ? 'daegu' : provinceByPrefix[feature.properties.code.slice(0, 2)]
    return region === province.id
  }).map(feature => {
    const district = province.id === 'sejong' && districts.length === 1 ? districts[0]
      : districts.find(item => item.name.replaceAll(' ', '') === feature.properties.name.replaceAll(' ', ''))
    const ring = (points: number[][], index: number) => {
      const result = simplifyRing(points, 0.00025).map(point => point.map(value => Number(value.toFixed(5))))
      // 섬마다 원본 방향이 다를 수 있어 외곽선과 내부 구멍의 방향을 각각 맞춥니다.
      const coversWorld = geoArea({ type: 'Polygon', coordinates: [result] }) > 2 * Math.PI
      return coversWorld === (index === 0) ? result.reverse() : result
    }
    const geometry = feature.geometry.type === 'Polygon' ? { ...feature.geometry, coordinates: feature.geometry.coordinates.map(ring) }
      : feature.geometry.type === 'MultiPolygon' ? { ...feature.geometry, coordinates: feature.geometry.coordinates.map(polygon => polygon.map(ring)) } : feature.geometry
    return { type: 'Feature', geometry, properties: { name: district?.name ?? feature.properties.name, districtId: district?.id ?? null } }
  })
  if (!features.length) throw new Error(`${province.id} 지도 경계를 확인하지 못했습니다.`)
  const collection = { type: 'FeatureCollection', source: '통계청 SGIS · 공공누리 제1유형', sourceYear: '2018', sourceUrl: 'https://github.com/southkorea/southkorea-maps/tree/master/kostat/2018/json', features }
  await writeFile(`public/maps/${province.id}.json`, JSON.stringify(collection))
  console.log(`${province.id}: 경계 ${features.length}개 / 현재 코드 연결 ${features.filter(f => f.properties.districtId).length}개`)
}
