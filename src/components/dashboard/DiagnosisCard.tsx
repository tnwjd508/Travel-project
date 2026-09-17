import { AlertTriangle, ArrowRight, Bot, CheckCircle2, Eye, Moon, Users, WandSparkles } from 'lucide-react'
import { motion } from 'framer-motion'
import { Card } from '@/components/ui/Card'

const issues = [
  { icon: Users, title: '2030 관광객 감소', desc: '전년 대비 6.8% 하락', tone: 'text-red-500 bg-red-50' },
  { icon: Moon, title: '야간 관광 콘텐츠 부족', desc: '18시 이후 소비 비중 14%', tone: 'text-amber-500 bg-amber-50' },
  { icon: AlertTriangle, title: '핵심 관광지 집중', desc: '상위 3개소 방문의 67%', tone: 'text-violet-500 bg-violet-50' },
  { icon: Eye, title: '숨은 관광지 저인지', desc: '잠재 방문 수요 21만 명', tone: 'text-blue-500 bg-blue-50' },
]

export function DiagnosisCard() {
  return <Card className="h-full overflow-hidden p-6 sm:p-7">
    <div className="flex items-center justify-between"><div className="flex items-center gap-3"><div className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-200"><Bot size={22}/></div><div><p className="text-[11px] font-bold uppercase tracking-[.15em] text-blue-600">AI Diagnosis</p><h3 className="mt-0.5 text-lg font-bold tracking-tight">지금 해결해야 할 4가지</h3></div></div><WandSparkles size={19} className="text-blue-500"/></div>
    <div className="mt-7 space-y-2.5">{issues.map((issue,i)=><motion.div key={issue.title} initial={{opacity:0,x:-10}} whileInView={{opacity:1,x:0}} viewport={{once:true}} transition={{delay:i*.08}} className="group flex items-center gap-3.5 rounded-2xl border border-transparent bg-slate-50/70 p-3.5 transition hover:border-slate-200 hover:bg-white hover:shadow-sm"><div className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${issue.tone}`}><issue.icon size={17}/></div><div className="min-w-0 flex-1"><p className="text-sm font-bold text-slate-800">{issue.title}</p><p className="mt-0.5 text-[11px] text-slate-400">{issue.desc}</p></div><ArrowRight size={15} className="text-slate-300 transition group-hover:translate-x-1 group-hover:text-blue-500"/></motion.div>)}</div>
    <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-5"><div className="flex items-center gap-2 text-xs font-semibold text-emerald-600"><CheckCircle2 size={15}/>AI 분석 완료</div><span className="text-[10px] text-slate-400">신뢰도 94.8%</span></div>
  </Card>
}
