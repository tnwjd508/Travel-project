import { BrainCircuit, CalendarCheck, ChevronRight, ClipboardCheck, SearchCheck } from 'lucide-react'
import { motion } from 'framer-motion'
import { Card } from '@/components/ui/Card'
import { policyDurationMonths, policyLabels, policyTargets, type PolicyDuration, type PolicyId } from '@/data/policies'

const issueLabels: Record<string, string> = { youth: '2030 방문 지수', stay: '숙박 비중 지수', concentration: '상위 허브 집중도', spend: '관광소비강도' }

// 수치 예측이 아니라 정책 시행 후 어떤 지표를 언제 다시 볼지 정리한 측정 계획.
export function ImpactTimeline({ policy, duration }: { policy: PolicyId; duration: PolicyDuration }) {
  const months = policyDurationMonths[duration]
  const indicators = policyTargets[policy].issueIds.map(id => issueLabels[id] ?? id).join(' · ')
  const steps = [
    { icon: CalendarCheck, title: '기준선 기록', sub: `시행 직전 ${indicators} 값을 저장`, period: 'M+0', color: 'bg-slate-950 text-white' },
    { icon: SearchCheck, title: '중간 점검', sub: `같은 지표를 다시 조회해 변화 방향 확인`, period: `M+${Math.max(1, Math.round(months / 2))}`, color: 'bg-blue-600 text-white' },
    { icon: ClipboardCheck, title: '성과 점검', sub: '기준선 대비 변화와 외부 요인(계절·행사) 검토', period: `M+${months}`, color: 'bg-indigo-500 text-white' },
    { icon: BrainCircuit, title: '모델 학습 자료화', sub: '시행 조건과 결과를 효과 예측 모델의 학습 자료로 축적', period: '이후', color: 'bg-emerald-500 text-white' },
  ]
  return <Card className="relative overflow-hidden p-6 sm:p-8"><div className="relative flex flex-wrap items-start justify-between gap-3"><div><p className="text-[12px] font-bold uppercase tracking-[.15em] text-blue-600">Measurement Plan</p><h3 className="mt-1 text-xl font-bold tracking-tight">{policyLabels[policy]} 성과 측정 계획</h3></div><span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-bold text-slate-500">정책 기간 · {duration}</span></div><div className="relative mt-9 grid gap-4 md:grid-cols-4"><div className="absolute left-[10%] right-[10%] top-6 hidden h-px bg-gradient-to-r from-slate-200 via-blue-300 to-emerald-300 md:block"/>{steps.map((s,i)=><motion.div key={s.title} initial={{opacity:0,y:12}} whileInView={{opacity:1,y:0}} viewport={{once:true}} transition={{delay:i*.1}} className="relative flex items-center gap-3 md:block md:text-center"><div className={`relative z-10 grid h-12 w-12 shrink-0 place-items-center rounded-2xl shadow-lg md:mx-auto ${s.color}`}><s.icon size={19}/></div><div className="md:mt-4"><span className="text-[12px] font-bold uppercase tracking-widest text-slate-400">{s.period}</span><h4 className="mt-0.5 text-sm font-bold text-slate-800">{s.title}</h4><p className="mt-1 text-[12px] leading-4 text-slate-500">{s.sub}</p></div>{i<steps.length-1&&<ChevronRight size={15} className="ml-auto text-slate-300 md:hidden"/>}</motion.div>)}</div><p className="mt-6 text-[12px] leading-5 text-slate-500">예상 수치 대신 측정 계획을 보여줍니다. 실제 시행 결과가 쌓이면 효과 예측 모델의 근거로 사용할 수 있습니다.</p></Card>
}
