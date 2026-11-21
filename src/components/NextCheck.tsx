'use client'

import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState } from 'react'
import type { Card, VerifyEvent } from '@/lib/types'
import { usePicks } from './usePicks'

function Tile({ value, label }: { value: number; label: string }) {
  const text = String(value).padStart(2, '0')
  return (
    <div className="tile">
      <span className="tile-face">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={text}
            initial={{ y: '-70%', opacity: 0, rotateX: -80 }}
            animate={{ y: 0, opacity: 1, rotateX: 0 }}
            exit={{ y: '70%', opacity: 0, rotateX: 80 }}
            transition={{ type: 'spring', stiffness: 260, damping: 22 }}
          >
            {text}
          </motion.span>
        </AnimatePresence>
      </span>
      <small>{label}</small>
    </div>
  )
}

// 最近一个有日期的验证点：翻牌倒计时 + 关联卡片
export default function NextCheck({ deckId, cards, events }: { deckId: string; cards: Card[]; events: VerifyEvent[] }) {
  const picks = usePicks(deckId)
  const [now, setNow] = useState<number | null>(null)
  useEffect(() => {
    setNow(Date.now())
    const t = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(t)
  }, [])

  const upcoming = events
    .filter((e) => e.happens_at && (now === null || Date.parse(e.happens_at) > now))
    .sort((a, b) => Date.parse(a.happens_at!) - Date.parse(b.happens_at!))
  if (!upcoming.length) return <div className="next"><p className="nm">暂时没有排期中的验证点</p></div>

  const first = upcoming[0]
  const same = upcoming.filter((e) => e.short_label === first.short_label)
  const linked = cards.filter((c) => c.kind === 'faith' && c.event_keys.some((k) => same.some((e) => e.key === k)))
  const mine = linked.filter((c) => picks[c.id] === 1).length
  const left = now === null ? 0 : Math.max(0, Date.parse(first.happens_at!) - now)
  const d = Math.floor(left / 86400000)
  const h = Math.floor((left % 86400000) / 3600000)
  const m = Math.floor((left % 3600000) / 60000)
  const s = Math.floor((left % 60000) / 1000)

  return (
    <div className="next">
      <div className="tiles" aria-label={`还有 ${d} 天 ${h} 小时 ${m} 分`}>
        <Tile value={d} label="天" />
        <Tile value={h} label="时" />
        <Tile value={m} label="分" />
        <Tile value={s} label="秒" />
      </div>
      <p className="nm">{same.map((e) => e.name).join('，')}</p>
      <p className="tm">{same.map((e) => e.when_label).join('；')}</p>
      <p className="lk">
        这一天会检验 {linked.length} 张信仰卡
        {mine > 0 && (
          <>
            ，其中 <b>{mine} 张是你充值的</b>
          </>
        )}
      </p>
    </div>
  )
}
