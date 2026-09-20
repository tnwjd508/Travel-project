import { useState } from 'react'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Card } from '@/components/ui/Card'
import { useActiveDistrict } from '@/hooks/useActiveDistrict'
import { useDistrictResource } from '@/hooks/useDistrictResource'
import { DataNotice, SourceNote, formatValue } from './DataNotice'
import { contentCategoryName } from '@/data/contentCategories'
import { metricMonth } from '@/data/tourismMetrics'
import type { DiagnosisResponse } from '@/types/district'

const tabs = ['방문 추이', '연령 지수', '콘텐츠 구성', '연관 관광지'] as const
const colors = ['#2563eb', '#0891b2', '#059669', '#d97706', '#7c3aed', '#64748b']
export function TourismCharts() {
  const [tab, setTab] = useState<typeof tabs[number]>('방문 추이')
  const district = useActiveDistrict()
  const visitors = useDistrictResource('visitors', { district: district.slug, months: 12 }, tab === '방문 추이')
  const indices = useDistrictResource('indices', { district: district.slug }, tab === '연령 지수')
  const contents = useDistrictResource('contents', { district: district.slug }, tab === '콘텐츠 구성')
  const related = useDistrictResource('related', { district: district.slug }, tab === '연관 관광지')
  const active = tab === '방문 추이' ? visitors : tab === '연령 지수' ? indices : tab === '콘텐츠 구성' ? contents : related
  const series = visitors.data?.series.map((point, index) => ({ month: `${point.ym.slice(2, 4)}.${point.ym.slice(4)}`, current: point.total, previous: visitors.data?.previousYear[index]?.total })) ?? []
  const contentMix = contents.data?.typeShare.map(item => ({ ...item, name: contentCategoryName(item.category) })) ?? []
  const ages = indices.data ? Array.from({ length: 7 }, (_, i) => ({ age: i === 6 ? '70대 이상' : `${(i + 1) * 10}대`, value: indices.data!.groups.touristDiversity[`310${i + 1}`] })) : []
  // 차트 옆에 같은 자료의 순위를 적어 표만 덩그러니 놓이지 않게 한다.
  const ageRank = ages.filter(item => item.value != null)
    .map(item => ({ label: item.age, value: item.value as number }))
    .sort((a, b) => b.value - a.value)
  const visitorRank = (visitors.data?.series ?? []).filter(point => point.total != null)
    .map(point => ({ label: `${point.ym.slice(0, 4)}년 ${Number(point.ym.slice(4))}월`, value: point.total as number }))
    .sort((a, b) => b.value - a.value).slice(0, 5)

  return <Card className="p-5 sm:p-7">
    <h2 className="text-lg font-bold">{district.nameKo} 관광 데이터</h2>
    <div className="mt-4 flex flex-wrap gap-1" role="tablist" aria-label="관광 데이터 유형">{tabs.map(item => <button key={item} role="tab" aria-selected={tab === item} onClick={() => setTab(item)} className={`min-h-11 rounded-lg px-3 text-xs font-bold ${tab === item ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}>{item}</button>)}</div>
    <div className="mt-5 min-h-[240px]" role="tabpanel" aria-label={tab}>
      <DataNotice state={active}/>
      {tab === '방문 추이' && visitors.data && <><div className="grid items-stretch gap-4 lg:grid-cols-[1fr_230px]"><div className="h-48 lg:h-auto lg:min-h-[192px]"><ResponsiveContainer><AreaChart data={series} margin={{ top: 5, right: 8, bottom: 0, left: 0 }}><CartesianGrid stroke="#e2e8f0" vertical={false}/><XAxis dataKey="month" tick={{ fontSize: 9 }} interval={0}/><YAxis width={65} tick={{ fontSize: 10 }} domain={[0, 7000000]} ticks={[0, 1000000, 2000000, 3000000, 4000000, 5000000, 6000000, 7000000]} tickFormatter={value => `${(value / 10000).toFixed(0)}만`}/><Tooltip formatter={(value: number) => formatValue(value)}/><Area name="전년 동월" type="monotone" dataKey="previous" stroke="#94a3b8" strokeWidth={1.2} fill="transparent" connectNulls={false}/><Area name="일별 추정치 합계" type="monotone" dataKey="current" stroke="#2563eb" strokeWidth={1.6} fill="#dbeafe" fillOpacity={.5} connectNulls={false}/></AreaChart></ResponsiveContainer></div><RankList title="월 합계 상위" unit="" rows={visitorRank} decimals={0}/></div><div className="grid gap-4 lg:grid-cols-[1fr_230px]"><p className="-mt-1 pl-[65px] pr-2 text-xs text-slate-500 lg:text-center">일별 방문 추정치 월 합계 · 파랑: 해당 연도 / 회색: 전년 동월</p></div></>}
      {tab === '연령 지수' && indices.data && <><div className="grid items-stretch gap-4 lg:grid-cols-[1fr_230px]"><div className="h-48 lg:h-auto lg:min-h-[192px]"><ResponsiveContainer><BarChart data={ages}><CartesianGrid vertical={false}/><XAxis dataKey="age" tick={{ fontSize: 10 }}/><YAxis tick={{ fontSize: 10 }} width={55}/><Tooltip formatter={(value: number) => [`${formatValue(value, 2)} (지수)`, '연령별 방문 지수']}/><Bar dataKey="value" name="연령별 방문 지수" fill="#2563eb" radius={[5, 5, 0, 0]}/></BarChart></ResponsiveContainer></div><RankList title="지수 높은 순" unit="지수" rows={ageRank} decimals={2}/></div><div className="grid gap-4 lg:grid-cols-[1fr_230px]"><p className="-mt-1 pl-[55px] pr-2 text-xs text-slate-500 lg:text-center">각 연령대의 지수이며 방문자 수가 아닙니다. 연령대끼리 더하거나 비교하는 값이 아닙니다.</p></div></>}
      {tab === '콘텐츠 구성' && contents.data && (contents.data.totalCount ? <><p className="mb-3 text-xs leading-6 text-slate-500">조회 시점의 등록 콘텐츠 {contents.data.totalCount.toLocaleString()}건 기준 · 구성비 = 해당 분류 콘텐츠 수 ÷ 전체 등록 콘텐츠 수 × 100</p><div className="grid gap-4 sm:grid-cols-2"><div className="h-48"><ResponsiveContainer><PieChart><Pie data={contentMix} dataKey="pct" nameKey="name" innerRadius={55} outerRadius={90}>{contentMix.map((item, i) => <Cell key={item.category} fill={colors[i % colors.length]}/>)}</Pie><Tooltip formatter={(value: number) => `${value.toFixed(1)}%`}/></PieChart></ResponsiveContainer></div><ul className="space-y-2 py-4">{contentMix.map(item => <li key={item.category} className="flex justify-between text-xs"><span>{item.name}</span><span>{item.count}건 · {item.pct.toFixed(1)}%</span></li>)}</ul></div></> : <p className="py-8 text-sm text-slate-500">등록된 관광 콘텐츠가 없습니다.</p>)}
      {tab === '연관 관광지' && related.data && <div className="space-y-3"><p className="text-sm">상위 3개 허브의 연관 건수 비중: <strong>{formatValue(related.data.top3Share, 2)}{related.data.top3Share !== null && '%'}</strong></p>{related.data.hubs.length ? related.data.hubs.map(hub => <div key={hub.tAtsCd} className="flex justify-between rounded-xl bg-slate-50 p-3 text-xs"><span>{hub.name}</span><span>{hub.relatedCount}건 · {hub.share.toFixed(1)}%</span></div>) : <p className="text-xs text-slate-500">연관 관광지 자료가 없습니다.</p>}</div>}
    </div>
    {active.data && <SourceNote data={active.data}/>}
  </Card>
}

export function RegionRadar({ data }: { data?: DiagnosisResponse }) {
  const district = useActiveDistrict()
  const [showRank, setShowRank] = useState(false)
  const rank = useDistrictResource('rank', { district: district.slug, metric: '21' }, showRank)
  return <Card className="p-5 sm:p-7"><h2 className="text-lg font-bold">관광 지수 6축</h2><p className="mt-2 text-xs text-slate-500">자체 활성화 지수: {formatValue(data?.activationIndex, 2)} · 검토용 단순평균</p>
    {data && data.radar.every(axis => axis.value !== null) ? <div className="mt-3 h-56"><ResponsiveContainer><RadarChart data={data.radar} outerRadius="60%"><PolarGrid/><PolarAngleAxis dataKey="label" tick={{ fontSize: 9 }}/><Radar name="지수" dataKey="value" stroke="#2563eb" fill="#2563eb" fillOpacity={.16}/><Tooltip/></RadarChart></ResponsiveContainer></div> : <p className="py-8 text-xs text-slate-500">6축 데이터가 모두 제공되면 레이더를 표시합니다.</p>}
    <button onClick={() => setShowRank(value => !value)} className="min-h-11 text-xs font-semibold text-blue-700">{showRank ? '순위 접기' : '전국 관측 시군구 내 체류지수 순위 확인'}</button>
    {showRank && <><DataNotice state={rank}/>{rank.data && <><p className="text-xs leading-6 text-slate-500">{metricMonth(rank.data.baseYm)} 관광체류강도 지수가 높은 순서입니다. 값이 관측된 시군구만 포함하며 동점은 같은 순위입니다.</p><p className="text-sm font-bold">{rank.data.rank === null ? '순위 자료 부족' : `${rank.data.total}개 관측 시군구 중 ${rank.data.rank}위`}</p><SourceNote data={rank.data}/></>}</>}
  </Card>
}

function RankList({ title, rows, unit, decimals }: { title: string; rows: { label: string; value: number }[]; unit: string; decimals: number }) {
  if (!rows.length) return null
  return <div>
    <p className="-mt-3 mb-2 text-[12px] font-bold text-slate-600">{title}</p>
    <ol className="space-y-1.5">
      {rows.map((row, index) => (
        <li key={row.label} className={`flex items-center gap-2 rounded-xl px-3 py-2 ${index === 0 ? 'bg-blue-50' : 'bg-slate-50'}`}>
          <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-md text-[11px] font-bold ${index === 0 ? 'bg-blue-600 text-white' : 'bg-white text-slate-500'}`}>{index + 1}</span>
          <span className="flex-1 text-[12px] font-semibold text-slate-700">{row.label}</span>
          <span className="text-[12px] tabular-nums text-slate-600">{formatValue(row.value, decimals)}{unit && ` ${unit}`}</span>
        </li>
      ))}
    </ol>
  </div>
}
