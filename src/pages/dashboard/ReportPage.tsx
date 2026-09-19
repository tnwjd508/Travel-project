import { diagnosisCriteria } from '@/data/tourismMetrics'
import { useState } from 'react'
import { FileText, Printer } from 'lucide-react'
import { DashboardPageFrame } from '@/components/dashboard/DashboardPageFrame'
import { DataNotice, SourceNote, formatValue } from '@/components/dashboard/DataNotice'
import { useActiveDistrict } from '@/hooks/useActiveDistrict'
import { useDistrictResource } from '@/hooks/useDistrictResource'
import type { SummaryResponse, DiagnosisResponse } from '@/types/district'

interface Snapshot { summary: SummaryResponse; diagnosis: DiagnosisResponse; createdAt: string }
export function ReportPage() {
  const district = useActiveDistrict()
  const summaryState = useDistrictResource('summary', { district: district.slug })
  const diagnosisState = useDistrictResource('diagnosis', { district: district.slug })
  const [saved, setSaved] = useState<Snapshot | null>(null)
  const snapshot = saved?.summary.district === district.slug ? saved : null
  const summary = snapshot?.summary ?? summaryState.data
  const diagnosis = snapshot?.diagnosis ?? diagnosisState.data
  function generate() {
    if (summaryState.data && diagnosisState.data) setSaved(structuredClone({ summary: summaryState.data, diagnosis: diagnosisState.data, createdAt: new Date().toISOString() }))
  }
  const rows = summary ? [
    ['일별 방문 추정치 월 합계', formatValue(summary.visitors.total), summary.visitors.month],
    ['관광체류강도 지수', formatValue(summary.stay.ix21, 2), summary.baseYm],
    ['관광소비강도 지수', formatValue(summary.spend.ix22, 2), summary.baseYm],
    ['관광서비스수요 지수', formatValue(summary.demand.ix11, 2), summary.baseYm],
  ] : []
  return <DashboardPageFrame eyebrow="Tourism Report" title={`${district.nameKo} 관광 데이터 보고서`} description="조회한 관광 데이터와 진단 결과를 보고서로 저장합니다." icon={FileText}>
    <div className="mb-5 flex flex-wrap justify-end gap-2 print:hidden"><button onClick={generate} disabled={!summaryState.data || !diagnosisState.data} className="min-h-11 rounded-xl bg-blue-600 px-4 text-xs font-bold text-white disabled:opacity-50">{snapshot ? '현재 조회값으로 다시 생성' : '보고서 생성'}</button><button onClick={() => window.print()} disabled={!snapshot} className="flex min-h-11 items-center gap-2 rounded-xl bg-slate-900 px-4 text-xs font-bold text-white disabled:opacity-50"><Printer size={14}/>인쇄·PDF 저장</button></div>
    {!snapshot && <div className="mb-4 space-y-3"><DataNotice state={summaryState}/><DataNotice state={diagnosisState}/></div>}
    <article className="print-report rounded-[24px] border border-slate-200 bg-white p-6 sm:p-9"><header className="border-b border-slate-200 pb-6"><p className="text-xs font-bold text-blue-600">ON:GIL · 관광 데이터 보고서</p><h2 className="mt-3 text-2xl font-extrabold">광주 {district.nameKo}</h2><p className="mt-2 text-xs text-slate-500">{snapshot ? `생성 시각: ${new Date(snapshot.createdAt).toLocaleString('ko-KR')}` : '미리보기 · 보고서 생성 전'}</p></header>
      <section className="grid gap-3 py-6 sm:grid-cols-2 xl:grid-cols-4">{rows.map(([label,value,month]) => <div key={label} className="rounded-xl bg-slate-50 p-4"><h3 className="text-xs text-slate-500">{label}</h3><p className="mt-2 text-xl font-bold">{value}</p><p className="mt-2 text-[11px] text-slate-500">기준월 {month}</p></div>)}</section>
      {summary && <SourceNote data={summary}/>}
      {diagnosis && <><section className="mt-6 border-t border-slate-100 pt-6"><h3 className="text-lg font-bold">규칙 기반 점검 결과</h3><div className="mt-4 space-y-3">{diagnosis.issues.map(issue => <div key={issue.id} className="rounded-xl border border-slate-100 p-4"><p className="text-sm font-bold">{issue.label} · {issue.status === 'attention' ? '검토 필요' : issue.status === 'normal' ? '검토 기준 미해당' : '자료 부족'}</p><p className="mt-2 text-xs text-slate-500">{issue.evidence}</p><p className="mt-2 text-xs leading-6 text-slate-600">{diagnosisCriteria[issue.id]}</p></div>)}</div></section><section className="mt-6"><h3 className="text-lg font-bold">우선 검토 과제</h3><ol className="mt-4 list-inside list-decimal space-y-3 text-sm">{diagnosis.priorities.map(item => <li key={item.issueId}>{item.title}<p className="mt-1 text-xs text-slate-500">{item.evidence}</p></li>)}</ol>{!diagnosis.priorities.length && <p className="mt-3 text-sm text-slate-500">현재 규칙에서 도출된 과제가 없습니다.</p>}<SourceNote data={diagnosis}/></section></>}
    </article>
  </DashboardPageFrame>
}
