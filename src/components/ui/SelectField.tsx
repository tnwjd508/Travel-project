import * as Select from '@radix-ui/react-select'
import { Check, ChevronDown } from 'lucide-react'

export function SelectField({ value, onValueChange, options }: { value: string; onValueChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return <Select.Root value={value} onValueChange={onValueChange}>
    <Select.Trigger className="flex h-12 w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-4 text-left text-sm font-semibold text-slate-800 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"><Select.Value /><Select.Icon><ChevronDown size={16} /></Select.Icon></Select.Trigger>
    <Select.Portal><Select.Content position="popper" sideOffset={6} className="z-50 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-xl border border-slate-200 bg-white p-1 shadow-xl"><Select.Viewport>{options.map(o => <Select.Item key={o.value} value={o.value} className="relative flex cursor-pointer select-none items-center rounded-lg py-2.5 pl-9 pr-3 text-sm font-medium text-slate-700 outline-none data-[highlighted]:bg-blue-50 data-[highlighted]:text-blue-700"><Select.ItemIndicator className="absolute left-3"><Check size={14}/></Select.ItemIndicator><Select.ItemText>{o.label}</Select.ItemText></Select.Item>)}</Select.Viewport></Select.Content></Select.Portal>
  </Select.Root>
}
