'use client'

import { useEffect, useState } from 'react'
import type { Card, CardStat, VerifyEvent } from '@/lib/types'
import { usePicks } from './usePicks'

interface Props {
  deckId: string
  cards: Card[]
  events: VerifyEvent[]
  stats: Record<string, CardStat>
}

export default function CalendarList({ deckId, cards, events, stats }: Props) {
  const picks = usePicks(deckId)
  const [now, setNow] = useState<number | null>(null)
  useEffect(() => setNow(Date.now()), [])

  const dated = events.filter((e) => e.happens_at)
  const ongoing = events.filter((e) => !e.happens_at)
  const nextAt =
    now === null
      ? null
      : dated
          .map((e) => Date.parse(e.happens_at!))
          .filter((t) => t > now)
          .sort((a, b) => a - b)[0] ?? null

  const item = (e: VerifyEvent) => {
    const linked = cards.filter((c) => c.event_keys.includes(e.key))
    const believers = linked
      .filter((c) => c.kind === 'faith')
      .reduce((a, c) => a + (stats[c.id]?.charges ?? 0), 0)
    let countdown = ''
    if (e.happens_at && now !== null) {
      const d = Math.ceil((Date.parse(e.happens_at) - now) / 86400000)
      countdown = d > 0 ? `还有 ${d} 天` : '已到期，待结算'
    }
    const isNext = nextAt !== null && e.happens_at !== null && Date.parse(e.happens_at) === nextAt
    return (
      <li key={e.key} className={isNext ? 'is-next' : undefined}>
        <span className="node" aria-hidden="true" />
        <div className={`dt${e.happens_at ? '' : ' ongo'}`}>
          {e.happens_at ? e.short_label : '持续'}
          <small>{e.happens_at ? e.when_label : '没有固定日期'}</small>
        </div>
        <div>
          <h3>{e.name}</h3>
          <div className="cd">
            {[countdown, believers ? `全站累计 ${believers} 次充值押在这里` : ''].filter(Boolean).join('，')}
          </div>
          <div className="cards">
            {linked.length ? (
              linked.map((c) => {
                const p = picks[c.id]
                const cls = p === 1 ? 'chipc on' : p === -1 ? 'chipc no' : 'chipc'
                return (
                  <span key={c.id} className={cls}>
                    {c.kind === 'faith' ? <em>+{c.charge}</em> : <em>清醒</em>}
                    {c.title}
                  </span>
                )
              })
            ) : (
              <span className="note">没有关联的卡</span>
            )}
          </div>
        </div>
      </li>
    )
  }

  return (
    <>
      <div className="legend">
        <span className="chipc on">已充值</span>
        <span className="chipc no">存疑</span>
        <span className="chipc">还没刷到</span>
      </div>
      <h2>有日期的</h2>
      <ul className="tl">{dated.map(item)}</ul>
      <h2>持续盯的指标</h2>
      <ul className="tl">{ongoing.map(item)}</ul>
    </>
  )
}
