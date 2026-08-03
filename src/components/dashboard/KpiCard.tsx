import { ArrowDownRight, ArrowUpRight, type LucideIcon } from 'lucide-react'
import { motion } from 'framer-motion'
import { Line, LineChart, ResponsiveContainer } from 'recharts'
import { useCountUp } from '@/hooks/useCountUp'
import { Card } from '@/components/ui/Card'

export function KpiCard({ label, value, suffix, decimals=0, change, icon: Icon, data, delay=0 }: { label:string; value:number; suffix:string; decimals?:number; change:number; icon:LucideIcon; data:number[]; delay?:number }) {
  const count = useCountUp(value)
  const positive = change >= 0
  return <motion.div initial={{opacity:0,y:16}} animate={{opacity:1,y:0}} transition={{delay,duration:.5}} whileHover={{y:-4}}><Card className="group relative overflow-hidden p-5 hover:border-blue-100 hover:shadow-[0_18px_45px_rgba(37,99,235,.1)]">
    <div className="flex items-start justify-between"><div className="grid h-10 w-10 place-items-center rounded-xl bg-slate-50 text-slate-500 transition group-hover:bg-blue-50 group-hover:text-blue-600"><Icon size={19}/></div><span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold ${positive?'bg-emerald-50 text-emerald-600':'bg-red-50 text-red-500'}`}>{positive?<ArrowUpRight size={11}/>:<ArrowDownRight size={11}/>} {Math.abs(change)}%</span></div>
    <p className="mt-5 text-xs font-semibold text-slate-400">{label}</p><div className="mt-1 flex items-baseline gap-1"><strong className="text-[28px] font-bold tracking-[-.04em] text-slate-950">{count.toLocaleString('ko-KR',{minimumFractionDigits:decimals,maximumFractionDigits:decimals})}</strong><span className="text-xs font-bold text-slate-500">{suffix}</span></div>
    <div className="absolute bottom-4 right-3 h-10 w-24 opacity-55"><ResponsiveContainer><LineChart data={data.map((v,i)=>({i,v}))}><Line type="monotone" dataKey="v" stroke={positive?'#2563EB':'#EF4444'} strokeWidth={2} dot={false}/></LineChart></ResponsiveContainer></div>
  </Card></motion.div>
}
