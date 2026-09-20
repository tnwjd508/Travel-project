import { createContext, useContext, useEffect, useLayoutEffect, useState, type ReactNode } from 'react'

export type ThemePreference = 'light' | 'dark' | 'system'
const storageKey = 'ongil-theme'
const mediaQuery = '(prefers-color-scheme: dark)'
const isPreference = (value: unknown): value is ThemePreference => value === 'light' || value === 'dark' || value === 'system'

function readPreference(): ThemePreference {
  try {
    const value = localStorage.getItem(storageKey)
    return isPreference(value) ? value : 'light'
  } catch { return 'light' }
}

const ThemeContext = createContext<{ preference: ThemePreference; setPreference: (value: ThemePreference) => void } | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setState] = useState<ThemePreference>(readPreference)
  const [systemDark, setSystemDark] = useState(() => window.matchMedia(mediaQuery).matches)
  const resolved = preference === 'system' ? (systemDark ? 'dark' : 'light') : preference

  // 화면이 그려지기 전에 저장된 테마를 적용해 흰 화면이 잠깐 나타나는 현상을 줄입니다.
  useLayoutEffect(() => { document.documentElement.dataset.theme = resolved }, [resolved])
  useEffect(() => {
    const media = window.matchMedia(mediaQuery)
    const updateSystem = () => setSystemDark(media.matches)
    const syncStorage = (event: StorageEvent) => {
      if (event.key === storageKey || event.key === null) setState(readPreference())
    }
    updateSystem()
    media.addEventListener('change', updateSystem)
    window.addEventListener('storage', syncStorage)
    return () => {
      media.removeEventListener('change', updateSystem)
      window.removeEventListener('storage', syncStorage)
    }
  }, [])

  const setPreference = (value: ThemePreference) => {
    setState(value)
    // 저장이 차단된 브라우저에서도 현재 화면의 테마 선택은 계속 작동합니다.
    try { localStorage.setItem(storageKey, value) } catch { /* 현재 방문 동안만 유지합니다. */ }
  }
  return <ThemeContext.Provider value={{ preference, setPreference }}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('테마 제공자 안에서 사용해야 합니다.')
  return context
}
