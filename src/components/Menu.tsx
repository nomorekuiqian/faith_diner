'use client'

import { AnimatePresence, motion } from 'motion/react'
import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { insforge } from '@/lib/insforge'
import { getDeviceId } from '@/lib/device'
import type { OrderResult } from '@/lib/receipt'
import type { Card, CardStat, Deck, VerifyEvent } from '@/lib/types'
import HoloCard, { type HoloHandle } from './HoloCard'
import DinerHero from './DinerHero'
import ReceiptStage from './ReceiptStage'
import { sfx } from './fx/sound'
import type { ChargeDetail } from './fx/EnergyField'

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

function tableFor(device: string) {
  let h = 0
  for (const ch of device) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return `A${String((h % 28) + 1).padStart(2, '0')}`
}

function blurb(card: Card) {
  const row = card.rows.find(([label]) => label !== '详情')
  return row ? row[1] : ''
}

function IconPlus() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}
function IconCheck() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  )
}

export default function Menu({ deck, cards, events, stats: initialStats, orders }: Props) {
  const evMap = useMemo(() => Object.fromEntries(events.map((e) => [e.key, e])), [events])
  const firstEvent = useCallback(
    (card: Card) =>
      card.event_keys
        .map((k) => evMap[k])
        .filter(Boolean)
        .sort((a, b) => a.sort - b.sort)[0],
    [evMap]
  )
  const evText = useCallback(
    (card: Card) =>
      card.event_keys
        .map((k) => evMap[k])
        .filter(Boolean)
        .map((e) => `${e.name}（${e.when_label}）`)
        .join('；'),
    [evMap]
  )

  const faith = useMemo(() => cards.filter((c) => c.kind === 'faith'), [cards])
  const sober = useMemo(() => cards.filter((c) => c.kind === 'sober'), [cards])
  const tags = useMemo(() => Array.from(new Set(faith.map((c) => c.tag))), [faith])
  const soberTag = sober[0]?.tag ?? '清醒避坑'

  const [cart, setCart] = useState<string[]>([])
  const [sides, setSides] = useState<string[]>([])
  const [lastPicked, setLastPicked] = useState<Card | null>(null)
  const [skipAuto, setSkipAuto] = useState(false)
  const [filter, setFilter] = useState<string>('全部')
  const [seed, setSeed] = useState(0)
  const [detail, setDetail] = useState<Card | null>(null)
  const [detailKey, setDetailKey] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [stats, setStats] = useState(initialStats)
  const [orderCount, setOrderCount] = useState(orders)
  const [placing, setPlacing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [placed, setPlaced] = useState<PlacedOrder | null>(null)
  const [table, setTable] = useState('A--')
  const [sheet, setSheet] = useState(false)
  const [bump, setBump] = useState(0)
  const [reduced, setReduced] = useState(false)

  const totalRef = useRef<HTMLDivElement | null>(null)
  const barRef = useRef<HTMLButtonElement | null>(null)
  const detailCard = useRef<HoloHandle | null>(null)

  useEffect(() => {
    setTable(tableFor(getDeviceId()))
    try {
      setReduced(window.matchMedia('(prefers-reduced-motion: reduce)').matches)
    } catch {
      /* 忽略 */
    }
    const timer = window.setTimeout(() => {
      void import('./PrinterStage')
    }, 1200)
    return () => window.clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (!detail) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDetail(null)
      else if (e.key === 'ArrowRight') detailCard.current?.fling(1)
      else if (e.key === 'ArrowLeft') detailCard.current?.fling(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [detail])

  const cartCards = useMemo(() => cart.map((id) => faith.find((c) => c.id === id)).filter(Boolean) as Card[], [cart, faith])
  const total = cartCards.reduce((a, c) => a + c.charge, 0)

  // 没选小菜时，主厨按点的主菜挑一道相关的清醒小菜送上
  const autoSide = useMemo(() => {
    if (sides.length || !cartCards.length || skipAuto) return null
    const keys = new Set(cartCards.flatMap((c) => c.event_keys))
    return sober.find((s) => s.event_keys.some((k) => keys.has(k))) ?? sober[0] ?? null
  }, [sides, cartCards, sober, skipAuto])
  const sideCards = useMemo(
    () => (sides.length ? (sides.map((id) => sober.find((c) => c.id === id)).filter(Boolean) as Card[]) : autoSide ? [autoSide] : []),
    [sides, sober, autoSide]
  )

  const target = () => {
    const el = window.innerWidth < 980 ? barRef.current : totalRef.current
    const r = el?.getBoundingClientRect()
    return r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null
  }

  const celebrate = (card: Card, from: DOMRect | null) => {
    sfx.coin()
    setBump((n) => n + 1)
    const to = target()
    if (from && to && card.kind === 'faith') {
      const detail: ChargeDetail = {
        from: { x: from.left + from.width / 2, y: from.top + from.height / 2 },
        to,
        amount: Math.max(4, Math.round(card.charge * 0.6)),
        crit: card.charge >= 12
      }
      window.dispatchEvent(new CustomEvent('fx:charge', { detail }))
    }
  }

  const has = (card: Card) => (card.kind === 'faith' ? cart.includes(card.id) : sideCards.some((s) => s.id === card.id))

  const addCard = (card: Card, from: DOMRect | null) => {
    if (card.kind === 'faith') {
      if (cart.includes(card.id)) return
      setCart((c) => [...c, card.id])
    } else {
      if (sides.includes(card.id)) return
      setSides((s) => [...(s.length ? s : autoSide ? [autoSide.id] : []), card.id].filter((v, i, a) => a.indexOf(v) === i))
    }
    setLastPicked(card)
    celebrate(card, from)
  }

  const removeCard = (card: Card) => {
    if (card.kind === 'faith') setCart((c) => c.filter((id) => id !== card.id))
    else if (autoSide && autoSide.id === card.id && !sides.length) setSkipAuto(true)
    else setSides((s) => s.filter((id) => id !== card.id))
    sfx.doubt()
  }

  const toggle = (card: Card, from: DOMRect | null) => (has(card) ? removeCard(card) : addCard(card, from))

  const openDetail = (card: Card) => {
    setDetail(card)
    setDetailKey((k) => k + 1)
    setFlipped(false)
  }

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
      setError(`下单失败：${error.message ?? '服务器没有响应'}，请再试一次`)
      return
    }
    const order = (Array.isArray(data) ? data[0] : data) as OrderResult | undefined
    if (!order) {
      setError('下单失败：服务器没有返回单号，请再试一次')
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
    setOrderCount((n) => Math.max(n + 1, order.daily_seq))
    setSheet(false)
    setPlaced({ order, dishes, sides: sideList })
  }

  const closeReceipt = useCallback(() => {
    setPlaced(null)
    setCart([])
    setSides([])
    setLastPicked(null)
    setSkipAuto(false)
  }, [])

  const shuffled = useMemo(() => {
    if (seed === 0) {
      return [...faith.slice(0, 10), ...sober.slice(0, 2)]
    }
    const pick = <T,>(arr: T[], n: number) => {
      const copy = [...arr]
      for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[copy[i], copy[j]] = [copy[j], copy[i]]
      }
      return copy.slice(0, n)
    }
    return [...pick(faith, 10), ...pick(sober, 2)]
  }, [faith, sober, seed])

  const list =
    filter === '今日精选'
      ? shuffled
      : filter === '全部'
        ? cards
        : filter === soberTag
          ? sober
          : faith.filter((c) => c.tag === filter)

  return (
    <section className="menu-page">
      <DinerHero
        orderCount={orderCount}
        faithCount={faith.length}
        soberCount={sober.length}
        cartCount={cart.length}
        total={total}
        lastPicked={lastPicked}
        table={table}
      />

      <nav className="menu-tabs" aria-label="菜品分类">
        {['全部', ...tags, soberTag, '今日精选'].map((t) => (
          <button key={t} type="button" aria-pressed={filter === t} onClick={() => setFilter(t)} className={t === soberTag ? 'is-sober' : undefined}>
            {t}
          </button>
        ))}
        <button
          type="button"
          onClick={() => {
            setFilter('今日精选')
            setSeed((s) => s + 1)
            sfx.flip()
          }}
        >
          换一批菜
        </button>
        <Link href="/" className="menu-swipe">
          回到翻牌点菜
        </Link>
      </nav>

      <div className="menu-body">
        <div className="dishes">
          {list.map((c) => {
            const picked = has(c)
            const ev = firstEvent(c)
            const sold = stats[c.id]?.charges ?? 0
            return (
              <article key={c.id} className={`dish${c.kind === 'sober' ? ' sober' : ''}${picked ? ' picked' : ''}`}>
                {picked && <span className="dish-stamp" aria-hidden="true">已点</span>}
                <button type="button" className="dish-main" onClick={() => openDetail(c)}>
                  <span className="dish-tags">
                    <span className="dish-tag">{c.tag}</span>
                    {c.charge >= 12 && <span className="dish-badge">招牌</span>}
                    {c.source.via && <span className="dish-badge soft">二手转述</span>}
                  </span>
                  <span className="dish-name">{c.title}</span>
                  <span className="dish-desc">{blurb(c)}</span>
                  <span className="dish-meta">
                    <span>出品 {c.source.name}</span>
                    {ev && <span>取餐 {ev.short_label}</span>}
                    <span>已售 {sold}</span>
                  </span>
                </button>
                <div className="dish-side">
                  <span className="dish-price">
                    {c.kind === 'faith' ? (
                      <>
                        +{c.charge}
                        <small>信仰</small>
                      </>
                    ) : (
                      <>免费</>
                    )}
                  </span>
                  <motion.button
                    type="button"
                    className="dish-add"
                    aria-pressed={picked}
                    aria-label={picked ? `取消 ${c.title}` : `点 ${c.title}`}
                    whileTap={{ scale: 0.85 }}
                    onClick={(e) => toggle(c, e.currentTarget.getBoundingClientRect())}
                  >
                    {picked ? <IconCheck /> : <IconPlus />}
                  </motion.button>
                </div>
              </article>
            )
          })}
        </div>

        <aside className={`pad${sheet ? ' open' : ''}`}>
          <button type="button" className="pad-bar" ref={barRef} onClick={() => setSheet((s) => !s)} aria-expanded={sheet}>
            <span>
              已点 <b>{cart.length}</b> 道
            </span>
            <motion.b key={bump} className="pad-bar-total" initial={bump ? { scale: 1.4 } : false} animate={{ scale: 1 }}>
              +{total}
            </motion.b>
            <span className="pad-bar-go">{sheet ? '收起' : '看点菜单'}</span>
          </button>

          <div className="pad-paper">
            <div className="pad-top">
              <b>点菜单</b>
              <span>桌号 {table}</span>
            </div>
            {cartCards.length === 0 ? (
              <p className="pad-empty">还没点菜。点菜品右边的加号，或者点开一道菜往右滑。</p>
            ) : (
              <ul className="pad-list">
                <AnimatePresence initial={false}>
                  {cartCards.map((c) => (
                    <motion.li
                      key={c.id}
                      layout
                      initial={{ opacity: 0, x: -16 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 16 }}
                    >
                      <span className="pl-name">{c.title}</span>
                      <span className="pl-price">+{c.charge}</span>
                      <button type="button" className="pl-x" onClick={() => removeCard(c)} aria-label={`退掉 ${c.title}`}>
                        退
                      </button>
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
            )}
            {sideCards.length > 0 && (
              <div className="pad-sides">
                <p>{sides.length ? '清醒小菜（赠）' : '主厨送的清醒小菜'}</p>
                <ul className="pad-list">
                  {sideCards.map((c) => (
                    <li key={c.id}>
                      <span className="pl-name">{c.title}</span>
                      <span className="pl-price">0</span>
                      <button type="button" className="pl-x" onClick={() => removeCard(c)} aria-label={`不要 ${c.title}`}>
                        退
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="pad-total" ref={totalRef}>
              <span>合计</span>
              <motion.b key={bump} initial={bump ? { scale: 1.35 } : false} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 12 }}>
                +{total}
              </motion.b>
              <small>点信仰</small>
            </div>
            <button type="button" className="pad-go" onClick={placeOrder} disabled={!cart.length || placing}>
              {placing ? '正在下单…' : cart.length ? '下单，打印小票' : '先点一道主菜'}
            </button>
            {error && (
              <p className="pad-err" role="alert">
                {error}
              </p>
            )}
            <p className="pad-note">下单会记到后台。小票可以存成图片或 PDF。</p>
          </div>
        </aside>
      </div>

      {/* 菜品详情：原来的信仰卡，右滑就是点这道菜 */}
      <AnimatePresence>
        {detail && (
          <motion.div className="dish-modal" role="dialog" aria-modal="true" aria-label={detail.title} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setDetail(null)}>
            <div className="dm-inner" onClick={(e) => e.stopPropagation()}>
              <div className="stack">
                <HoloCard
                  key={`${detail.id}-${detailKey}`}
                  ref={detailCard}
                  card={detail}
                  depth={0}
                  interactive
                  flipped={flipped}
                  stat={stats[detail.id]}
                  firstShort={firstEvent(detail)?.short_label ?? ''}
                  evText={evText(detail)}
                  reduced={reduced}
                  deal={false}
                  onFlip={() => setFlipped((f) => !f)}
                  onFlingStart={(dir, rect) => {
                    if (dir === 1) addCard(detail, rect)
                    else if (has(detail)) removeCard(detail)
                  }}
                  onSwiped={() => setDetail(null)}
                />
              </div>
              <div className="dm-actions">
                <button type="button" className="btn" onClick={() => detailCard.current?.fling(-1)}>
                  {has(detail) ? '退掉这道' : '不要'}
                </button>
                <button type="button" className="btn" onClick={() => setFlipped((f) => !f)}>
                  {flipped ? '看正面' : '看背面'}
                </button>
                <button type="button" className="btn main" onClick={() => detailCard.current?.fling(1)}>
                  {has(detail) ? '已点，收下' : detail.kind === 'faith' ? `点这道 +${detail.charge}` : '加这道小菜'}
                </button>
              </div>
              <p className="dm-tip">往右滑也是点菜，往左滑是不要。按 Esc 或点空白处关闭。</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {placed && (
          <ReceiptStage
            order={placed.order}
            dishes={placed.dishes}
            sides={placed.sides}
            events={events}
            deckTitle={deck.title}
            table={table}
            onClose={closeReceipt}
          />
        )}
      </AnimatePresence>
    </section>
  )
}
