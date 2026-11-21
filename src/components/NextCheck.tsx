'use client'

import { useEffect, useState } from 'react'
import type { Card, VerifyEvent } from '@/lib/types'
import { usePicks } from './usePicks'

// 最近一个有日期的验证点，以及它关联的卡片里有几张本机已充值
export default function NextCheck({ deckId, cards, events }: { deckId: string; cards: Card[]; events: VerifyEvent[] }) {
  const picks = usePicks(deckId)
  const [now, setNow] = useState<number | null>(null)
  useEffect(() => setNow(Date.now()), [])

  if (now === null) return <div className="next" aria-busy="true" />

  const upcoming = events
    .filter((e) => e.happens_at && Date.parse(e.happens_at) > now)
    .sort((a, b) => Date.parse(a.happens_at!) - Date.parse(b.happens_at!))
  if (!upcoming.length) return <div className="next"><span className="nm">暂时没有排期中的验证点</span></div>

  const first = upcoming[0]
  const same = upcoming.filter((e) => e.short_label === first.short_label)
  const linked = cards.filter((c) => c.kind === 'faith' && c.event_keys.some((k) => same.some((e) => e.key === k)))
  const mine = linked.filter((c) => picks[c.id] === 1).length
  const days = Math.max(0, Math.ceil((Date.parse(first.happens_at!) - now) / 86400000))

  return (
    <div className="next">
      <div className="day">
        {days}
        <small>天后</small>
      </div>
      <div className="nm">{same.map((e) => e.name).join('，')}</div>
      <div className="tm">{same.map((e) => e.when_label).join('；')}</div>
      <div className="lk">
        关联 {linked.length} 张信仰卡
        {mine > 0 && (
          <>
            ，其中 <b>{mine} 张你已充值</b>
          </>
        )}
      </div>
    </div>
  )
}
