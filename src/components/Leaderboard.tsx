import type { Card, CardStat } from '@/lib/types'

// 全站信仰榜：充值人数最多的信仰卡
export default function Leaderboard({ cards, stats }: { cards: Card[]; stats: Record<string, CardStat> }) {
  const rows = cards
    .filter((c) => c.kind === 'faith')
    .map((c) => ({ card: c, charges: stats[c.id]?.charges ?? 0, doubts: stats[c.id]?.doubts ?? 0 }))
    .sort((a, b) => b.charges - a.charges || b.card.charge - a.card.charge)
    .slice(0, 5)
  const max = Math.max(1, ...rows.map((r) => r.charges + r.doubts))
  const anyone = rows.some((r) => r.charges + r.doubts > 0)

  return (
    <ol className="board">
      {rows.map((r, i) => (
        <li key={r.card.id}>
          <span className="b-rank">{i + 1}</span>
          <div className="b-body">
            <span className="b-title">{r.card.title}</span>
            <span className="b-bar" aria-hidden="true">
              <i className="b-up" style={{ width: `${(r.charges / max) * 100}%` }} />
              <i className="b-down" style={{ width: `${(r.doubts / max) * 100}%` }} />
            </span>
          </div>
          <span className="b-num">{anyone ? r.charges : `+${r.card.charge}`}</span>
        </li>
      ))}
      {!anyone && <li className="b-empty">还没有人充值，排在前面的是面值最高的卡。</li>}
    </ol>
  )
}
