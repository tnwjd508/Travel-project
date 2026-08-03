import { useState } from 'react'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { BarChart3, MoreHorizontal, TrendingUp } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import data from '@/assets/data/gwangju-tourism.json'

const tabs = ['관광객 추이', '방문객 연령', '관광 유형'] as const
type Tab = typeof tabs[number]

const tooltipStyle = { border: '1px solid #e2e8f0', borderRadius: 12, boxShadow: '0 10px 30px rgba(15,23,42,.08)', fontSize: 11 }

export function TourismCharts() {
  const [tab,setTab] = useState<Tab>('관광객 추이')
  return <Card className="h-full overflow-hidden p-6 sm:p-7">
    <div className="flex flex-wrap items-center justify-between gap-4"><div><div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.15em] text-blue-600"><BarChart3 size={14}/>Tourism Data</div><h3 className="mt-1 text-lg font-bold tracking-tight">광주 관광 데이터</h3></div><button className="grid h-9 w-9 place-items-center rounded-xl border border-slate-200 text-slate-400"><MoreHorizontal size={17}/></button></div>
    <div className="mt-5 flex w-fit gap-1 rounded-xl bg-slate-100 p-1">{tabs.map(t=><button key={t} onClick={()=>setTab(t)} className={`rounded-lg px-3 py-2 text-[11px] font-bold transition ${tab===t?'bg-white text-slate-900 shadow-sm':'text-slate-400 hover:text-slate-600'}`}>{t}</button>)}</div>
    <div className="mt-5 h-[228px]">
      {tab==='관광객 추이' && <ResponsiveContainer><AreaChart data={data.monthlyVisitors} margin={{top:8,right:2,left:-28,bottom:0}}><defs><linearGradient id="visitorGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#2563EB" stopOpacity={.24}/><stop offset="100%" stopColor="#2563EB" stopOpacity={0}/></linearGradient></defs><CartesianGrid vertical={false} stroke="#EEF2F7"/><XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fontSize:10,fill:'#94A3B8'}}/><YAxis axisLine={false} tickLine={false} tick={{fontSize:10,fill:'#94A3B8'}}/><Tooltip contentStyle={tooltipStyle} formatter={(v:number)=>[`${v}만 명`,'관광객']}/><Area type="monotone" dataKey="previous" stroke="#CBD5E1" fill="transparent" strokeWidth={2} strokeDasharray="4 5"/><Area type="monotone" dataKey="visitors" stroke="#2563EB" strokeWidth={2.5} fill="url(#visitorGradient)" activeDot={{r:5,fill:'#2563EB',stroke:'#fff',strokeWidth:3}}/></AreaChart></ResponsiveContainer>}
      {tab==='방문객 연령' && <ResponsiveContainer><BarChart data={data.ageVisitors} margin={{top:8,right:0,left:-32,bottom:0}}><CartesianGrid vertical={false} stroke="#EEF2F7"/><XAxis dataKey="age" axisLine={false} tickLine={false} tick={{fontSize:10,fill:'#94A3B8'}}/><YAxis axisLine={false} tickLine={false} tick={{fontSize:10,fill:'#94A3B8'}}/><Tooltip contentStyle={tooltipStyle}/><Bar dataKey="value" radius={[7,7,2,2]}>{data.ageVisitors.map((_,i)=><Cell key={i} fill={i===1?'#2563EB':'#BFDBFE'}/>)}</Bar></BarChart></ResponsiveContainer>}
      {tab==='관광 유형' && <div className="flex h-full items-center"><div className="h-full flex-1"><ResponsiveContainer><PieChart><Pie data={data.tourismTypes} dataKey="value" innerRadius={55} outerRadius={82} paddingAngle={4} stroke="none">{data.tourismTypes.map(x=><Cell key={x.name} fill={x.color}/>)}</Pie><Tooltip contentStyle={tooltipStyle}/></PieChart></ResponsiveContainer></div><div className="w-36 space-y-3">{data.tourismTypes.map(x=><div key={x.name} className="flex items-center justify-between text-[11px]"><span className="flex items-center gap-2 text-slate-500"><i className="h-2 w-2 rounded-full" style={{background:x.color}}/>{x.name}</span><b>{x.value}%</b></div>)}</div></div>}
    </div>
    <div className="mt-3 flex items-center justify-between rounded-xl bg-blue-50/70 px-3.5 py-2.5"><span className="flex items-center gap-2 text-[11px] font-semibold text-blue-700"><TrendingUp size={14}/>10월 방문객이 가장 빠르게 증가했어요</span><b className="text-xs text-blue-700">+12.4%</b></div>
  </Card>
}

const radarData = [{x:'접근성',v:82},{x:'콘텐츠',v:68},{x:'소비력',v:77},{x:'재방문',v:61},{x:'체류',v:66},{x:'인지도',v:74}]
export function RegionRadar() {
  return <Card className="p-6 sm:p-7"><div className="flex items-start justify-between"><div><p className="text-[11px] font-bold uppercase tracking-[.15em] text-blue-600">Regional Index</p><h3 className="mt-1 text-lg font-bold">지역 경쟁력 지수</h3></div><span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-bold text-blue-600">상위 18%</span></div><div className="mt-2 h-[250px]"><ResponsiveContainer><RadarChart data={radarData} outerRadius="72%"><PolarGrid stroke="#E2E8F0"/><PolarAngleAxis dataKey="x" tick={{fontSize:10,fill:'#64748B'}}/><Radar dataKey="v" fill="#2563EB" fillOpacity={.16} stroke="#2563EB" strokeWidth={2}/></RadarChart></ResponsiveContainer></div></Card>
}
