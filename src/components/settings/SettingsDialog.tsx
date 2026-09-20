import { useEffect, useRef } from 'react'
import { Check, Monitor, Moon, Sun, X } from 'lucide-react'
import { useTheme, type ThemePreference } from './ThemeProvider'

const options = [
  { value: 'light', title: '일반', description: '밝고 깔끔한 화면', icon: Sun },
  { value: 'dark', title: '다크', description: '눈이 편안한 어두운 화면', icon: Moon },
  { value: 'system', title: '기기 설정에 맞춤', description: '기기의 밝은·어두운 테마를 따라요', icon: Monitor },
] as const

export function SettingsDialog({ onClose, returnFocusTo }: { onClose: () => void; returnFocusTo: HTMLElement | null }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const { preference, setPreference } = useTheme()

  useEffect(() => {
    const element = dialog.current!
    const previousOverflow = document.body.style.overflow
    // 기본 dialog가 배경 클릭·키보드 접근을 차단하고 창 안에서 초점을 이동시킵니다.
    element.showModal()
    document.body.style.overflow = 'hidden'
    return () => {
      element.close()
      document.body.style.overflow = previousOverflow
      if (returnFocusTo?.isConnected) returnFocusTo.focus()
    }
  }, [returnFocusTo])

  return <dialog ref={dialog} className="settings-dialog" aria-labelledby="settings-title" aria-describedby="settings-description"
    onCancel={event => { event.preventDefault(); onClose() }}
    onKeyDown={event => {
      if (event.key === 'Escape') event.stopPropagation()
      if (event.key !== 'Tab') return
      // 첫 버튼과 마지막 버튼 사이를 순환하여 키보드 초점이 창 밖으로 빠지지 않게 합니다.
      const controls = event.currentTarget.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled])')
      const first = controls[0]
      const last = controls[controls.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last?.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first?.focus()
      }
    }}
    onClick={event => {
      // 창 내부의 빈 여백이 아니라 실제 바깥 영역을 클릭했을 때만 닫습니다.
      const rect = event.currentTarget.getBoundingClientRect()
      if (event.target === event.currentTarget && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) onClose()
    }}>
    <div className="flex items-start justify-between gap-4">
      <div><p className="settings-eyebrow">나에게 맞는 화면</p><h2 id="settings-title" className="mt-1 text-2xl font-bold tracking-tight">설정</h2></div>
      <button type="button" autoFocus onClick={onClose} className="settings-close" aria-label="설정 닫기"><X size={20} /></button>
    </div>
    <p id="settings-description" className="settings-description mt-3 text-sm leading-6">보기 편한 테마를 선택해 주세요. 선택하면 바로 적용됩니다.</p>
    <fieldset className="mt-7">
      <legend className="mb-3 text-sm font-bold">화면 테마</legend>
      <div className="space-y-2.5">
        {options.map(({ value, title, description, icon: Icon }) => <label key={value} className="theme-option">
          <input type="radio" name="screen-theme" value={value} checked={preference === value}
            onChange={event => setPreference(event.target.value as ThemePreference)} className="sr-only" />
          <span className="theme-option-icon"><Icon size={20} aria-hidden="true" /></span>
          <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{title}</span><span className="theme-option-description mt-1 block text-xs leading-5">{description}</span></span>
          <span className="theme-option-check" aria-hidden="true">{preference === value && <Check size={14} strokeWidth={3} />}</span>
        </label>)}
      </div>
    </fieldset>
    <p className="settings-description mt-5 text-xs leading-5">선택한 테마는 이 브라우저에서 다음 접속에도 유지됩니다.</p>
    <div className="settings-footer mt-6 flex justify-end border-t pt-5"><button type="button" onClick={onClose} className="min-h-11 rounded-xl bg-blue-600 px-6 text-sm font-semibold text-white hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500">완료</button></div>
  </dialog>
}
