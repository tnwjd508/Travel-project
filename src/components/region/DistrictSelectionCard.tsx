import { ArrowRight, BarChart3, Landmark, MapPinned } from 'lucide-react'
import { motion } from 'framer-motion'
import type { GwangjuDistrict } from '@/data/gwangjuDistricts'
import { useDistrictResource } from '@/hooks/useDistrictResource'
import { DataNotice, SourceNote, formatValue } from '@/components/dashboard/DataNotice'

export function DistrictSelectionCard({ district, onConfirm }: { district: GwangjuDistrict; onConfirm: () => void }) {
  const summary = useDistrictResource('summary', { district: district.slug })
  const contents = useDistrictResource('contents', { district: district.slug, contentTypeId: '12' })
  return (
    <motion.article
      key={district.slug}
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      transition={{ duration: .32, ease: [0.16, 1, 0.3, 1] }}
      className="overflow-hidden rounded-[22px] border border-blue-100 bg-white p-5 shadow-[0_16px_45px_rgba(37,99,235,.1)]"
    >
      <p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-blue-600">선택된 지역</p>
      <div className="mt-2 flex items-end justify-between gap-3">
        <div><h2 className="text-2xl font-extrabold tracking-[-.04em] text-slate-950">{district.nameKo}</h2><p className="mt-1 text-[10px] font-semibold text-slate-400">{district.nameEn}</p></div>
        <span className="rounded-full bg-blue-50 px-3 py-1.5 text-[10px] font-bold text-blue-700">선택 완료</span>
      </div>
      <p className="mt-4 text-xs leading-5 text-slate-600">{district.description}</p>

      <dl className="mt-5 grid grid-cols-2 gap-2.5">
        <div className="rounded-xl bg-slate-50 p-3"><dt className="flex items-center gap-1.5 text-[9px] font-semibold text-slate-400"><Landmark size={12} />관광 유형</dt><dd className="mt-1.5 text-xs font-bold text-slate-800">{district.tourismType}</dd></div>
        <div className="rounded-xl bg-slate-50 p-3"><dt className="flex items-center gap-1.5 text-[9px] font-semibold text-slate-400"><BarChart3 size={12} />관광서비스수요 지수</dt><dd className="mt-1.5 text-sm font-extrabold text-blue-600">{formatValue(summary.data?.demand.ix11, 2)}</dd></div>
        <div className="col-span-2 rounded-xl bg-slate-50 p-3"><dt className="flex items-center gap-1.5 text-[9px] font-semibold text-slate-400"><MapPinned size={12} />등록 관광지 콘텐츠</dt><dd className="mt-1.5 text-sm font-extrabold text-slate-800">{contents.data ? `${contents.data.totalCount}개` : '확인 중'}</dd></div>
      </dl>
      <DataNotice state={summary}/><DataNotice state={contents}/>
      {summary.data && <SourceNote data={summary.data}/>}
      {contents.data && <p className="mt-2 text-[10px] text-slate-500">관광지 목록: {contents.data.source} · 현재 조회 목록</p>}

      <button
        type="button"
        onClick={onConfirm}
        className="group mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-xs font-bold text-white shadow-lg shadow-blue-200 outline-none transition hover:-translate-y-0.5 hover:bg-blue-700 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
      >
        {district.nameKo} 관광전략 분석하기
        <ArrowRight size={15} className="transition-transform group-hover:translate-x-1" aria-hidden="true" />
      </button>
    </motion.article>
  )
}
