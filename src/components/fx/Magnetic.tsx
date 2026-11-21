'use client'

import { motion, useReducedMotion, useSpring } from 'motion/react'
import type { ComponentProps } from 'react'

// 鼠标靠近时会被“吸”过去一点的按钮（克制幅度 + 尊重减少动效设置）
export default function Magnetic({ strength = 0.2, ...props }: ComponentProps<typeof motion.button> & { strength?: number }) {
  const reduced = useReducedMotion()
  const x = useSpring(0, { stiffness: 320, damping: 22 })
  const y = useSpring(0, { stiffness: 320, damping: 22 })
  return (
    <motion.button
      {...props}
      style={{ ...(props.style as object), x, y }}
      whileTap={reduced ? undefined : { scale: 0.97 }}
      onPointerMove={(e) => {
        if (reduced || e.pointerType !== 'mouse') return
        const r = e.currentTarget.getBoundingClientRect()
        x.set((e.clientX - (r.left + r.width / 2)) * strength)
        y.set((e.clientY - (r.top + r.height / 2)) * strength)
      }}
      onPointerLeave={() => {
        x.set(0)
        y.set(0)
      }}
    />
  )
}
