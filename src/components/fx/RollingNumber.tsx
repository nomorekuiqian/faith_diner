'use client'

import { animate, useReducedMotion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'

// 平滑滚动数字：用于合计信仰值、点菜条总数等
export default function RollingNumber({ value, className }: { value: number; className?: string }) {
  const reduced = useReducedMotion()
  const [shown, setShown] = useState(value)
  const prev = useRef(value)

  useEffect(() => {
    const from = prev.current
    prev.current = value
    if (reduced || from === value) {
      setShown(value)
      return
    }
    const ctrl = animate(from, value, {
      duration: 0.42,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => setShown(Math.round(v))
    })
    return () => ctrl.stop()
  }, [value, reduced])

  return <span className={className}>{shown}</span>
}
