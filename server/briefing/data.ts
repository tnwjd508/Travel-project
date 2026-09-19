import type { BriefingEvidence, BriefingFestival, BriefingSource } from '../../src/types/briefing.js'
import { requireTourismDistrict } from '../../src/data/tourismRegions.js'
import { DISTRICTS, regionCodes, type DistrictSlug } from '../regionCodes.js'

// 지도에서 사용하는 통계청 코드(24010 등)와 관광 API의 법정동 코드는 다릅니다.
export const districts = Object.fromEntries(Object.entries(DISTRICTS).map(([id, d]) => [id, { name: d.name, code: d.legacy, currentCode: d.current }]))
export type District = DistrictSlug
// 2026-07-01 전남광주통합특별시 출범: 과거 통계의 코드를 현재 코드로 덮어쓰지 않습니다.
// 행안부 변경 공지와 KorService2/ldongCode2의 실제 응답으로 교차 확인했습니다.
export function districtCode(district: District, period: string) {
  return regionCodes(district, period.replaceAll('-', '').slice(0, 6), 'DataLabService').district
}
type Row = Record<string, unknown>
export interface BriefingContext { district: District; month: string; today: string }
export interface CollectedSource {
  source: BriefingSource
  evidence: BriefingEvidence[]
  festivals?: { recent: BriefingFestival[]; upcoming: BriefingFestival[] }
}
interface SourceSpec {
  id: string
  label: string
  service: string
  operation: string
  kind: 'index' | 'visitors' | 'hubs' | 'festivals'
  index?: string
  code?: string
}

export const sourceSpecs: SourceSpec[] = [
  { id: 'visitors', label: '지역별 방문자 수', service: 'DataLabService', operation: 'locgoRegnVisitrDDList', kind: 'visitors' },
  { id: 'service-demand', label: '관광 서비스 수요', service: 'AreaTarResDemService', operation: 'areaTarSvcDemList', kind: 'index', index: 'tarSvcDemIx', code: '11' },
  { id: 'culture-demand', label: '문화 자원 수요', service: 'AreaTarResDemService', operation: 'areaCulResDemList', kind: 'index', index: 'culResDemIx', code: '12' },
  { id: 'stay', label: '관광 체류 강도', service: 'AreaTarDemDsService', operation: 'areaTarSjrnDsList', kind: 'index', index: 'tarSjrnDsIx', code: '21' },
  { id: 'spending', label: '관광 소비 강도', service: 'AreaTarDemDsService', operation: 'areaTarExpDsList', kind: 'index', index: 'tarExpDsIx', code: '22' },
  { id: 'diversity', label: '관광객 다양성', service: 'AreaTarDivService', operation: 'areaTouDivList', kind: 'index', index: 'touDivIx', code: '31' },
  { id: 'spending-diversity', label: '관광 소비 다양성', service: 'AreaTarDivService', operation: 'areaExpDivList', kind: 'index', index: 'expDivIx', code: '32' },
  { id: 'international', label: '국제적 다양성', service: 'AreaTarDivService', operation: 'areaIntlDivList', kind: 'index', index: 'intlDivIx', code: '33' },
  { id: 'hubs', label: '중심 관광지', service: 'LocgoHubTarService1', operation: 'areaBasedList1', kind: 'hubs' },
  { id: 'festivals', label: '최근·예정 축제', service: 'KorService2', operation: 'searchFestival2', kind: 'festivals' },
]

export function koreaDate(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
}
export function shiftDay(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`)
  value.setUTCDate(value.getUTCDate() + days)
  return value.toISOString().slice(0, 10)
}
export function previousMonth(today: string, offset = 1) {
  const value = new Date(`${today.slice(0, 7)}-01T00:00:00Z`)
  value.setUTCMonth(value.getUTCMonth() - offset)
  return value.toISOString().slice(0, 7)
}
export function parseContext(district: string, month: string | null, today = koreaDate(), regionId?: string | null): BriefingContext {
  requireTourismDistrict(district, regionId)
  const selected = month || previousMonth(today)
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(selected) || selected > previousMonth(today) || selected < previousMonth(today, 24)) {
    throw new Error('최근 24개월 중 집계가 끝난 월을 선택해 주세요.')
  }
  return { district: district as District, month: selected, today }
}
const text = (value: unknown) => typeof value === 'string' || typeof value === 'number' ? String(value).slice(0, 300) : ''
const compact = (date: string) => date.replaceAll('-', '')
function validDate(value: unknown): string | null {
  const raw = text(value)
  if (!/^\d{8}$/.test(raw)) return null
  const iso = `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`
  const date = new Date(`${iso}T00:00:00Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === iso ? iso : null
}

// API 원문의 날짜만으로 행사를 분류합니다. LLM은 축제를 추가하거나 날짜를 바꿀 수 없습니다.
export function classifyFestivals(rows: Row[], today: string) {
  const unique = new Map<string, BriefingFestival>()
  for (const row of rows) {
    const startDate = validDate(row.eventstartdate)
    const endDate = validDate(row.eventenddate)
    if (!startDate || !endDate || endDate < startDate || !text(row.title) || !text(row.contentid)) continue
    const id = `${text(row.contentid)}-${startDate}`
    unique.set(id, { id, title: text(row.title), address: text(row.addr1), startDate, endDate })
  }
  const all = [...unique.values()]
  return {
    recent: all.filter((row) => row.endDate < today && row.endDate >= shiftDay(today, -365)).sort((a, b) => b.endDate.localeCompare(a.endDate)).slice(0, 3),
    upcoming: all.filter((row) => row.startDate > today && row.startDate <= shiftDay(today, 90)).sort((a, b) => a.startDate.localeCompare(b.startDate)).slice(0, 3),
  }
}

export function decodePage(payload: unknown): { rows: Row[]; total: number } {
  const envelope = payload as { response?: { header?: { resultCode?: string }; body?: { items?: '' | { item?: Row[] | Row }; totalCount?: number | string } } }
  const response = envelope?.response
  if (!['0000', '00'].includes(String(response?.header?.resultCode))) throw new Error('관광 API가 오류를 반환했습니다.')
  const body = response?.body
  const total = Number(body?.totalCount)
  if (!body || !Number.isSafeInteger(total) || total < 0) throw new Error('관광 API 응답 형식이 올바르지 않습니다.')
  const item = body.items && body.items.item
  const rows = item ? (Array.isArray(item) ? item : [item]) : []
  if (rows.some((row) => !row || typeof row !== 'object' || Array.isArray(row))) throw new Error('항목 형식이 올바르지 않습니다.')
  return { rows, total }
}

function parameters(spec: SourceSpec, context: BriefingContext) {
  const codes = regionCodes(context.district, compact(context.month), spec.service)
  if (spec.kind === 'festivals') {
    // 시작일 검색으로 장기 행사가 빠지는 것을 줄이기 위해 최근 2년 시작분을 수집합니다.
    return { lDongRegnCd: codes.area, lDongSignguCd: codes.district, eventStartDate: compact(shiftDay(context.today, -730)), arrange: 'A' }
  }
  if (spec.kind === 'visitors') {
    const end = new Date(`${context.month}-01T00:00:00Z`)
    end.setUTCMonth(end.getUTCMonth() + 1)
    end.setUTCDate(0)
    return { startYmd: compact(`${context.month}-01`), endYmd: compact(end.toISOString().slice(0, 10)) }
  }
  return { baseYm: compact(context.month), areaCd: codes.area, signguCd: codes.district, ...(spec.index ? { [`${spec.index}Cd`]: spec.code! } : {}) }
}

export async function collectSource(spec: SourceSpec, context: BriefingContext, serviceKey: string, signal: AbortSignal, fetcher: typeof fetch = fetch): Promise<CollectedSource> {
  const source: BriefingSource = { id: spec.id, label: spec.label, endpoint: `${spec.service}/${spec.operation}`, status: 'empty', count: 0, note: '' }
  let codes: { area: string; district: string }
  try { codes = regionCodes(context.district, compact(context.month), spec.service) } catch (error) {
    return { source: { ...source, status: 'error', note: error instanceof Error ? error.message : '지역 코드 적용 기간을 확인해 주세요.' }, evidence: [] }
  }
  const rows: Row[] = []
  let complete = false
  try {
    let key = serviceKey.trim()
    try { key = decodeURIComponent(key) } catch { /* 디코딩되지 않는 키는 원문으로 처리합니다. */ }
    // 방문자 API는 전국 자료만 제공하므로 페이지를 모두 읽은 뒤 자치구를 골라야 합니다.
    const maxPages = spec.kind === 'visitors' ? 30 : 5
    let received = 0
    for (let page = 1; page <= maxPages; page++) {
      const url = new URL(`https://apis.data.go.kr/B551011/${spec.service}/${spec.operation}`)
      const params = { ...parameters(spec, context), serviceKey: key, MobileOS: 'ETC', MobileApp: 'ONGIL', _type: 'json', numOfRows: '1000', pageNo: String(page) }
      for (const [name, value] of Object.entries(params)) if (value) url.searchParams.set(name, value)
      const result = await fetcher(url, { signal: AbortSignal.any([signal, AbortSignal.timeout(10_000)]), headers: { Accept: 'application/json' } })
      if (!result.ok) throw new Error('관광 API 요청 실패')
      const data = decodePage(await result.json())
      rows.push(...data.rows)
      received += data.rows.length
      if (received >= data.total) { complete = true; break }
      if (!data.rows.length) break
    }
    if (!complete) source.note = '페이지 수집 상한 또는 불완전한 응답으로 일부 자료만 확보했습니다.'
  } catch {
    // 예외에는 인증키가 포함된 요청 URL이 들어갈 수 있어 원문 오류를 반환하지 않습니다.
    source.note = 'API 오류 또는 시간 초과로 수집을 완료하지 못했습니다.'
    source.status = 'error'
  }
  const regionRows = rows.filter((row) => {
    if (spec.kind === 'festivals') return text(row.lDongRegnCd) === codes.area && text(row.lDongSignguCd) === codes.district
    if (spec.kind === 'visitors') return text(row.signguCode) === codes.district && validDate(row.baseYmd)?.startsWith(context.month)
    return text(row.areaCd) === codes.area && text(row.signguCd) === codes.district && text(row.baseYm) === compact(context.month)
  })
  source.count = regionRows.length
  source.status = complete ? (regionRows.length ? 'ready' : 'empty') : (regionRows.length ? 'partial' : source.status === 'error' ? 'error' : 'partial')
  if (source.status === 'empty') source.note = '선택한 지역·기간에 해당하는 자료가 없습니다.'
  const evidence: BriefingEvidence[] = []
  const add = (id: string, label: string, value: string, note: string, period = context.month) => evidence.push({ id: `${spec.id}:${id}`, sourceId: spec.id, label, value, period, note })
  if (spec.kind === 'index') {
    const seen = new Set<string>()
    for (const row of regionRows) {
      const raw = text(row[`${spec.index}Val`])
      const ix = text(row[`${spec.index}Cd`])
      if (ix !== spec.code || !raw.trim() || !Number.isFinite(Number(raw)) || seen.has(ix)) continue
      seen.add(ix)
      add(ix, text(row[`${spec.index}Nm`]) || spec.label, raw, '공식 지표값입니다. 인원·원·시간이 아니며 비교 기준 없이 높고 낮음이나 증감을 판단할 수 없습니다.')
    }
  } else if (spec.kind === 'visitors') {
    const groups = new Map<string, { name: string; sum: number; days: Set<string> }>()
    const seen = new Set<string>()
    for (const row of regionRows) {
      const kind = text(row.touDivCd)
      const day = text(row.baseYmd)
      const raw = text(row.touNum)
      if (!kind || !raw.trim() || !Number.isFinite(Number(raw)) || Number(raw) < 0 || seen.has(`${day}:${kind}`)) continue
      seen.add(`${day}:${kind}`)
      const group = groups.get(kind) ?? { name: text(row.touDivNm) || kind, sum: 0, days: new Set<string>() }
      group.sum += Number(raw)
      group.days.add(day)
      groups.set(kind, group)
    }
    const expectedDays = new Date(Number(context.month.slice(0, 4)), Number(context.month.slice(5)), 0).getDate()
    for (const [kind, group] of groups) {
      add(kind, `${group.name} 일별 방문 수 합계`, String(Math.round(group.sum * 100) / 100), `${group.days.size}/${expectedDays}일 수집. 같은 사람의 다른 날짜 방문이 중복됩니다. 월간 순방문자 수가 아니며 현지인·외지인을 합치지 않습니다.`)
      if (group.days.size < expectedDays) { source.status = 'partial'; source.note = '일부 날짜가 누락되어 월 전체 방문 수로 해석할 수 없습니다.' }
    }
  } else if (spec.kind === 'hubs') {
    const ranked = regionRows.filter((row) => text(row.hubRank).trim() && Number.isFinite(Number(row.hubRank))).sort((a, b) => Number(a.hubRank) - Number(b.hubRank)).slice(0, 5)
    ranked.forEach((row, index) => add(String(index), text(row.hubTatsNm), `중심 순위 ${text(row.hubRank)}`, '방문자 수가 아닌 중심 관광지 순위입니다.'))
  } else {
    const festivals = classifyFestivals(regionRows, context.today)
    for (const kind of ['recent', 'upcoming'] as const) {
      festivals[kind].forEach((festival) => add(festival.id, festival.title, `${festival.startDate} ~ ${festival.endDate}`, kind === 'recent' ? '최근 종료된 축제입니다. 개최만으로 관광 증가 효과를 입증할 수 없습니다.' : 'API에 등록된 예정 일정이며 변경될 수 있습니다.', `조회일 ${context.today}`))
    }
    return { source, evidence, festivals }
  }
  if (regionRows.length && !evidence.length) { source.status = 'partial'; source.note = '행은 수신했지만 유효한 지표값을 확인하지 못했습니다.' }
  return { source, evidence }
}

export async function collectAll(context: BriefingContext, key: string, signal: AbortSignal, fetcher: typeof fetch = fetch) {
  const result: CollectedSource[] = []
  // 호출 폭주를 줄이면서 독립된 API 세 개씩 함께 수집합니다.
  for (let offset = 0; offset < sourceSpecs.length; offset += 3) {
    result.push(...await Promise.all(sourceSpecs.slice(offset, offset + 3).map((spec) => collectSource(spec, context, key, signal, fetcher))))
  }
  return result
}
