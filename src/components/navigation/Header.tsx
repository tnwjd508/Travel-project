import { Bell, CalendarDays, ChevronDown, Compass, Menu, Search, Sparkles } from 'lucide-react'
import { useState } from 'react'

export function Header() {
  const [searchOpen, setSearchOpen] = useState(false)
  return <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-[#F8FAFC]/80 backdrop-blur-2xl">
    <div className="mx-auto flex h-[82px] max-w-[1580px] items-center gap-3 px-4 sm:px-6 lg:px-8">
      <button className="grid h-10 w-10 place-items-center rounded-xl bg-slate-950 text-white lg:hidden" aria-label="메뉴"><Menu size={19}/></button>
      <div className="mr-auto flex items-center gap-3"><div className="hidden h-9 w-9 place-items-center rounded-xl bg-slate-950 text-white sm:grid lg:hidden"><Compass size={18}/></div><div><div className="flex items-center gap-1.5"><span className="text-[19px] font-extrabold tracking-[-.06em] text-slate-950">ON<span className="text-blue-600">:</span>GIL</span><span className="rounded-full border border-blue-100 bg-blue-50 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-blue-600">AI</span></div><p className="hidden text-[10px] font-medium tracking-tight text-slate-400 sm:block">지역 관광전략 수립 플랫폼</p></div></div>
      <button className="hidden h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-600 shadow-sm md:flex"><CalendarDays size={15} className="text-slate-400"/>2026. 08. 03</button>
      <button className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-800 shadow-sm"><span className="h-2 w-2 rounded-full bg-blue-500 shadow-[0_0_0_4px_#dbeafe]"/>광주광역시<ChevronDown size={14} className="text-slate-400"/></button>
      <div className={`hidden h-10 items-center rounded-xl border border-slate-200 bg-white transition-all sm:flex ${searchOpen ? 'w-56 px-3' : 'w-10 justify-center'}`}><Search size={17} className="shrink-0 cursor-pointer text-slate-400" onClick={()=>setSearchOpen(!searchOpen)}/>{searchOpen && <input autoFocus placeholder="데이터 검색" className="ml-2 min-w-0 bg-transparent text-xs outline-none"/>}</div>
      <button className="relative hidden h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-500 sm:grid" aria-label="알림"><Bell size={17}/><span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-blue-500 ring-2 ring-white"/></button>
      <div className="hidden items-center gap-2 pl-1 xl:flex"><div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-xs font-bold text-white">광주</div><div className="leading-tight"><p className="text-xs font-bold">정책 담당자</p><p className="text-[10px] text-slate-400">광주관광공사</p></div></div>
    </div>
    <div className="pointer-events-none absolute left-[38%] top-0 h-px w-32 bg-gradient-to-r from-transparent via-blue-500 to-transparent"/>
  </header>
}
