import { writeFile } from 'node:fs/promises'
import { loadEnv } from 'vite'
import { requestTourApi } from '../server/tourApi.js'
import { KntoClient, parseKntoResponse } from '../server/knto.js'

// 지역 코드는 공식 API에서 가져오며 인증키·요청 URL은 파일이나 로그에 저장하지 않습니다.
const env = loadEnv('development', process.cwd(), 'TOUR_')
const key = env.TOUR_API_SERVICE_KEY
if (!key) throw new Error('서버의 TOUR_API_SERVICE_KEY를 설정해 주세요.')
const rows: Record<string, unknown>[] = []
for (let page = 1; page <= 5; page++) {
  const result = await requestTourApi('ldongCode2', new URLSearchParams({ lDongListYn: 'Y', numOfRows: '1000', pageNo: String(page) }), key)
  if (result.status !== 200) throw new Error('지역 코드 조회에 실패했습니다.')
  const response = parseKntoResponse(result.body)
  rows.push(...response.items)
  if (rows.length >= response.totalCount) break
  if (!response.items.length || page === 5) throw new Error('지역 코드 전체 목록을 수집하지 못했습니다.')
}
// 개편 직전의 공식 방문자 자료로 전남·광주의 이전 시군구 코드도 교차 확인합니다.
const previous = await new KntoClient(key).all('DataLabService/locgoRegnVisitrDDList', { startYmd: '20260601', endYmd: '20260601' }, 0, 1000)
const legacy = new Map<string, string>()
for (const row of previous) {
  const code = String(row.signguCode)
  if (/^(29|46)\d{3}$/.test(code)) legacy.set(String(row.signguNm), code)
}
const seen = new Set<string>()
const normalized = rows.map((row) => {
  const area = String(row.lDongRegnCd), areaName = String(row.lDongRegnNm)
  const district = String(row.lDongSignguCd), name = String(row.lDongSignguNm)
  const id = area === '36110' && district === '36110' ? '36110' : area + district
  if (!/^\d{5}$/.test(id) || seen.has(id) || !areaName || !name) throw new Error('코드 목록에 잘못되거나 중복된 항목이 있습니다.')
  seen.add(id)
  const previousCode = area === '12' ? legacy.get(name) : undefined
  if (area === '12' && !previousCode) throw new Error(`${name}의 개편 전 코드를 확인하지 못했습니다.`)
  return [area, areaName, district, name, previousCode ?? '']
})
if (normalized.length < 200) throw new Error('전국 코드 목록이 불완전합니다.')
const content = `// 한국관광공사 KorService2/ldongCode2 실제 응답으로 생성합니다. 직접 수정하지 마세요.\n// 항목: 관광 시도 코드, 시도명, 관광 시군구 코드, 시군구명, 개편 전 통계 코드\nexport const regionCatalogueUpdatedAt = ${JSON.stringify(new Date().toISOString())}\nexport const regionCatalogueRows = [\n${normalized.map((row) => `  ${JSON.stringify(row)},`).join('\n')}\n] as const\n`
await writeFile('src/data/tourismRegionCatalogue.ts', content, 'utf8')
console.log(`전국 지역 ${normalized.length}개 코드와 개편 전 매핑을 저장했습니다.`)
