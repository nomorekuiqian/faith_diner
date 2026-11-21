'use client'

import { motion, useSpring } from 'motion/react'
import type { ComponentProps } from 'react'

// 鼠标靠近时会被“吸”过去一点的按钮
export default function Magnetic({ strength = 0.35, ...props }: ComponentProps<typeof motion.button> & { strength?: number }) {
  const x = useSpring(0, { stiffness: 320, damping: 18 })
  const y = useSpring(0, { stiffness: 320, damping: 18 })
  return (
    <motion.button
      {...props}
      style={{ ...(props.style as object), x, y }}
      whileTap={{ scale: 0.9 }}
      onPointerMove={(e) => {
        if (e.pointerType !== 'mouse') return
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
