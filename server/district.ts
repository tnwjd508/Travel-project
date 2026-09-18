import type { AllSummaryResponse, ContentsResponse, DistrictMeta, FestivalsResponse, IndicesResponse, RankResponse, RelatedResponse, SummaryResponse, VisitorsResponse } from '../src/types/district.js'
import { ApiError, KntoClient, MemoCache, sourceFetchedAt } from './knto.js'
import { DISTRICTS, isDistrict, type DistrictSlug } from './regionCodes.js'
import { requireTourismDistrict } from '../src/data/tourismRegions.js'
import { changePct, monthDays, shiftMonth, visitorMonth } from './aggregate/visitors.js'
import { DIAGNOSTIC_CODES, getIndex, getIndices, indexDefinition } from './aggregate/indices.js'
import { getContents, getFestivals } from './aggregate/contents.js'
import { getRelated } from './aggregate/related.js'
import { getRank } from './aggregate/rank.js'
import { diagnose } from './diagnosis.js'

export const SOURCE = '출처: ⓒ한국관광공사' as const
export const RESOURCE_TTL = { summary: 21600, visitors: 86400, indices: 86400, contents: 3600, festivals: 3600, related: 86400, rank: 86400, diagnosis: 21600 } as const
export type Resource = keyof typeof RESOURCE_TTL
export interface DistrictConfig { indexBaseYm: string; visitorBaseYm: string }
// Explicit last-verified snapshots, not a claim of automatic latest-month discovery.
export function districtConfig(env: Record<string, string | undefined>): DistrictConfig {
  const config = { indexBaseYm: env.TOUR_API_INDEX_BASE_YM || '202608', visitorBaseYm: env.TOUR_API_VISITOR_BASE_YM || '202607' }
  for (const value of Object.values(config)) if (!validMonth(value)) throw new ApiError(503, 'INVALID_CONFIG', '관광 API 기준월 환경변수를 확인하세요.')
  return config
}
function validMonth(value: string) { return /^20\d{2}(0[1-9]|1[0-2])$/.test(value) }
export interface DistrictQuery { resource: Resource; district: DistrictSlug | 'all'; baseYm: string; visitorYm: string; months: number; metric: string; from: string; contentTypeId?: string }
export function parseDistrictQuery(resource: string, params: URLSearchParams, config: DistrictConfig): DistrictQuery {
  if (!Object.hasOwn(RESOURCE_TTL, resource)) throw new ApiError(404, 'UNKNOWN_RESOURCE', '지원하지 않는 관광 리소스입니다.')
  const permitted: Record<Resource, string[]> = {
    summary: ['district', 'baseYm', 'visitorYm'], visitors: ['district', 'baseYm', 'months'], indices: ['district', 'baseYm'],
    contents: ['district', 'contentTypeId'], festivals: ['district', 'from'], related: ['district', 'baseYm'], rank: ['district', 'metric', 'baseYm'], diagnosis: ['district', 'baseYm', 'visitorYm'],
  }
  for (const key of params.keys()) if ((!permitted[resource as Resource].includes(key) && key !== 'regionId') || params.getAll(key).length !== 1) throw new ApiError(400, 'INVALID_PARAMETER', '알 수 없거나 중복된 파라미터입니다.')
  const district = params.get('district') ?? (params.has('regionId') ? '' : 'donggu')
  if (!isDistrict(district) && !(district === 'all' && resource === 'summary' && !params.has('regionId'))) throw new ApiError(400, 'UNKNOWN_DISTRICT', '지원하는 시군구 코드를 선택해 주세요.')
  if (district !== 'all') {
    try { requireTourismDistrict(district, params.get('regionId')) } catch (error) {
      throw new ApiError(400, 'REGION_MISMATCH', error instanceof Error ? error.message : '지역 선택을 확인해 주세요.')
    }
  }
  const baseYm = params.get('baseYm') ?? (resource === 'visitors' ? config.visitorBaseYm : config.indexBaseYm)
  const visitorYm = params.get('visitorYm') ?? (baseYm < config.visitorBaseYm ? baseYm : config.visitorBaseYm)
  for (const [value, maximum] of [[baseYm, resource === 'visitors' ? config.visitorBaseYm : config.indexBaseYm], [visitorYm, config.visitorBaseYm]]) if (!validMonth(value) || value < '201901' || value > maximum) throw new ApiError(400, 'INVALID_MONTH', '기준월은 YYYYMM 형식의 확인된 데이터 범위여야 합니다.')
  const rawMonths = params.get('months') ?? '12'
  if (!/^(?:[1-9]|1[0-2])$/.test(rawMonths)) throw new ApiError(400, 'INVALID_MONTHS', 'months는 1~12 정수여야 합니다.')
  const metric = params.get('metric') ?? '21'; indexDefinition(metric)
  const koreaToday = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10).replaceAll('-', '')
  const from = params.get('from') ?? `${koreaToday.slice(0, 6)}01`
  if (!/^20\d{2}(0[1-9]|1[0-2])\d{2}$/.test(from) || +from.slice(6) < 1 || +from.slice(6) > monthDays(from.slice(0, 6))) throw new ApiError(400, 'INVALID_DATE', 'from은 유효한 YYYYMMDD 날짜여야 합니다.')
  const contentTypeId = params.get('contentTypeId') ?? undefined
  if (contentTypeId !== undefined && !['12', '14', '15', '25', '28', '32', '38', '39'].includes(contentTypeId)) throw new ApiError(400, 'INVALID_CONTENT_TYPE', '지원하지 않는 콘텐츠 유형입니다.')
  return { resource: resource as Resource, district: district as DistrictSlug | 'all', baseYm, visitorYm, months: +rawMonths, metric, from, contentTypeId }
}

export class DistrictService {
  private cache = new MemoCache(256)
  constructor(readonly client: KntoClient) {}
  meta(baseYm: string, warnings: string[] = []): DistrictMeta { return { baseYm, source: SOURCE, fetchedAt: sourceFetchedAt(), warnings } }
  async summary(district: DistrictSlug, ym: string, visitorYm: string): Promise<SummaryResponse> {
    const previousYm = shiftMonth(ym, -1)
    const [current, previous, values, oldAge] = await Promise.all([
      visitorMonth(this.client, district, visitorYm), visitorMonth(this.client, district, shiftMonth(visitorYm, -1)),
      Promise.all(['21', '2102', '22', '2201', '11', '3102', '3103'].map(code => getIndex(this.client, district, ym, code))),
      Promise.all(['3102', '3103'].map(code => getIndex(this.client, district, previousYm, code))),
    ])
    const [ix21, ix2102, ix22, ix2201, ix11, ix3102, ix3103] = values
    const ageSum = ix3102 === null || ix3103 === null ? null : ix3102 + ix3103
    const oldSum = oldAge.some(v => v === null) ? null : oldAge[0]! + oldAge[1]!
    const warnings = ['방문자는 일별 추정 방문자 합계이며 월간 순방문자 수가 아닙니다.']
    if (!current.complete || !previous.complete) warnings.push('방문자 완월 데이터가 부족하여 전월 대비를 계산하지 않았습니다.')
    if (values.some(v => v === null) || oldSum === null) warnings.push('일부 지수가 제공되지 않아 null을 반환합니다.')
    return { ...this.meta(ym, warnings), district, visitors: { ...current, month: visitorYm, momPct: current.complete && previous.complete ? changePct(current.total, previous.total) : null },
      stay: { ix21, ix2102 }, spend: { ix22, ix2201 }, demand: { ix11 }, age: { ix3102, ix3103, momPct: changePct(ageSum, oldSum) }, indexUnit: 'index', visitorsMetric: 'sum_of_daily_estimated_visitors' }
  }
  async indices(district: DistrictSlug, ym: string, selectedCodes?: string[]): Promise<IndicesResponse> {
    const groups = await getIndices(this.client, district, ym, selectedCodes)
    return { ...this.meta(ym, Object.values(groups).some(group => Object.values(group).includes(null)) ? ['일부 지수가 제공되지 않아 null을 반환합니다.'] : []), district, unit: 'index', groups }
  }
  async related(district: DistrictSlug, ym: string): Promise<RelatedResponse> {
    const result = await getRelated(this.client, district, ym)
    return { ...this.meta(ym, ['연관 관광지 연결 건수의 구성비이며 방문객 집중률이 아닙니다.']), district, ...result }
  }
  async rank(district: DistrictSlug, ym: string, metric: string): Promise<RankResponse> {
    const result = await getRank(this.client, district, ym, metric)
    return { ...this.meta(ym, ['전국 관측 시군구 내 순위이며 행정구역 모집단 전체와 대조하지 않았습니다.', ...(result.complete ? [] : ['전국 비교 데이터가 부족하여 순위를 표시하지 않습니다.'])]), district, ...result }
  }
  async execute(query: DistrictQuery) {
    return this.cache.get(JSON.stringify(query), RESOURCE_TTL[query.resource], async () => {
      const { resource, baseYm: ym, visitorYm } = query
      if (resource === 'summary' && query.district === 'all') {
        const items = await Promise.all(Object.keys(DISTRICTS).map(d => this.summary(d as DistrictSlug, ym, visitorYm)))
        return { ...this.meta(ym, [...new Set(items.flatMap(item => item.warnings))]), items } satisfies AllSummaryResponse
      }
      const district = query.district as DistrictSlug
      switch (resource) {
        case 'summary': return this.summary(district, ym, visitorYm)
        case 'indices': return this.indices(district, ym)
        case 'related': return this.related(district, ym)
        case 'rank': return this.rank(district, ym, query.metric)
        case 'contents': {
          const result = await getContents(this.client, district, ym, query.contentTypeId)
          return { ...this.meta(ym), district, ...result } satisfies ContentsResponse
        }
        case 'festivals': {
          const result = await getFestivals(this.client, district, ym, query.from)
          return { ...this.meta(ym), district, ...result } satisfies FestivalsResponse
        }
        case 'visitors': {
          const months = Array.from({ length: query.months }, (_, i) => shiftMonth(ym, i - query.months + 1))
          const [series, previousYear] = await Promise.all([Promise.all(months.map(m => visitorMonth(this.client, district, m))), Promise.all(months.map(m => visitorMonth(this.client, district, shiftMonth(m, -12))))])
          return { ...this.meta(ym, ['방문자는 일별 추정치 합계입니다.', ...([...series, ...previousYear].some(m => !m.complete) ? ['일부 월은 데이터가 부족합니다. complete 필드를 확인하세요.'] : [])]), district, metric: 'sum_of_daily_estimated_visitors', series, previousYear } satisfies VisitorsResponse
        }
        case 'diagnosis': {
          const [summary, indices, related] = await Promise.all([this.summary(district, ym, visitorYm), this.indices(district, ym, DIAGNOSTIC_CODES), this.related(district, ym)])
          return diagnose(summary, indices, related)
        }
      }
    })
  }
}
