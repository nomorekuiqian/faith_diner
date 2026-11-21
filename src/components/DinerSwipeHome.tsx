'use client'

import { AnimatePresence } from 'motion/react'
import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { getDeviceId, loadProgress } from '@/lib/device'
import { insforge } from '@/lib/insforge'
import type { OrderResult } from '@/lib/receipt'
import type { Card, CardStat, Deck as DeckMeta, VerifyEvent } from '@/lib/types'
import Deck from './Deck'
import DinerHero from './DinerHero'
import Leaderboard from './Leaderboard'
import NextCheck from './NextCheck'
import ReceiptStage from './ReceiptStage'

interface Props {
  deck: DeckMeta
  cards: Card[]
  events: VerifyEvent[]
  stats: Record<string, CardStat>
  orders: number
}

function tableFor(device: string) {
  let h = 0
  for (const ch of device) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return `A${String((h % 28) + 1).padStart(2, '0')}`
}

export default function DinerSwipeHome({ deck, cards, events, stats, orders }: Props) {
  const faith = useMemo(() => cards.filter((c) => c.kind === 'faith'), [cards])
  const sober = useMemo(() => cards.filter((c) => c.kind === 'sober'), [cards])

  const [table, setTable] = useState('A--')
  const [orderCount, setOrderCount] = useState(orders)
  const [lastPicked, setLastPicked] = useState<Card | null>(null)
  const [pickedFaith, setPickedFaith] = useState<Card[]>([])
  const [pickedSober, setPickedSober] = useState<Card[]>([])
  const [placing, setPlacing] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [placed, setPlaced] = useState<{ order: OrderResult; dishes: Card[]; sides: Card[] } | null>(null)

  useEffect(() => {
    setTable(tableFor(getDeviceId()))
    const p = loadProgress(deck.id, 10)
    setPickedFaith(cards.filter((c) => c.kind === 'faith' && p.picks[c.id] === 1))
    setPickedSober(cards.filter((c) => c.kind === 'sober' && p.picks[c.id] === 1))

    // 空闲时提前预加载 3D 小票机模块，点击出票时不卡顿
    const timer = window.setTimeout(() => {
      void import('./PrinterStage')
    }, 1200)
    return () => window.clearTimeout(timer)
  }, [deck.id, cards])

  const total = pickedFaith.reduce((a, c) => a + c.charge, 0)

  const handlePick = useCallback((card: Card, dir: 1 | -1, nextFaith: Card[], nextSober: Card[]) => {
    if (dir === 1) setLastPicked(card)
    setPickedFaith(nextFaith)
    setPickedSober(nextSober)
  }, [])

  const checkout = useCallback(
    async (dishes: Card[], sides: Card[]) => {
      if (!dishes.length || placing) return
      setPlacing(true)
      setErr(null)
      const finalSides = sides.length ? sides : sober.slice(0, 1)
      const { data, error } = await insforge.database.rpc('place_order', {
        p_device: getDeviceId(),
        p_deck: deck.id,
        p_items: dishes.map((c) => c.id),
        p_sides: finalSides.map((c) => c.id)
      })
      setPlacing(false)
      if (error) {
        setErr(`出票失败：${error.message ?? '服务器没有响应'}`)
        return
      }
      const order = (Array.isArray(data) ? data[0] : data) as OrderResult | undefined
      if (!order) {
        setErr('出票失败，请重试一次')
        return
      }
      setOrderCount((n) => Math.max(n + 1, order.daily_seq))
      setPlaced({ order, dishes, sides: finalSides })
    },
    [deck.id, placing, sober]
  )

  return (
    <div className="menu-page">
      <DinerHero
        orderCount={orderCount}
        faithCount={faith.length}
        soberCount={sober.length}
        cartCount={pickedFaith.length}
        total={total}
        lastPicked={lastPicked}
        table={table}
      />

      <section className="arena">
        <Deck
          deckId={deck.id}
          cards={cards}
          events={events}
          initialStats={stats}
          onPick={handlePick}
          onCheckout={checkout}
        />

        <aside className="intel">
          <section className="panel">
            <h2>收银台 · 随时出票</h2>
            <p className="note" style={{ margin: '0 0 12px' }}>
              {pickedFaith.length
                ? `已右滑点了 ${pickedFaith.length} 道信仰菜（+${total} 点），不用刷完全部也能直接打小票。`
                : '右滑卡片点菜，点卡片可翻面看配料表和作废条件。'}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button
                type="button"
                className="btn main"
                disabled={!pickedFaith.length || placing}
                onClick={() => checkout(pickedFaith, pickedSober)}
              >
                {placing ? '正在出票…' : pickedFaith.length ? `打印 3D 堂食小票（+${total}）` : '先右滑点一道菜'}
              </button>
              <Link href="/menu" className="btn">
                浏览全部 {cards.length} 道完整菜单 →
              </Link>
            </div>
            {err && <p className="pad-err">{err}</p>}
          </section>

          <section className="panel">
            <h2>下一个验菜日</h2>
            <NextCheck deckId={deck.id} cards={cards} events={events} />
          </section>

          <section className="panel">
            <h2>全站人气榜</h2>
            <Leaderboard cards={cards} stats={stats} />
          </section>
        </aside>
      </section>

      <AnimatePresence>
        {placed && (
          <ReceiptStage
            order={placed.order}
            dishes={placed.dishes}
            sides={placed.sides}
            events={events}
            deckTitle={deck.title}
            table={table}
            onClose={() => setPlaced(null)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
