import { diagnosisCriteria } from '@/data/tourismMetrics'
import { useEffect, useRef, useState } from 'react'
import { FileText, Printer } from 'lucide-react'
import { DashboardPageFrame } from '@/components/dashboard/DashboardPageFrame'
import { DataNotice, SourceNote } from '@/components/dashboard/DataNotice'
import { TourismIndicators } from '@/components/dashboard/OverviewTourismIndicators'
import { captureIndicatorSnapshot } from '@/services/indicatorSnapshot'
import { useActiveDistrict } from '@/hooks/useActiveDistrict'
import { useReviewData } from '@/hooks/useReviewData'
import { SavedReviewNotice } from '@/components/dashboard/SavedReviewNotice'
import { evidenceStatusLabels, formatPct, formatRange } from '@/data/festivalEffect'
import type { SummaryResponse, DiagnosisResponse, IndicatorComparisonSnapshot } from '@/types/district'
import { requireTourismDistrict } from '@/data/tourismRegions'

interface Snapshot { summary: SummaryResponse; diagnosis: DiagnosisResponse; indicators: IndicatorComparisonSnapshot; createdAt: string }
export function ReportPage() {
  const district = useActiveDistrict()
  const { saved: reviewState, summaryState, diagnosisState } = useReviewData(district.slug)
  const [saved, setSaved] = useState<Snapshot | null>(null)
  const [generating, setGenerating] = useState(false)
  const [notice, setNotice] = useState('')
  const pending = useRef<AbortController | null>(null)
  // 다른 지역으로 이동하거나 저장된 검토를 열면 진행 중인 생성을 취소합니다.
  useEffect(() => {
    setGenerating(false)
    setNotice('')
    return () => { pending.current?.abort(); pending.current = null }
  }, [district.regionId, district.slug, reviewState.requested])
  const snapshot = reviewState.requested ? null : saved && requireTourismDistrict(saved.summary.district).id === requireTourismDistrict(district.slug).id ? saved : null
  const review = reviewState.data
  const diagnosis = snapshot?.diagnosis ?? diagnosisState.data
  async function generate() {
    if (!summaryState.data || !diagnosisState.data || generating || reviewState.requested) return
    const controller = new AbortController()
    pending.current = controller
    setGenerating(true)
    setNotice('')
    // 요청 시작 시점의 요약·진단을 먼저 복사해 이후 상태 변경과 분리합니다.
    const baseline = structuredClone({ summary: summaryState.data, diagnosis: diagnosisState.data })
    try {
      const indicators = await captureIndicatorSnapshot(baseline.summary, district.regionId, controller.signal)
      if (!controller.signal.aborted) {
        setSaved({ ...baseline, indicators, createdAt: new Date().toISOString() })
        if (!indicators.indices || Object.values(indicators.ranks).some(value => value === null)) setNotice('보고서를 생성했습니다. 조회하지 못한 비교 자료는 저장 자료 없음으로 표시합니다.')
      }
    } catch {
      if (!controller.signal.aborted) setNotice('보고서를 생성하지 못했습니다. 잠시 후 다시 시도해 주세요.')
    } finally {
      if (pending.current === controller) { pending.current = null; setGenerating(false) }
    }
  }
  const indicatorState = snapshot ? { ...summaryState, status: 'live', data: snapshot.summary, error: '' } : summaryState
  return <DashboardPageFrame eyebrow="Tourism Report" title={`${district.nameKo} 관광 데이터 보고서`} description="조회한 관광 데이터와 진단 결과를 보고서로 저장합니다." icon={FileText}>
    <SavedReviewNotice state={reviewState}/>
    <div className="mb-5 flex flex-wrap justify-end gap-2 print:hidden">{!reviewState.requested && <button onClick={generate} disabled={generating || !summaryState.data || !diagnosisState.data} className="min-h-11 rounded-xl bg-blue-600 px-4 text-xs font-bold text-white disabled:opacity-50">{generating ? '비교 자료를 저장하는 중…' : snapshot ? '현재 조회값으로 다시 생성' : '보고서 생성'}</button>}<button onClick={() => window.print()} disabled={generating || (!snapshot && !review)} className="flex min-h-11 items-center gap-2 rounded-xl bg-slate-900 px-4 text-xs font-bold text-white disabled:opacity-50"><Printer size={14}/>인쇄·PDF 저장</button></div>
    {notice && <p role="status" className="mb-4 text-xs leading-6 text-slate-500 print:hidden">{notice}</p>}
    {!snapshot && <div className="mb-4 space-y-3"><DataNotice state={summaryState}/><DataNotice state={diagnosisState}/></div>}
    <article className="print-report rounded-[24px] border border-slate-200 bg-white p-6 sm:p-9"><header className="border-b border-slate-200 pb-6"><p className="text-xs font-bold text-blue-600">ON:GIL · 관광 데이터 보고서</p><h2 className="mt-3 text-2xl font-extrabold">{district.regionName} {district.nameKo}</h2><p className="mt-2 text-xs text-slate-500">{review ? `검토 저장 시각: ${new Date(review.review.created_at).toLocaleString('ko-KR')}` : snapshot ? `생성 시각: ${new Date(snapshot.createdAt).toLocaleString('ko-KR')}` : '미리보기 · 보고서 생성 전'}</p></header>
      {review && <section className="mt-6 rounded-xl border border-blue-100 p-5"><h3 className="font-bold">{review.scenario.title}</h3><p className="mt-2 text-sm">{review.scenario.budget_krw.toLocaleString('ko-KR')}원 · {review.scenario.duration_months}개월 · {review.scenario.start_month.slice(0, 7)} 시행</p><p className="mt-3 text-sm">과거 사례 참고: {evidenceStatusLabels[review.evidence.status]}</p>{review.evidence.stat && <><p className="mt-2 text-sm">외지인 방문 변화 {formatPct(review.evidence.stat.meanPct)} · 95% 구간 {formatRange(review.evidence.stat)} · {review.evidence.stat.n}건</p><p className="mt-2 text-xs leading-6 text-slate-500">{review.evidence.metadata?.method} · 자료 기간 {review.evidence.metadata?.visitorsFrom}~{review.evidence.metadata?.visitorsTo}</p><p className="mt-2 text-xs text-slate-500">과거 사례의 통계이며 이 정책의 미래 효과나 예산 대비 효율을 뜻하지 않습니다.</p></>}</section>}
      <div className="py-6"><TourismIndicators state={indicatorState} frozen={reviewState.requested || snapshot !== null} snapshot={snapshot?.indicators}/></div>
      {diagnosis && <><section className="mt-6 border-t border-slate-100 pt-6"><h3 className="text-lg font-bold">규칙 기반 점검 결과</h3><div className="mt-4 space-y-3">{diagnosis.issues.map(issue => <div key={issue.id} className="rounded-xl border border-slate-100 p-4"><p className="text-sm font-bold">{issue.label} · {issue.status === 'attention' ? '검토 필요' : issue.status === 'normal' ? '검토 기준 미해당' : '자료 부족'}</p><p className="mt-2 text-xs text-slate-500">{issue.evidence}</p>{!reviewState.requested && <p className="mt-2 text-xs leading-6 text-slate-600">{diagnosisCriteria[issue.id]}</p>}</div>)}</div></section><section className="mt-6"><h3 className="text-lg font-bold">우선 검토 과제</h3><ol className="mt-4 list-inside list-decimal space-y-3 text-sm">{diagnosis.priorities.map(item => <li key={item.issueId}>{item.title}<p className="mt-1 text-xs text-slate-500">{item.evidence}</p></li>)}</ol>{!diagnosis.priorities.length && <p className="mt-3 text-sm text-slate-500">현재 규칙에서 도출된 과제가 없습니다.</p>}<SourceNote data={diagnosis}/></section></>}
    </article>
  </DashboardPageFrame>
}
