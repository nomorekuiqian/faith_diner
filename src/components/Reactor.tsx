'use client'

import { motion } from 'motion/react'
import { forwardRef } from 'react'

interface Props {
  shown: number
  balance: number
  pop: number
  streak: number
  index: number
  total: number
  doubts: number
  sober: number
}

const R = 96
const C = 2 * Math.PI * R
const TICKS = 60

// 信仰反应堆：圆形仪表，余额越高金环越满
const Reactor = forwardRef<HTMLDivElement, Props>(function Reactor(
  { shown, balance, pop, streak, index, total, doubts, sober },
  ref
) {
  const pct = Math.max(0, Math.min(100, balance))
  const lit = Math.round((pct / 100) * TICKS)
  const full = pct >= 100

  return (
    <div className={`reactor${full ? ' is-full' : ''}`}>
      <div className="gauge" ref={ref}>
        <div className="g-orbit" aria-hidden="true" />
        <svg viewBox="0 0 240 240" aria-hidden="true">
          <defs>
            <linearGradient id="fr-gold" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#fff0b8" />
              <stop offset="50%" stopColor="#f5c04a" />
              <stop offset="100%" stopColor="#c27f00" />
            </linearGradient>
            <radialGradient id="fr-core">
              <stop offset="0%" stopColor="#f5c04a" stopOpacity={0.1 + pct / 300} />
              <stop offset="75%" stopColor="#f5c04a" stopOpacity={0} />
            </radialGradient>
          </defs>
          <circle cx="120" cy="120" r="84" fill="url(#fr-core)" />
          {Array.from({ length: TICKS }, (_, i) => (
            <line
              key={i}
              className={i < lit ? 'tick on' : 'tick'}
              x1="120"
              y1="4"
              x2="120"
              y2={i % 5 === 0 ? 14 : 10}
              transform={`rotate(${i * 6} 120 120)`}
            />
          ))}
          <circle className="g-track" cx="120" cy="120" r={R} />
          <circle className="g-val" cx="120" cy="120" r={R} strokeDasharray={C} strokeDashoffset={C * (1 - pct / 100)} />
        </svg>
        <div className="g-core">
          <motion.span
            key={pop}
            className="g-num"
            initial={pop ? { scale: 1.5, filter: 'brightness(1.8)' } : false}
            animate={{ scale: 1, filter: 'brightness(1)' }}
            transition={{ type: 'spring', stiffness: 300, damping: 12 }}
          >
            {shown}
          </motion.span>
          <span className="g-lab">{full ? '信仰已充满' : '信仰余额'}</span>
        </div>
      </div>

      <dl className="r-stats">
        <div className={streak >= 2 ? 'hot' : undefined}>
          <dt>连充</dt>
          <dd>×{streak}</dd>
        </div>
        <div>
          <dt>存疑</dt>
          <dd>{doubts}</dd>
        </div>
        <div>
          <dt>清醒</dt>
          <dd>{sober}</dd>
        </div>
        <div>
          <dt>进度</dt>
          <dd>
            {Math.min(index + 1, total)}
            <small>/{total}</small>
          </dd>
        </div>
      </dl>
    </div>
  )
})

export default Reactor
