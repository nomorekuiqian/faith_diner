'use client'

import { motion, useReducedMotion } from 'motion/react'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { dishName } from '@/lib/dish'
import type { Card, CardStat, VerifyEvent } from '@/lib/types'

type Mode = 'hot' | 'split' | 'doubt'

const MODES: { key: Mode; label: string }[] = [
  { key: 'hot', label: '最多人信' },
  { key: 'split', label: '分歧最大' },
  { key: 'doubt', label: '最多存疑' }
]

// 全店风向看板：下一场未来事件 + 大家都在信什么 / 吵什么
export default function Chalkboard({ cards, events, stats }: { cards: Card[]; events: VerifyEvent[]; stats: Record<string, CardStat> }) {
  const reduced = useReducedMotion()
  const [now, setNow] = useState<number | null>(null)
  const [mode, setMode] = useState<Mode>('hot')
  useEffect(() => setNow(Date.now()), [])

  const next =
    now === null
      ? null
      : events.filter((e) => e.happens_at && Date.parse(e.happens_at) > now).sort((a, b) => Date.parse(a.happens_at!) - Date.parse(b.happens_at!))[0] ?? null
  const days = next && now !== null ? Math.max(0, Math.ceil((Date.parse(next.happens_at!) - now) / 86400000)) : null

  const faithRows = useMemo(
    () =>
      cards
        .filter((c) => c.kind === 'faith')
        .map((c) => {
          const charges = stats[c.id]?.charges ?? 0
          const doubts = stats[c.id]?.doubts ?? 0
          const total = charges + doubts
          const ratio = total > 0 ? Math.round((charges / total) * 100) : null
          // 分歧度：有票数且认同率越接近 50% 越高
          const splitScore = total >= 2 ? total * (1 - Math.abs(charges / total - 0.5) * 1.8) : -1
          return { c, charges, doubts, total, ratio, splitScore }
        }),
    [cards, stats]
  )

  const list = useMemo(() => {
    const copy = [...faithRows]
    if (mode === 'hot') {
      copy.sort((a, b) => b.charges - a.charges || b.c.charge - a.c.charge)
    } else if (mode === 'split') {
      copy.sort((a, b) => b.splitScore - a.splitScore || b.total - a.total || b.c.charge - a.c.charge)
    } else {
      copy.sort((a, b) => b.doubts - a.doubts || a.charges - b.charges || b.c.charge - a.c.charge)
    }
    return copy.slice(0, 4)
  }, [faithRows, mode])

  return (
    <section className="ds-chalk" aria-label="全店信仰风向与未来事件">
      <div className="ds-chalk-head">
        <h2>
          <i className="ds-chalk-dot" aria-hidden="true" />
          全店风向
        </h2>
        <Link className="ds-chalk-more" href="/calendar">
          未来事件 →
        </Link>
      </div>

      {next ? (
        <Link className="chalk-next chalk-next-link" href="/calendar">
          <span className="ds-chalk-big">{next.short_label}</span>
          <div>
            <p>{next.name}</p>
            <p className="chalk-dim">{days === 0 ? '今天揭晓 · 点看说明' : `还有 ${days} 天 · 点看说明`}</p>
          </div>
        </Link>
      ) : (
        <p className="chalk-dim">{now === null ? ' ' : '近期暂无排期事件'}</p>
      )}

      <hr className="ds-chalk-sep" />

      <div className="chalk-tabs" role="tablist" aria-label="全店观点排行维度">
        {MODES.map((m) => (
          <button
            key={m.key}
            type="button"
            role="tab"
            aria-selected={mode === m.key}
            className={`chalk-tab${mode === m.key ? ' is-on' : ''}`}
            onClick={() => setMode(m.key)}
          >
            {m.label}
          </button>
        ))}
      </div>

      <ol className="chalk-rank">
        {list.map(({ c, charges, doubts, total, ratio }, i) => {
          let meta = `${c.charge} 信仰`
          if (mode === 'hot') meta = charges ? `${charges} 人信${ratio !== null ? ` · ${ratio}%` : ''}` : `待表态`
          else if (mode === 'split') meta = total ? `${charges} 信 / ${doubts} 疑` : `待表态`
          else meta = doubts ? `${doubts} 人存疑` : `暂无存疑`

          return (
            <motion.li
              key={`${mode}-${c.id}`}
              initial={reduced ? false : { opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.28, delay: i * 0.04, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="chalk-rank-top">
                <i>{i + 1}</i>
                <span title={c.title}>{dishName(c)}</span>
                <small>{meta}</small>
              </div>
              <p className="chalk-rank-claim">{c.title}</p>
              {ratio !== null && (
                <div className="chalk-bar" aria-hidden="true">
                  <span style={{ transform: `scaleX(${Math.max(0.04, ratio / 100)})` }} />
                </div>
              )}
            </motion.li>
          )
        })}
      </ol>
    </section>
  )
}
