'use client'

import { useEffect, useRef } from 'react'

export interface ChargeDetail {
  from: { x: number; y: number }
  to: { x: number; y: number }
  amount: number
  crit: boolean
}

type Spark = {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  age: number
  r: number
  color: string
  tx: number | null
  ty: number | null
  gravity: number
}

// 按需启动的轻量点单火花层：平时 0 RAF 占用，不拖慢页面切换和 3D 出票机
export default function EnergyField() {
  const fxRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const fx = fxRef.current
    if (!fx) return
    const f = fx.getContext('2d')
    if (!f) return

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const dpr = Math.min(1.5, window.devicePixelRatio || 1)
    let w = 0
    let h = 0
    let sparks: Spark[] = []
    let raf = 0

    const resize = () => {
      w = window.innerWidth
      h = window.innerHeight
      fx.width = w * dpr
      fx.height = h * dpr
      fx.style.width = `${w}px`
      fx.style.height = `${h}px`
      f.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    window.addEventListener('resize', resize)

    const frame = () => {
      f.clearRect(0, 0, w, h)
      const alive: Spark[] = []
      for (const s of sparks) {
        s.age++
        if (s.tx !== null && s.ty !== null && s.age > 8) {
          const dx = s.tx - s.x
          const dy = s.ty - s.y
          const d = Math.hypot(dx, dy) || 1
          const pull = Math.min(2.8, 0.14 * s.age)
          s.vx = s.vx * 0.85 + (dx / d) * pull
          s.vy = s.vy * 0.85 + (dy / d) * pull
          if (d < 16) s.age = s.life
        } else {
          s.vx *= 0.94
          s.vy = s.vy * 0.94 + s.gravity
        }
        s.x += s.vx
        s.y += s.vy
        if (s.age >= s.life) continue
        const al = 1 - s.age / s.life
        f.fillStyle = `rgba(${s.color},${al * 0.85})`
        f.beginPath()
        f.arc(s.x, s.y, s.r, 0, Math.PI * 2)
        f.fill()
        alive.push(s)
      }
      sparks = alive
      if (sparks.length > 0) {
        raf = requestAnimationFrame(frame)
      } else {
        raf = 0
      }
    }

    const kick = () => {
      if (!raf && sparks.length > 0) raf = requestAnimationFrame(frame)
    }

    const onCharge = (e: Event) => {
      if (reduce) return
      const d = (e as CustomEvent<ChargeDetail>).detail
      const count = Math.min(28, Math.max(10, d.amount * 2))
      for (let i = 0; i < count; i++) {
        const a = Math.random() * Math.PI * 2
        const s = 2.5 + Math.random() * (d.crit ? 8 : 5)
        sparks.push({
          x: d.from.x + (Math.random() - 0.5) * 60,
          y: d.from.y + (Math.random() - 0.5) * 60,
          vx: Math.cos(a) * s,
          vy: Math.sin(a) * s,
          life: 45 + Math.random() * 25,
          age: 0,
          r: 1.8 + Math.random() * 2.2,
          color: i % 3 === 0 ? '184,132,46' : '201,74,41',
          tx: d.to.x,
          ty: d.to.y,
          gravity: 0
        })
      }
      kick()
    }

    const onDoubt = (e: Event) => {
      if (reduce) return
      const d = (e as CustomEvent<{ x: number; y: number }>).detail
      for (let i = 0; i < 12; i++) {
        sparks.push({
          x: d.x + (Math.random() - 0.5) * 50,
          y: d.y + (Math.random() - 0.5) * 50,
          vx: (Math.random() - 0.5) * 2.5,
          vy: -1 - Math.random() * 2,
          life: 32 + Math.random() * 18,
          age: 0,
          r: 1.5 + Math.random() * 1.5,
          color: '130,114,98',
          tx: null,
          ty: null,
          gravity: 0.14
        })
      }
      kick()
    }

    window.addEventListener('fx:charge', onCharge)
    window.addEventListener('fx:doubt', onDoubt)
    return () => {
      if (raf) cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
      window.removeEventListener('fx:charge', onCharge)
      window.removeEventListener('fx:doubt', onDoubt)
    }
  }, [])

  return <canvas ref={fxRef} className="fx-top" aria-hidden="true" />
}
