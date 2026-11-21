'use client'

import { AnimatePresence } from 'motion/react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { getDeviceId, loadProgress, tableFor } from '@/lib/device'
import { insforge } from '@/lib/insforge'
import type { OrderResult } from '@/lib/receipt'
import type { Card, CardStat, Deck as DeckMeta, VerifyEvent } from '@/lib/types'
import BossBanner from './BossBanner'
import Chalkboard from './Chalkboard'
import Deck from './Deck'
import OrderBar from './OrderBar'
import OrderSlip from './OrderSlip'
import ReceiptStage from './ReceiptStage'
import Sheet from './Sheet'

interface Props {
  deck: DeckMeta
  cards: Card[]
  events: VerifyEvent[]
  stats: Record<string, CardStat>
  orders: number
}

// 首页：老板一句话 → 今日推介（翻牌点菜）→ 点菜单和小黑板；手机上点菜单收进底部点菜条
export default function DinerSwipeHome({ deck, cards, events, stats, orders }: Props) {
  const sober = useMemo(() => cards.filter((c) => c.kind === 'sober'), [cards])

  const [table, setTable] = useState<string | null>(null)
  const [orderCount, setOrderCount] = useState(orders)
  const [lastPicked, setLastPicked] = useState<Card | null>(null)
  const [pickedFaith, setPickedFaith] = useState<Card[]>([])
  const [pickedSober, setPickedSober] = useState<Card[]>([])
  const [placing, setPlacing] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [sheet, setSheet] = useState(false)
  const [placed, setPlaced] = useState<{ order: OrderResult; dishes: Card[]; sides: Card[] } | null>(null)
  const [introOpen, setIntroOpen] = useState(true)

  useEffect(() => {
    try {
      if (window.localStorage.getItem('fr_intro_hidden') === '1') setIntroOpen(false)
    } catch {
      /* 忽略 */
    }
    setTable(tableFor(getDeviceId()))
    const p = loadProgress(deck.id, 10)
    setPickedFaith(cards.filter((c) => c.kind === 'faith' && p.picks[c.id] === 1))
    setPickedSober(cards.filter((c) => c.kind === 'sober' && p.picks[c.id] === 1))
    // 空闲时预加载 3D 小票机，落单时不卡
    const timer = window.setTimeout(() => {
      void import('./PrinterStage')
    }, 1500)
    return () => window.clearTimeout(timer)
  }, [deck.id, cards])

  const closeSheet = useCallback(() => setSheet(false), [])

  const total = pickedFaith.reduce((a, c) => a + c.charge, 0)
  // 自己记下的凉菜都送；一道都没记下时，按落单规则送第一道
  const gifts = useMemo(
    () => (pickedFaith.length ? (pickedSober.length ? pickedSober : sober.slice(0, 1)) : []),
    [pickedFaith.length, pickedSober, sober]
  )

  const handlePick = useCallback((card: Card, dir: 1 | -1, nextFaith: Card[], nextSober: Card[]) => {
    setLastPicked(dir === 1 ? card : null)
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
        setErr(`落单失败：${error.message ?? '服务器没有响应'}，请再试一次`)
        return
      }
      const order = (Array.isArray(data) ? data[0] : data) as OrderResult | undefined
      if (!order) {
        setErr('落单失败：没有拿到单号，请再试一次')
        return
      }
      setSheet(false)
      setOrderCount((n) => Math.max(n + 1, order.daily_seq))
      setPlaced({ order, dishes, sides: finalSides })
    },
    [deck.id, placing, sober]
  )

  const place = () => checkout(pickedFaith, pickedSober)

  const hideIntro = () => {
    setIntroOpen(false)
    try {
      window.localStorage.setItem('fr_intro_hidden', '1')
    } catch {
      /* 忽略 */
    }
  }

  return (
    <div className="home">
      {introOpen && (
        <section className="home-intro" aria-label="玩法与用途说明">
          <div className="home-intro-head">
            <div>
              <h1>大跌的时候不要慌，来美股信仰食堂充值信仰</h1>
              <p>选择你认为相信的信仰，打一张小票保存到本地，未来回头来验证</p>
            </div>
            <button type="button" className="home-intro-x" onClick={hideIntro} aria-label="收起说明">
              知道了
            </button>
          </div>
          <ol className="home-steps">
            <li>
              <b>01 挑观点</b>
              <span>认同就右滑加入，不信就左滑跳过，点卡片能看数据依据</span>
            </li>
            <li>
              <b>02 存小票</b>
              <span>点结账打出你的专属小票，存到手机或电脑，以后回头对照</span>
            </li>
            <li>
              <b>03 看共识</b>
              <span>看看大家都信哪几条、分歧最大的是什么，心里更有底</span>
            </li>
          </ol>
        </section>
      )}
      <div className="home-grid">
        <div className="home-main">
          <BossBanner count={pickedFaith.length} total={total} last={lastPicked} orders={orderCount} />
          <Deck deckId={deck.id} cards={cards} events={events} initialStats={stats} onPick={handlePick} onCheckout={checkout} />
        </div>
        <aside className="home-side">
          <div className="home-slip">
            <OrderSlip table={table} dishes={pickedFaith} gifts={gifts} total={total} placing={placing} error={err} onPlace={place} />
          </div>
          <Chalkboard cards={cards} events={events} stats={stats} />
        </aside>
      </div>

      {/* 手机：底部点菜条 */}
      <OrderBar className="home-orderbar" count={pickedFaith.length} total={total} placing={placing} onOpen={() => setSheet(true)} onPlace={place} />

      <Sheet open={sheet} label="点菜单" onClose={closeSheet}>
        <OrderSlip table={table} dishes={pickedFaith} gifts={gifts} total={total} placing={placing} error={err} onPlace={place} />
      </Sheet>

      <AnimatePresence>
        {placed && (
          <ReceiptStage
            order={placed.order}
            dishes={placed.dishes}
            sides={placed.sides}
            events={events}
            deckTitle={deck.title}
            table={table ?? 'A--'}
            onClose={() => setPlaced(null)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
