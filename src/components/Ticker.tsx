import type { Card, VerifyEvent } from '@/lib/types'

// 顶部跑马灯：像行情条一样滚动今天的卡和最近的验证点
export default function Ticker({ cards, events, now }: { cards: Card[]; events: VerifyEvent[]; now: number }) {
  const upcoming = events
    .filter((e) => e.happens_at && Date.parse(e.happens_at) > now)
    .sort((a, b) => Date.parse(a.happens_at!) - Date.parse(b.happens_at!))
    .slice(0, 2)
    .map((e) => ({
      key: `ev-${e.key}`,
      label: e.name,
      value: `${Math.ceil((Date.parse(e.happens_at!) - now) / 86400000)} 天后验证`,
      tone: 'ev'
    }))
  const items = [
    ...upcoming,
    ...cards.map((c) => ({
      key: c.id,
      label: c.title,
      value: c.kind === 'faith' ? `+${c.charge}` : '清醒',
      tone: c.kind === 'faith' ? 'up' : 'sober'
    }))
  ]

  return (
    <div className="ticker" aria-label="今日牌组预览">
      <div className="t-track">
        {[0, 1].map((rep) => (
          <ul className="t-run" key={rep} aria-hidden={rep === 1 ? true : undefined}>
            {items.map((it) => (
              <li key={`${rep}-${it.key}`} className={it.tone}>
                <b>{it.value}</b>
                <span>{it.label}</span>
              </li>
            ))}
          </ul>
        ))}
      </div>
    </div>
  )
}
