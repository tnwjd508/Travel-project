import { CalendarCheck, ChevronRight, Coins, LineChart, Timer, Users } from 'lucide-react'
import { motion } from 'framer-motion'
import { Card } from '@/components/ui/Card'

const steps=[
  {icon:CalendarCheck,title:'정책 시행',sub:'야간관광 콘텐츠 오픈',period:'M+0',color:'bg-slate-950 text-white'},
  {icon:Users,title:'관광객 증가',sub:'목표 방문객 +15%',period:'M+2',color:'bg-blue-600 text-white'},
  {icon:Timer,title:'체류시간 증가',sub:'평균 +3.5시간',period:'M+4',color:'bg-indigo-500 text-white'},
  {icon:Coins,title:'지역 소비 증가',sub:'관광 소비 +18%',period:'M+5',color:'bg-violet-500 text-white'},
  {icon:LineChart,title:'지역경제 활성화',sub:'생산유발 46억 원',period:'M+6',color:'bg-emerald-500 text-white'},
]
export function ImpactTimeline(){return <Card className="relative overflow-hidden p-6 sm:p-8"><div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-blue-100/50 blur-3xl"/><div className="relative flex flex-wrap items-start justify-between gap-3"><div><p className="text-[11px] font-bold uppercase tracking-[.15em] text-blue-600">Impact Forecast</p><h3 className="mt-1 text-xl font-bold tracking-tight">정책이 지역경제를 바꾸는 과정</h3></div><span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-bold text-slate-500">예측 기간 · 6개월</span></div><div className="relative mt-9 grid gap-4 md:grid-cols-5"><div className="absolute left-[8%] right-[8%] top-6 hidden h-px bg-gradient-to-r from-slate-200 via-blue-300 to-emerald-300 md:block"/>{steps.map((s,i)=><motion.div key={s.title} initial={{opacity:0,y:12}} whileInView={{opacity:1,y:0}} viewport={{once:true}} transition={{delay:i*.1}} className="relative flex items-center gap-3 md:block md:text-center"><div className={`relative z-10 grid h-12 w-12 shrink-0 place-items-center rounded-2xl shadow-lg md:mx-auto ${s.color}`}><s.icon size={19}/></div><div className="md:mt-4"><span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">{s.period}</span><h4 className="mt-0.5 text-sm font-bold text-slate-800">{s.title}</h4><p className="mt-1 text-[10px] text-slate-400">{s.sub}</p></div>{i<steps.length-1&&<ChevronRight size={15} className="ml-auto text-slate-300 md:hidden"/>}</motion.div>)}</div></Card>}
