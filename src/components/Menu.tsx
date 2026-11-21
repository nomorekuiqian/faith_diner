'use client'

import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { insforge } from '@/lib/insforge'
import { getDeviceId, tableFor } from '@/lib/device'
import { courseOf, dishName } from '@/lib/dish'
import type { OrderResult } from '@/lib/receipt'
import type { Card, CardStat, Deck, VerifyEvent } from '@/lib/types'
import DishSheet from './DishSheet'
import OrderBar from './OrderBar'
import OrderSlip from './OrderSlip'
import ReceiptStage from './ReceiptStage'
import Sheet from './Sheet'
import { sfx } from './fx/sound'

interface Props {
  deck: Deck
  cards: Card[]
  events: VerifyEvent[]
  stats: Record<string, CardStat>
  orders: number
}

interface PlacedOrder {
  order: OrderResult
  dishes: Card[]
  sides: Card[]
}

const ALL = '全部'

function IconPlus() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}
function IconCheck() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  )
}

// 全部菜单：像墙上的餐牌，按菜系分组，每道菜一行
export default function Menu({ deck, cards, events, stats: initialStats }: Props) {
  const reduced = useReducedMotion()
  const evMap = useMemo(() => Object.fromEntries(events.map((e) => [e.key, e])), [events])
  const evText = useCallback(
    (card: Card) =>
      card.event_keys
        .map((k) => evMap[k])
        .filter(Boolean)
        .sort((a, b) => a.sort - b.sort)
        .map((e) => `${e.name}（${e.when_label}）`)
        .join('；'),
    [evMap]
  )

  const faith = useMemo(() => cards.filter((c) => c.kind === 'faith'), [cards])
  const sober = useMemo(() => cards.filter((c) => c.kind === 'sober'), [cards])
  // 菜系按出现顺序排，凉菜放最后
  const groups = useMemo(() => {
    const order: string[] = []
    const map = new Map<string, Card[]>()
    for (const c of [...faith, ...sober]) {
      const k = courseOf(c)
      if (!map.has(k)) {
        map.set(k, [])
        order.push(k)
      }
      map.get(k)!.push(c)
    }
    return order.map((k) => ({ course: k, cards: map.get(k)! }))
  }, [faith, sober])

  const [cart, setCart] = useState<string[]>([])
  const [sides, setSides] = useState<string[]>([])
  const [skipAuto, setSkipAuto] = useState(false)
  const [filter, setFilter] = useState(ALL)
  const [detail, setDetail] = useState<Card | null>(null)
  const [stats, setStats] = useState(initialStats)
  const [placing, setPlacing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [placed, setPlaced] = useState<PlacedOrder | null>(null)
  const [table, setTable] = useState<string | null>(null)
  const [slipOpen, setSlipOpen] = useState(false)

  useEffect(() => {
    setTable(tableFor(getDeviceId()))
    const timer = window.setTimeout(() => {
      void import('./PrinterStage')
    }, 1500)
    return () => window.clearTimeout(timer)
  }, [])

  const cartCards = useMemo(() => cart.map((id) => faith.find((c) => c.id === id)).filter(Boolean) as Card[], [cart, faith])
  const total = cartCards.reduce((a, c) => a + c.charge, 0)

  // 没自己加凉菜时，主厨按点的菜送一道相关的
  const autoSide = useMemo(() => {
    if (sides.length || !cartCards.length || skipAuto) return null
    const keys = new Set(cartCards.flatMap((c) => c.event_keys))
    return sober.find((s) => s.event_keys.some((k) => keys.has(k))) ?? sober[0] ?? null
  }, [sides, cartCards, sober, skipAuto])
  const sideCards = useMemo(
    () => (sides.length ? (sides.map((id) => sober.find((c) => c.id === id)).filter(Boolean) as Card[]) : autoSide ? [autoSide] : []),
    [sides, sober, autoSide]
  )

  const has = (card: Card) => (card.kind === 'faith' ? cart.includes(card.id) : sideCards.some((s) => s.id === card.id))

  const add = (card: Card) => {
    if (card.kind === 'faith') {
      if (cart.includes(card.id)) return
      setCart((c) => [...c, card.id])
      sfx.coin()
    } else {
      if (sides.includes(card.id)) return
      setSides((s) => Array.from(new Set([...(s.length ? s : autoSide ? [autoSide.id] : []), card.id])))
      sfx.sober()
    }
  }

  const remove = (card: Card) => {
    if (card.kind === 'faith') setCart((c) => c.filter((id) => id !== card.id))
    else if (autoSide && autoSide.id === card.id && !sides.length) setSkipAuto(true)
    else setSides((s) => s.filter((id) => id !== card.id))
    sfx.doubt()
  }

  const toggle = (card: Card) => (has(card) ? remove(card) : add(card))

  const placeOrder = async () => {
    if (!cart.length || placing) return
    setPlacing(true)
    setError(null)
    const { data, error } = await insforge.database.rpc('place_order', {
      p_device: getDeviceId(),
      p_deck: deck.id,
      p_items: cart,
      p_sides: sideCards.map((s) => s.id)
    })
    setPlacing(false)
    if (error) {
      setError(`落单失败：${error.message ?? '服务器没有响应'}，请再试一次`)
      return
    }
    const order = (Array.isArray(data) ? data[0] : data) as OrderResult | undefined
    if (!order) {
      setError('落单失败：没有拿到单号，请再试一次')
      return
    }
    const dishes = order.items.map((id) => faith.find((c) => c.id === id)).filter(Boolean) as Card[]
    const sideList = order.sides.map((id) => sober.find((c) => c.id === id)).filter(Boolean) as Card[]
    setStats((prev) => {
      const next = { ...prev }
      for (const id of [...order.items, ...order.sides]) {
        const cur = next[id] ?? { card_id: id, charges: 0, doubts: 0 }
        next[id] = { ...cur, charges: cur.charges + 1 }
      }
      return next
    })
    setSlipOpen(false)
    setPlaced({ order, dishes, sides: sideList })
  }

  const closeReceipt = useCallback(() => {
    setPlaced(null)
    setCart([])
    setSides([])
    setSkipAuto(false)
  }, [])
  const closeDetail = useCallback(() => setDetail(null), [])
  const closeSlip = useCallback(() => setSlipOpen(false), [])

  const shown = filter === ALL ? groups : groups.filter((g) => g.course === filter)

  const slip = (
    <OrderSlip table={table} dishes={cartCards} gifts={sideCards} total={total} placing={placing} error={error} onPlace={placeOrder} onRemove={remove} />
  )

  return (
    <section className="mn">
      <header className="mn-head">
        <h1>全部菜单</h1>
        <p className="ds-muted">
          {faith.length} 道信仰菜，{sober.length} 道凉菜免费送
        </p>
      </header>

      <nav className="mn-chips" aria-label="菜系">
        {[ALL, ...groups.map((g) => g.course)].map((t) => {
          const active = filter === t
          return (
            <button key={t} type="button" className="ds-chip" aria-pressed={active} onClick={() => setFilter(t)}>
              {active && (
                <motion.span
                  className="ds-chip-pill"
                  layoutId="mn-chip-pill"
                  transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 32 }}
                  aria-hidden="true"
                />
              )}
              <span className="ds-chip-label">{t}</span>
            </button>
          )
        })}
      </nav>

      <div className="mn-grid">
        <div className="mn-list">
          {shown.map((g, idx) => (
            <motion.section
              key={`${filter}-${g.course}`}
              className="mn-sec ds-board"
              aria-label={g.course}
              initial={reduced ? false : { opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.36, delay: Math.min(idx * 0.05, 0.2), ease: [0.22, 1, 0.36, 1] }}
            >
              <h2 className="mn-sec-title">
                {g.course}
                <span>{g.cards.length} 道</span>
              </h2>
              <ul className="mn-rows">
                {g.cards.map((c) => {
                  const picked = has(c)
                  const isFaith = c.kind === 'faith'
                  return (
                    <li key={c.id} className={`mn-row${picked ? ' is-picked' : ''}`}>
                      <button type="button" className="mn-row-main" onClick={() => setDetail(c)}>
                        <span className="ds-row">
                          <span className="ds-row-name mn-name">{dishName(c)}</span>
                          {isFaith && c.charge >= 12 && <span className="ds-badge">推荐</span>}
                          <span className="ds-row-dots" />
                          {isFaith ? <span className="ds-row-price mn-price">{c.charge}</span> : <span className="ds-row-free">免费</span>}
                        </span>
                        <span className="mn-claim">{c.title}</span>
                        <span className="mn-meta">已售 {stats[c.id]?.charges ?? 0}</span>
                      </button>
                      <button
                        type="button"
                        className={`ds-add${isFaith ? '' : ' ds-add--sober'}`}
                        aria-pressed={picked}
                        aria-label={picked ? `退掉 ${dishName(c)}` : `点 ${dishName(c)}`}
                        onClick={() => toggle(c)}
                      >
                        <AnimatePresence mode="wait" initial={false}>
                          <motion.span
                            key={picked ? 'check' : 'plus'}
                            className="ds-add-ico"
                            initial={reduced ? false : { scale: 0.5, rotate: picked ? -45 : 45, opacity: 0 }}
                            animate={{ scale: 1, rotate: 0, opacity: 1 }}
                            exit={reduced ? undefined : { scale: 0.5, rotate: picked ? 45 : -45, opacity: 0 }}
                            transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
                          >
                            {picked ? <IconCheck /> : <IconPlus />}
                          </motion.span>
                        </AnimatePresence>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </motion.section>
          ))}
        </div>
        <aside className="mn-side">{slip}</aside>
      </div>

      <OrderBar className="mn-orderbar" count={cartCards.length} total={total} placing={placing} onOpen={() => setSlipOpen(true)} onPlace={placeOrder} />

      <Sheet open={slipOpen} label="点菜单" onClose={closeSlip}>
        {slip}
      </Sheet>

      <Sheet open={Boolean(detail)} label={detail ? dishName(detail) : '菜品说明'} onClose={closeDetail}>
        {detail && (
          <DishSheet
            card={detail}
            stat={stats[detail.id]}
            evText={evText(detail)}
            picked={has(detail)}
            onToggle={() => {
              toggle(detail)
              setDetail(null)
            }}
            onClose={closeDetail}
          />
        )}
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
            onClose={closeReceipt}
          />
        )}
      </AnimatePresence>
    </section>
  )
}
