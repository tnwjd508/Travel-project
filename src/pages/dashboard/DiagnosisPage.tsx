import { BrainCircuit } from 'lucide-react'
import { DashboardPageFrame } from '@/components/dashboard/DashboardPageFrame'
import { RegionRadar } from '@/components/dashboard/TourismCharts'
import { DataNotice, SourceNote } from '@/components/dashboard/DataNotice'
import { useActiveDistrict } from '@/hooks/useActiveDistrict'
import { useDistrictResource } from '@/hooks/useDistrictResource'

export function DiagnosisPage() {
  const district = useActiveDistrict()
  const state = useDistrictResource('diagnosis', { district: district.slug })
  return <DashboardPageFrame eyebrow="Regional Diagnosis" title={`${district.nameKo} 관광 지표를 진단합니다`} description="실제 관광 지수를 검토용 규칙에 적용했습니다. 인과관계나 정책 효과 예측은 아닙니다." icon={BrainCircuit}>
    <DataNotice state={state}/>
    {state.data && <><div className="grid gap-5 xl:grid-cols-2"><section className="rounded-[24px] border border-slate-200 bg-white p-6"><h2 className="text-lg font-bold">지표별 점검 · {state.data.model.version}</h2><div className="mt-4 space-y-3">{state.data.issues.map(issue => <article key={issue.id} className="rounded-xl border border-slate-100 p-4"><div className="flex items-center justify-between gap-2"><h3 className="text-sm font-bold">{issue.label}</h3><span className={`shrink-0 text-xs font-semibold ${issue.status === 'attention' ? 'text-amber-700' : 'text-slate-500'}`}>{issue.status === 'attention' ? '검토 필요' : issue.status === 'normal' ? '정상 범위' : '자료 부족'}</span></div><p className="mt-2 text-xs leading-6 text-slate-500">{issue.evidence}</p></article>)}</div></section><RegionRadar data={state.data}/></div>
    <section className="mt-5 rounded-[24px] border border-slate-200 bg-white p-6"><h2 className="text-lg font-bold">우선 검토 과제</h2><div className="mt-4 grid gap-3 md:grid-cols-3">{state.data.priorities.map((item, i) => <article key={item.issueId} className="rounded-xl bg-blue-50 p-4"><span className="text-xs font-bold text-blue-600">0{i + 1}</span><h3 className="mt-2 text-sm font-bold">{item.title}</h3><p className="mt-2 text-xs leading-6 text-slate-500">{item.evidence}</p></article>)}</div>{!state.data.priorities.length && <p className="mt-4 text-sm text-slate-500">현재 규칙에서 도출된 개선 과제가 없습니다. 자료 부족 여부를 함께 확인하세요.</p>}<SourceNote data={state.data}/></section></>}
  </DashboardPageFrame>
}
