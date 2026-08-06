import { BrainCircuit } from 'lucide-react'
import { DashboardPageFrame } from '@/components/dashboard/DashboardPageFrame'
import { DiagnosisCard } from '@/components/dashboard/DiagnosisCard'
import { RegionRadar } from '@/components/dashboard/TourismCharts'

const priorities = [
  { rank: '01', title: '야간 체류 콘텐츠 확장', evidence: '18시 이후 관광 소비 비중 14%', tone: 'bg-blue-600' },
  { rank: '02', title: '2030 맞춤 문화예술 경험', evidence: '청년층 방문객 전년 대비 6.8% 감소', tone: 'bg-indigo-500' },
  { rank: '03', title: '숨은 관광지 분산 연결', evidence: '상위 3개 관광지 방문 집중도 67%', tone: 'bg-violet-500' },
]

export function DiagnosisPage() {
  return <DashboardPageFrame eyebrow="AI Regional Diagnosis" title="광주 관광의 핵심 문제를 진단합니다" description="관광 활성화 지수와 데이터 근거를 바탕으로 우선 개선 과제를 도출했습니다." icon={BrainCircuit}>
    <div className="grid gap-5 xl:grid-cols-[.9fr_1.1fr]"><DiagnosisCard/><RegionRadar/></div>
    <section className="mt-5 rounded-[24px] border border-white/80 bg-white/80 p-6 shadow-card backdrop-blur-xl sm:p-7"><div><p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-blue-600">Priority Actions</p><h2 className="mt-1 text-lg font-bold tracking-tight">AI 우선 개선 과제</h2></div><div className="mt-5 grid gap-3 md:grid-cols-3">{priorities.map((priority) => <article key={priority.rank} className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4"><div className={`grid h-8 w-8 place-items-center rounded-lg text-[10px] font-bold text-white ${priority.tone}`}>{priority.rank}</div><h3 className="mt-4 text-sm font-bold text-slate-800">{priority.title}</h3><p className="mt-1.5 text-[11px] leading-5 text-slate-400">{priority.evidence}</p></article>)}</div></section>
  </DashboardPageFrame>
}
