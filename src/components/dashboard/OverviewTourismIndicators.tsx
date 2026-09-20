import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from 'react'
import { ChevronDown, Compass, Info, Moon, Users, Wallet, X } from 'lucide-react'
import { useActiveDistrict } from '@/hooks/useActiveDistrict'
import { useDistrictResource } from '@/hooks/useDistrictResource'
import { metricMonth } from '@/data/tourismMetrics'
import type { IndicatorComparisonSnapshot, IndicesResponse, RankResponse, SummaryResponse } from '@/types/district'
import { matchesIndicatorSnapshot } from '@/services/indicatorSnapshot'
import { DataNotice, SourceNote, formatValue } from './DataNotice'
import { overviewIndicators, type IndicatorItem, type OverviewIndicator, type OverviewMetricKey } from './overviewIndicatorDefinitions'
import './OverviewTourismIndicators.css'

type ResourceState<T> = { status: string; data: T | null; error: string; retry: () => void }
type Explanation = { item: IndicatorItem; title: string; anchor: HTMLButtonElement }
const icons = { stay: Moon, spend: Wallet, demand: Compass }
const numberOrNull = (value: unknown): number | null => typeof value === 'number' && Number.isFinite(value) ? value : null
const displayIndex = (value: unknown) => formatValue(numberOrNull(value), 2)
function difference(value: number | null, reference: unknown) {
  const other = numberOrNull(reference)
  if (value === null || other === null) return '자료 없음'
  const delta = Math.round((value - other) * 100) / 100
  return `${delta > 0 ? '+' : delta < 0 ? '−' : ''}${Math.abs(delta).toFixed(2)} 지수 차이`
}

// 지역현황은 직접 조회하고, 시뮬레이션·보고서는 자신이 가진 기준선을 전달합니다.
export function TourismIndicators({ state: supplied, frozen = false, snapshot = null }: {
  state?: ResourceState<SummaryResponse>
  frozen?: boolean
  snapshot?: IndicatorComparisonSnapshot | null
}) {
  const district = useActiveDistrict()
  const liveSummary = useDistrictResource('summary', { district: district.slug }, supplied === undefined && !frozen)
  const summary = supplied ?? liveSummary
  const matchingSnapshot = snapshot && summary.data && matchesIndicatorSnapshot(snapshot, summary.data) ? snapshot : null
  const titleId = useId()
  return <section className="overview-indicators" aria-labelledby={titleId}>
    <div className="ovi-heading"><h2 id={titleId}>핵심 관광 지표</h2><p>{district.regionName} {district.nameKo}</p></div>
    <DataNotice state={summary} />
    {summary.data && <IndicatorContent key={`${district.regionId}:${district.slug}:${summary.data.baseYm}:${frozen}:${summary.data.fetchedAt}`} summary={summary.data} district={district} frozen={frozen} snapshot={matchingSnapshot} />}
  </section>
}

// 기존 지역현황의 연결 이름을 유지해 이미 적용한 화면의 동작을 보존합니다.
export const OverviewTourismIndicators = TourismIndicators

function IndicatorContent({ summary, district, frozen, snapshot }: { summary: SummaryResponse; district: ReturnType<typeof useActiveDistrict>; frozen: boolean; snapshot: IndicatorComparisonSnapshot | null }) {
  const [selected, setSelected] = useState<OverviewMetricKey | null>(null)
  const [detailsRequested, setDetailsRequested] = useState(false)
  const [explanation, setExplanation] = useState<Explanation | null>(null)
  const root = useRef<HTMLDivElement>(null)
  // 하위 지수 49개를 첫 화면부터 수집하지 않고, 처음 카드를 펼칠 때만 요청합니다.
  const liveIndices = useDistrictResource('indices', { district: district.slug, baseYm: summary.baseYm }, detailsRequested && !frozen)
  const indices: ResourceState<IndicesResponse> = frozen ? { status: 'live', data: snapshot?.indices ?? null, error: '', retry: () => {} } : liveIndices
  const closeExplanation = useCallback((restoreFocus = false) => {
    if (restoreFocus && explanation?.anchor.isConnected) explanation.anchor.focus({ preventScroll: true })
    setExplanation(null)
  }, [explanation])
  const select = (key: OverviewMetricKey) => {
    closeExplanation()
    setSelected(current => current === key ? null : key)
    setDetailsRequested(true)
  }
  const showExplanation = (next: Explanation) => setExplanation(current => current?.anchor === next.anchor ? null : next)
  return <div className="ovi-content" ref={root}>
    <div className="ovi-visitors"><span className="ovi-visitor-label"><Users size={17} aria-hidden="true" />일별 방문 추정치 월 합계</span><strong>{formatValue(summary.visitors.total)}</strong><span>{metricMonth(summary.visitors.month)} · 전월 대비 {summary.visitors.momPct == null ? '자료 없음' : `${summary.visitors.momPct > 0 ? '+' : ''}${summary.visitors.momPct}%`}</span></div>
    <div className="ovi-toolbar"><span>전국 관측 시군구 기준{frozen ? ' · 저장 시점 자료' : ''}</span><span>{metricMonth(summary.baseYm)}</span></div>
    <div className="ovi-grid" data-focused={selected !== null}>
      {overviewIndicators.map(definition => <IndicatorCard key={definition.key} definition={definition} summary={summary} district={district} expanded={selected === definition.key} onSelect={() => select(definition.key)} indices={indices} explanation={explanation} onExplain={showExplanation} frozen={frozen} savedComparison={snapshot?.ranks[definition.code as '21' | '22' | '11'] ?? null} />)}
    </div>
    <p className="ovi-note"><Info size={14} aria-hidden="true" />지수가 관측된 시군구끼리 비교합니다. 지표별 비교 지역 수가 다를 수 있으며, 전체 행정구역을 포함한 순위는 아닙니다.</p>
    <details className="ovi-guide"><summary>순위·평균·중앙값은 어떻게 읽나요?</summary><p>같은 기준월·같은 지표의 유효한 시군구 값을 비교합니다. 높은 값이 앞 순위이며 동점은 같은 순위입니다. 평균은 지역별 지수의 단순평균, 중앙값은 크기순으로 정렬한 가운데 값입니다.</p><p>상·하위 비율에는 동일 지수 지역을 함께 포함합니다. 순위 막대의 왼쪽은 1위, 오른쪽은 마지막 순위입니다. 낮은 순위가 정책적 부족을 뜻하지 않으며, 지수는 100점 만점이나 실제 인원·금액·비율이 아닙니다.</p></details>
    <SourceNote data={summary} />
    {explanation && <ExplanationBubble explanation={explanation} root={root} onClose={closeExplanation} />}
  </div>
}

function rankLabel(data: RankResponse | null) {
  if (!data?.complete || data.rank === null || data.total < 1) return ''
  const ties = Math.max(1, data.tieCount ?? 1)
  if (data.total === 1) return '비교 지역 1곳'
  if (ties === data.total) return '모든 비교 지역과 같은 지수'
  const upper = (data.rank - 1 + ties) / data.total * 100
  const lower = (data.total - data.rank + 1) / data.total * 100
  // 공동 순위를 단독 순위처럼 상위 비율로 과장하지 않습니다.
  const pct = Math.min(upper, lower)
  return `${upper <= lower ? '상위' : '하위'} ${pct < 1 ? '1% 미만' : `약 ${Math.round(pct)}%`}`
}

function IndicatorCard({ definition, summary, district, expanded, onSelect, indices, explanation, onExplain, frozen, savedComparison }: {
  definition: OverviewIndicator; summary: SummaryResponse; district: ReturnType<typeof useActiveDistrict>
  expanded: boolean; onSelect: () => void; indices: ResourceState<IndicesResponse>
  explanation: Explanation | null; onExplain: (value: Explanation) => void
  frozen: boolean; savedComparison: RankResponse | null
}) {
  const liveComparison = useDistrictResource('rank', { district: district.slug, baseYm: summary.baseYm, metric: definition.code }, !frozen)
  const comparison: ResourceState<RankResponse> = frozen ? { status: 'live', data: savedComparison, error: '', retry: () => {} } : liveComparison
  const data = comparison.data
  const ready = data?.complete === true && Number.isInteger(data.rank) && data.rank! >= 1 && Number.isInteger(data.total) && data.total >= data.rank!
  const summaryValue = definition.key === 'stay' ? summary.stay.ix21 : definition.key === 'spend' ? summary.spend.ix22 : summary.demand.ix11
  // 저장된 검토의 값이 null이면 최신 API 값으로 채우지 않습니다.
  const value = frozen ? numberOrNull(summaryValue) : numberOrNull(data?.value) ?? numberOrNull(summaryValue)
  const average = ready ? numberOrNull(data?.mean) : null
  const median = ready ? numberOrNull(data?.median) : null
  const point = ready ? data.total === 1 ? 0 : Math.max(0, Math.min(100, (data.rank! - 1) / (data.total - 1) * 100)) : null
  const Icon = icons[definition.key]
  const id = useId()
  const childCount = definition.groups.reduce((sum, group) => sum + group.items.length, 0)
  return <article className="ovi-card" data-expanded={expanded} aria-labelledby={`${id}-label`}>
    <button type="button" className="ovi-card-trigger" onClick={onSelect} aria-expanded={expanded} aria-controls={`${id}-detail`} aria-label={`${definition.label} 상세 비교`}>
      <span className="ovi-card-title"><span className="ovi-icon"><Icon size={17} aria-hidden="true" /></span><span id={`${id}-label`}>{definition.label}</span><span className="ovi-chevron"><ChevronDown size={15} aria-hidden="true" /></span></span>
      <span className="ovi-rank-line">{ready ? <>{(data.tieCount ?? 1) > 1 && <span className="ovi-tied">공동</span>}<strong>{data.rank}</strong><span>위</span><small>/ {data.total}개 지역</small></> : <span className="ovi-rank-empty" role="status">{frozen && !data ? '순위 저장 자료 없음' : comparison.status === 'loading' ? '순위 조회 중' : comparison.status === 'error' ? '순위 조회 실패' : '순위 자료 부족'}</span>}</span>
      {frozen && !ready && <span className="ovi-detail-note ovi-saved-value">저장된 지수 {displayIndex(value)}</span>}
      {ready && <span className="ovi-percent">{rankLabel(data)}</span>}
      <span className="ovi-position" role="img" aria-label={ready ? `전국 관측 ${data.total}개 시군구 중 ${data.rank}위` : '전국 순위 비교 자료가 없습니다.'}>
        <span className="ovi-rail">{point !== null && <span className="ovi-point" style={{ left: `${point}%` }} />}</span>
        <span className="ovi-ends"><span>{ready ? '1위' : comparison.status === 'loading' ? '비교 자료 확인 중' : '비교 자료 없음'}</span><span>{ready ? `${data.total}위` : '—'}</span></span>
      </span>
    </button>
    {comparison.status === 'error' && <div className="ovi-retry" role="alert"><p>{comparison.error}</p><button type="button" onClick={comparison.retry}>순위 다시 조회</button></div>}
    <div id={`${id}-detail`} className="ovi-detail" hidden={!expanded}>
      <dl className="ovi-statistics"><div className="ovi-own"><dt>{district.nameKo} 지수</dt><dd>{displayIndex(value)}</dd></div><div><dt>평균</dt><dd>{displayIndex(average)}</dd></div><div><dt>중앙값</dt><dd>{displayIndex(median)}</dd></div></dl>
      <div className="ovi-differences"><p>평균 대비<strong>{difference(value, average)}</strong></p><p>중앙값 대비<strong>{difference(value, median)}</strong></p></div>
      <p className="ovi-detail-note">{ready ? `${metricMonth(summary.baseYm)} · 전국 관측 ${data.total}개 시군구 비교` : frozen ? '저장 당시 전국 비교 자료가 없어 평균·중앙값을 표시하지 않습니다.' : '전국 비교 자료가 충분히 확인되면 평균·중앙값을 표시합니다.'}</p>
      {data && <p className="ovi-detail-note">비교 자료 수집: {new Date(data.fetchedAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}</p>}
      <section className="ovi-children" aria-label={`${definition.label}의 하위 지수`}><div className="ovi-children-heading"><h3>하위 지수 <span>{childCount}개</span></h3><span>단위: 지수</span></div>
        <DataNotice state={indices} />
        {frozen && !indices.data && <p className="ovi-detail-note">이 기록에는 하위 지수가 저장되어 있지 않습니다.</p>}
        {indices.data && <><div className="ovi-groups" data-single={definition.groups.length === 1}>{definition.groups.map((group, groupIndex) => <div className="ovi-group" key={groupIndex}>{group.label && <h4>{group.label}</h4>}<dl>{group.items.map(item => {
          const title = group.label ? `${group.label} · ${item.label}` : item.label
          return <div className="ovi-child-row" key={item.code}><dt><button type="button" className="ovi-info" aria-label={`${title} 설명`} aria-haspopup="dialog" aria-expanded={explanation?.item.code === item.code} onClick={event => onExplain({ item, title, anchor: event.currentTarget })}><Info size={9} aria-hidden="true" /></button><span>{item.label}</span></dt><dd>{displayIndex(indices.data?.groups[definition.key]?.[item.code])}</dd></div>
        })}</dl></div>)}</div><p className="ovi-detail-note">하위 지수를 평균한 값이 상위 지수입니다. 개별 값의 반올림으로 소수점 차이가 있을 수 있습니다. 실제 인원·금액·비율로 해석하지 않습니다.</p></>}
      </section>
    </div>
  </article>
}

function ExplanationBubble({ explanation, root, onClose }: { explanation: Explanation; root: RefObject<HTMLDivElement>; onClose: (restoreFocus?: boolean) => void }) {
  const bubble = useRef<HTMLDivElement>(null)
  const closeButton = useRef<HTMLButtonElement>(null)
  const id = useId()
  const [position, setPosition] = useState<{ left: number; top: number; arrow: number; below: boolean } | null>(null)
  useLayoutEffect(() => {
    if (!root.current || !bubble.current) return
    const box = root.current.getBoundingClientRect(), anchor = explanation.anchor.getBoundingClientRect()
    const width = bubble.current.offsetWidth, height = bubble.current.offsetHeight
    const center = anchor.left + anchor.width / 2 - box.left
    const left = Math.max(8, Math.min(center - width / 2, box.width - width - 8))
    const below = anchor.top - height - 12 < Math.max(80, box.top + 8)
    const desiredTop = below ? anchor.bottom - box.top + 12 : anchor.top - box.top - height - 12
    const top = Math.max(8, Math.min(desiredTop, box.height - height - 8))
    setPosition({ left, top, below, arrow: Math.max(16, Math.min(center - left - 5, width - 26)) })
  }, [explanation, root])
  // 위치 계산이 끝나 말풍선이 보인 다음 닫기 버튼으로 초점을 옮깁니다.
  useEffect(() => { if (position) closeButton.current?.focus({ preventScroll: true }) }, [position, explanation])
  useEffect(() => {
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !bubble.current?.contains(event.target) && !explanation.anchor.contains(event.target)) onClose()
    }
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.preventDefault(); onClose(true) } }
    const focusOutside = (event: FocusEvent) => {
      if (event.target instanceof Node && !bubble.current?.contains(event.target) && event.target !== explanation.anchor) onClose()
    }
    const moved = () => onClose()
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', escape)
    document.addEventListener('focusin', focusOutside)
    document.addEventListener('scroll', moved, true)
    window.addEventListener('resize', moved)
    return () => {
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('keydown', escape)
      document.removeEventListener('focusin', focusOutside)
      document.removeEventListener('scroll', moved, true)
      window.removeEventListener('resize', moved)
    }
  }, [explanation, onClose])
  return <div ref={bubble} className="ovi-bubble" role="dialog" aria-modal="false" aria-labelledby={`${id}-title`} aria-describedby={`${id}-body ${id}-caution`} data-below={position?.below} style={{ left: position?.left ?? 0, top: position?.top ?? 0, visibility: position ? 'visible' : 'hidden', '--ovi-arrow': `${position?.arrow ?? 20}px` } as CSSProperties}>
    <div className="ovi-bubble-heading"><h3 id={`${id}-title`}>{explanation.title}</h3><button ref={closeButton} type="button" aria-label="설명 닫기" onClick={() => onClose(true)}><X size={15} aria-hidden="true" /></button></div>
    <p id={`${id}-body`}>{explanation.item.description}</p><p id={`${id}-caution`} className="ovi-caution">{explanation.item.caution}</p>
  </div>
}
