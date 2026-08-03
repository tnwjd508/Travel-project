import { useEffect, useState } from 'react'

export function useCountUp(target: number, duration = 1200) {
  const [value, setValue] = useState(0)
  useEffect(() => {
    let frame = 0
    const start = performance.now()
    const animate = (now: number) => {
      const progress = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 4)
      setValue(target * eased)
      if (progress < 1) frame = requestAnimationFrame(animate)
    }
    frame = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(frame)
  }, [target, duration])
  return value
}
