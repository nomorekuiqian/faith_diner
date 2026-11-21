'use client'

import confetti from 'canvas-confetti'
import { AnimatePresence, motion } from 'motion/react'
import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { insforge } from '@/lib/insforge'
import { getDeviceId, loadProgress, saveProgress, PROGRESS_EVENT, type Progress } from '@/lib/device'
import type { Card, CardStat, VerifyEvent } from '@/lib/types'
import HoloCard, { type HoloHandle } from './HoloCard'
import Reactor from './Reactor'
import Magnetic from './fx/Magnetic'
import { sfx } from './fx/sound'
import type { ChargeDetail } from './fx/EnergyField'

const START = 10
const GOLDS = ['#f0be48', '#b98500', '#fff1c2', '#ffd76a']

interface Props {
  deckId: string
  cards: Card[]
  events: VerifyEvent[]
  initialStats: Record<string, CardStat>
  onPick?: (card: Card, dir: 1 | -1, pickedFaith: Card[], pickedSober: Card[]) => void
  onCheckout?: (dishes: Card[], sides: Card[]) => void
}

interface Floater {
  id: number
  text: string
  x: number
  y: number
  tone: 'gold' | 'grey' | 'teal' | 'crit'
}

const HAND_FAITH = 10
const HAND_SOBER = 2

function hasBack(card: Card | undefined) {
  if (!card) return false
  return Boolean(card.void_if || card.ok_if || card.rows.some(([label]) => label === '详情'))
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

function dealHand(pool: Card[], seen: string[]): { hand: string[]; nextSeen: string[] } {
  const seenSet = new Set(seen)
  const pickByKind = (kind: Card['kind'], count: number) => {
    const all = pool.filter((c) => c.kind === kind)
    const fresh = shuffle(all.filter((c) => !seenSet.has(c.id)))
    const old = shuffle(all.filter((c) => seenSet.has(c.id)))
    return [...fresh, ...old].slice(0, Math.min(count, all.length))
  }
  const f = pickByKind('faith', HAND_FAITH)
  const s = pickByKind('sober', HAND_SOBER)
  const ordered = [...f]
  if (s[0]) ordered.splice(Math.min(3, ordered.length), 0, s[0])
  if (s[1]) ordered.splice(Math.min(8, ordered.length), 0, s[1])
  const hand = ordered.map((c) => c.id)
  const merged = Array.from(new Set([...seen, ...hand]))
  return { hand, nextSeen: merged.length >= pool.length ? hand : merged }
}

export default function Deck({ deckId, cards: pool, events, initialStats, onPick, onCheckout }: Props) {
  const poolMap = useMemo(() => Object.fromEntries(pool.map((c) => [c.id, c])), [pool])
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

  const [progress, setProgress] = useState<Progress>({ index: 0, balance: START, picks: {} })
  const [loaded, setLoaded] = useState(false)
  const [deal, setDeal] = useState(true)
  const [stats, setStats] = useState(initialStats)
  const [flipped, setFlipped] = useState(false)
  const [shown, setShown] = useState(START)
  const [pop, setPop] = useState(0)
  const [streak, setStreak] = useState(0)
  const [floaters, setFloaters] = useState<Floater[]>([])
  const [full, setFull] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const topCard = useRef<HoloHandle | null>(null)
  const balRef = useRef<HTMLDivElement | null>(null)
  const deckRef = useRef<HTMLDivElement | null>(null)
  const shownRef = useRef(START)
  const reduced = useRef(false)
  const floaterId = useRef(0)

  useEffect(() => {
    try {
      reduced.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    } catch {
      /* 忽略 */
    }
    const p = loadProgress(deckId, START)
    const validHand = p.hand?.filter((id) => Boolean(poolMap[id])) ?? []
    if (validHand.length > 0) {
      const normalized = validHand.length === p.hand?.length ? p : { ...p, hand: validHand, index: Math.min(p.index, validHand.length) }
      setProgress(normalized)
      shownRef.current = normalized.balance
      setShown(normalized.balance)
    } else {
      const { hand, nextSeen } = dealHand(pool, p.seen ?? [])
      const next: Progress = { index: 0, balance: START, picks: {}, hand, seen: nextSeen }
      setProgress(next)
      saveProgress(deckId, next)
      shownRef.current = START
      setShown(START)
    }
    setLoaded(true)
    const t = window.setTimeout(() => setDeal(false), 1400)
    return () => window.clearTimeout(t)
  }, [deckId, pool, poolMap])

  const cards = useMemo(() => {
    const ids = progress.hand?.filter((id) => Boolean(poolMap[id]))
    if (ids && ids.length > 0) return ids.map((id) => poolMap[id])
    return pool.slice(0, HAND_FAITH + HAND_SOBER)
  }, [progress.hand, pool, poolMap])

  // 余额数字滚动
  useEffect(() => {
    const to = progress.balance
    const from = shownRef.current
    shownRef.current = to
    if (reduced.current || from === to) {
      setShown(to)
      return
    }
    setPop((n) => n + 1)
    let raf = 0
    let t0 = 0
    const step = (t: number) => {
      if (!t0) t0 = t
      const k = Math.min(1, (t - t0) / 600)
      setShown(Math.round(from + (to - from) * (1 - Math.pow(1 - k, 3))))
      if (k < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [progress.balance])

  const float = useCallback((text: string, x: number, y: number, tone: Floater['tone']) => {
    const id = ++floaterId.current
    setFloaters((fs) => [...fs, { id, text, x, y, tone }])
    window.setTimeout(() => setFloaters((fs) => fs.filter((f) => f.id !== id)), 1300)
  }, [])

  const persist = useCallback(
    (next: Progress) => {
      setProgress(next)
      saveProgress(deckId, next)
      window.dispatchEvent(new Event(PROGRESS_EVENT))
    },
    [deckId]
  )

  const refreshStats = useCallback(async () => {
    const { data, error } = await insforge.database
      .from('card_stats')
      .select('card_id, charges, doubts')
      .eq('deck_id', deckId)
      .limit(50)
    if (error || !data) return
    const map: Record<string, CardStat> = {}
    for (const s of data as CardStat[]) map[s.card_id] = s
    setStats(map)
  }, [deckId])

  const sendSwipe = useCallback(async (cardId: string, dir: 1 | -1) => {
    const { data, error } = await insforge.database.rpc('record_swipe', {
      p_device: getDeviceId(),
      p_card: cardId,
      p_dir: dir
    })
    if (error) {
      setNotice('没连上服务器，这次的选择只存在本机。')
      return
    }
    setNotice(null)
    const row = (Array.isArray(data) ? data[0] : data) as CardStat | undefined
    if (row && row.card_id) setStats((prev) => ({ ...prev, [row.card_id]: row }))
  }, [])

  // 卡片开始飞出：特效、音效、写后台
  const onFlingStart = useCallback(
    (dir: 1 | -1, rect: DOMRect) => {
      const card = cards[progress.index]
      if (!card) return
      const cx = rect.left + rect.width / 2
      const cy = rect.top + rect.height / 2
      const meter = balRef.current?.getBoundingClientRect()
      const to = meter ? { x: meter.left + meter.width / 2, y: meter.top + meter.height / 2 } : { x: cx, y: cy }

      const prevPick = progress.picks[card.id]
      setStats((prev) => {
        const cur = prev[card.id] ?? { card_id: card.id, charges: 0, doubts: 0 }
        let { charges, doubts } = cur
        if (prevPick === 1) charges--
        if (prevPick === -1) doubts--
        if (dir === 1) charges++
        else doubts++
        return { ...prev, [card.id]: { card_id: card.id, charges: Math.max(0, charges), doubts: Math.max(0, doubts) } }
      })
      void sendSwipe(card.id, dir)

      if (card.kind === 'faith' && dir === 1) {
        const crit = card.charge >= 12
        const detail: ChargeDetail = { from: { x: cx, y: cy }, to, amount: card.charge, crit }
        window.dispatchEvent(new CustomEvent('fx:charge', { detail }))
        if (crit) sfx.crit()
        else sfx.coin()
        try {
          navigator.vibrate?.(crit ? [20, 40, 30] : 25)
        } catch {
          /* 忽略 */
        }
        float(crit ? `暴击 +${card.charge}` : `+${card.charge}`, cx, cy - 40, crit ? 'crit' : 'gold')
        const nextStreak = streak + 1
        setStreak(nextStreak)
        if (nextStreak >= 2) float(`连充 ×${nextStreak}`, to.x, to.y - (meter ? meter.height / 2 + 10 : 60), 'gold')
        if (crit && !reduced.current) {
          void confetti({
            particleCount: 90,
            spread: 80,
            startVelocity: 38,
            origin: { x: cx / window.innerWidth, y: cy / window.innerHeight },
            colors: GOLDS,
            scalar: 0.9,
            zIndex: 70
          })
        }
      } else if (card.kind === 'faith') {
        window.dispatchEvent(new CustomEvent('fx:doubt', { detail: { x: cx, y: cy } }))
        sfx.doubt()
        float('存疑', cx, cy - 40, 'grey')
        setStreak(0)
      } else if (dir === 1) {
        sfx.sober()
        float('+1 清醒', cx, cy - 40, 'teal')
      } else {
        float('跳过', cx, cy - 40, 'grey')
      }
    },
    [cards, progress, sendSwipe, float, streak]
  )

  // 卡片已经飞出屏幕：推进进度
  const onSwiped = useCallback(
    (dir: 1 | -1) => {
      const card = cards[progress.index]
      if (!card) return
      const balance =
        card.kind === 'faith' && dir === 1 ? Math.min(100, progress.balance + card.charge) : progress.balance
      if (balance >= 100 && progress.balance < 100) {
        setFull(true)
        sfx.full()
        window.dispatchEvent(new Event('fx:pulse'))
        if (!reduced.current) {
          const end = Date.now() + 1400
          const shoot = () => {
            void confetti({ particleCount: 8, angle: 60, spread: 60, origin: { x: 0, y: 0.75 }, colors: GOLDS, zIndex: 70 })
            void confetti({ particleCount: 8, angle: 120, spread: 60, origin: { x: 1, y: 0.75 }, colors: GOLDS, zIndex: 70 })
            if (Date.now() < end) requestAnimationFrame(shoot)
          }
          shoot()
        }
        window.setTimeout(() => setFull(false), 2600)
      }
      setFlipped(false)
      const nextPicks = { ...progress.picks, [card.id]: dir }
      persist({ ...progress, index: progress.index + 1, balance, picks: nextPicks })
      if (onPick) {
        const pickedFaith = cards.filter((c) => c.kind === 'faith' && nextPicks[c.id] === 1)
        const pickedSober = cards.filter((c) => c.kind === 'sober' && nextPicks[c.id] === 1)
        onPick(card, dir, pickedFaith, pickedSober)
      }
    },
    [cards, progress, persist, onPick]
  )

  const flip = useCallback(() => {
    const card = cards[progress.index]
    if (hasBack(card)) {
      sfx.flip()
      setFlipped((f) => !f)
    }
  }, [cards, progress.index])

  const reset = useCallback(async () => {
    const { hand, nextSeen } = dealHand(pool, progress.seen ?? [])
    persist({ index: 0, balance: START, picks: {}, hand, seen: nextSeen })
    setFlipped(false)
    setStreak(0)
    setDeal(true)
    window.setTimeout(() => setDeal(false), 1400)
    deckRef.current?.focus()
    const { error } = await insforge.database.rpc('reset_swipes', { p_device: getDeviceId(), p_deck: deckId })
    if (!error) void refreshStats()
  }, [deckId, pool, progress.seen, persist, refreshStats])

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return
    if (e.key === 'ArrowRight') {
      e.preventDefault()
      topCard.current?.fling(1)
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      topCard.current?.fling(-1)
    } else if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault()
      flip()
    }
  }

  const done = progress.index >= cards.length
  const current = cards[progress.index]
  const visible = !loaded || done ? [] : cards.slice(progress.index, progress.index + 3)

  return (
    <div className="deck" ref={deckRef} tabIndex={0} aria-label="信仰牌组。左右方向键滑动，空格翻面" onKeyDown={onKeyDown}>
      <Reactor
        ref={balRef}
        shown={shown}
        balance={progress.balance}
        pop={pop}
        streak={streak}
        index={progress.index}
        total={cards.length}
        doubts={cards.filter((c) => c.kind === 'faith' && progress.picks[c.id] === -1).length}
        sober={cards.filter((c) => c.kind === 'sober' && progress.picks[c.id] === 1).length}
      />

      <div className="stage-col">
      {!done && (
        <div className="stack">
          {visible
            .map((card, d) => (
              <HoloCard
                key={card.id}
                ref={d === 0 ? topCard : undefined}
                card={card}
                depth={d}
                interactive={d === 0}
                flipped={d === 0 && flipped}
                stat={stats[card.id]}
                firstShort={firstEvent(card)?.short_label ?? ''}
                evText={evText(card)}
                reduced={reduced.current}
                deal={deal}
                onFlip={flip}
                onFlingStart={onFlingStart}
                onSwiped={onSwiped}
              />
            ))
            .reverse()}
        </div>
      )}

      {done && loaded && (
        <Receipt
          cards={cards}
          progress={progress}
          stats={stats}
          firstShort={(c) => firstEvent(c)?.short_label ?? ''}
          onReset={reset}
          onCheckout={onCheckout}
        />
      )}

      {!done && current && (
        <>
          <div className="ctrl">
            <Magnetic type="button" className="act act-doubt" onClick={() => topCard.current?.fling(-1)}>
              <span className="act-ring" aria-hidden="true">
                {current.kind === 'faith' ? <IconDoubt /> : <IconSkip />}
              </span>
              <span className="act-lab">{current.kind === 'faith' ? '存疑' : '跳过'}</span>
            </Magnetic>
            <Magnetic type="button" className="act act-flip" onClick={flip} disabled={!hasBack(current)} strength={0.25}>
              <span className="act-ring" aria-hidden="true">
                <IconFlip />
              </span>
              <span className="act-lab">{flipped ? '回正面' : '看详情'}</span>
            </Magnetic>
            <Magnetic
              type="button"
              className={`act act-charge${current.kind === 'faith' ? '' : ' is-sober'}`}
              onClick={() => topCard.current?.fling(1)}
              strength={0.45}
            >
              <span className="act-ring" aria-hidden="true">
                {current.kind === 'faith' ? <IconBolt /> : <IconCheck />}
                {current.kind === 'faith' && <b>+{current.charge}</b>}
              </span>
              <span className="act-lab">{current.kind === 'faith' ? '充值' : '记住了'}</span>
            </Magnetic>
          </div>
          <div className="keys">
            <kbd>←</kbd> 存疑　<kbd>→</kbd> 充值　<kbd>空格</kbd> 看详情　也可以直接拖动卡片
          </div>
        </>
      )}
      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
      </div>

      {/* 飘字 */}
      <div className="floaters" aria-hidden="true">
        <AnimatePresence>
          {floaters.map((f) => (
            <motion.div
              key={f.id}
              className={`floater ${f.tone}`}
              style={{ left: f.x, top: f.y }}
              initial={{ opacity: 0, y: 10, scale: 0.5 }}
              animate={{ opacity: 1, y: -60, scale: f.tone === 'crit' ? 1.5 : 1.15 }}
              exit={{ opacity: 0, y: -100 }}
              transition={{ type: 'spring', stiffness: 220, damping: 14 }}
            >
              {f.text}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* 满格庆祝 */}
      <AnimatePresence>
        {full && (
          <motion.div
            className="full-banner"
            role="status"
            initial={{ opacity: 0, scale: 0.4, rotate: -8 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            exit={{ opacity: 0, scale: 1.4 }}
            transition={{ type: 'spring', stiffness: 260, damping: 12 }}
          >
            <span>信仰已充满</span>
            <small>余额 100 点</small>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function IconBolt() {
  return (
    <svg viewBox="0 0 24 24" width="30" height="30">
      <path d="M13.5 2 4 13.6h6.6L9.4 22 20 9.9h-6.9z" fill="currentColor" />
    </svg>
  )
}
function IconDoubt() {
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
      <path d="M8.6 8.8a3.5 3.5 0 1 1 5.2 3c-1.1.6-1.8 1.4-1.8 2.6v.6" />
      <circle cx="12" cy="19" r="0.6" fill="currentColor" />
    </svg>
  )
}
function IconSkip() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 6l-6 6 6 6" />
    </svg>
  )
}
function IconFlip() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 9a8 8 0 0 1 14-3l2 2" />
      <path d="M20 4v4h-4" />
      <path d="M20 15a8 8 0 0 1-14 3l-2-2" />
      <path d="M4 20v-4h4" />
    </svg>
  )
}
function IconCheck() {
  return (
    <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  )
}

interface ReceiptProps {
  cards: Card[]
  progress: Progress
  stats: Record<string, CardStat>
  firstShort: (c: Card) => string
  onReset: () => void
  onCheckout?: (dishes: Card[], sides: Card[]) => void
}

function Receipt({ cards, progress, stats, firstShort, onReset, onCheckout }: ReceiptProps) {
  const charged = cards.filter((c) => c.kind === 'faith' && progress.picks[c.id] === 1)
  const doubted = cards.filter((c) => c.kind === 'faith' && progress.picks[c.id] === -1)
  const soberTotal = cards.filter((c) => c.kind === 'sober').length
  const soberRead = cards.filter((c) => c.kind === 'sober' && progress.picks[c.id] === 1).length
  const sum = charged.reduce((a, c) => a + c.charge, 0)
  const pct = (c: Card) => {
    const s = stats[c.id]
    const total = (s?.charges ?? 0) + (s?.doubts ?? 0)
    return total ? Math.round(((s?.charges ?? 0) / total) * 100) : null
  }

  return (
    <motion.div
      className="receipt"
      initial={{ opacity: 0, y: -60, rotateX: -35 }}
      animate={{ opacity: 1, y: 0, rotateX: 0 }}
      transition={{ type: 'spring', stiffness: 160, damping: 16 }}
    >
      <h2>{charged.length ? '充值成功' : '今天没有充值'}</h2>
      <p className="sub">
        信仰余额 {progress.balance} 点；清醒卡读了 {soberRead} / {soberTotal} 张
      </p>
      {charged.length ? (
        <>
          <ul className="rc-rows">
            {charged.map((c, i) => {
              const p = pct(c)
              return (
                <motion.li
                  key={c.id}
                  initial={{ opacity: 0, x: -24 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.25 + i * 0.08 }}
                >
                  <span className="v">+{c.charge}</span>
                  <span>
                    {c.title}
                    {p !== null && <em className="rc-pct">全站 {p}% 的人也充了</em>}
                  </span>
                  <span className="d">{firstShort(c)}</span>
                </motion.li>
              )
            })}
          </ul>
          <div className="rc-total">
            <span>合计面值</span>
            <b>+{sum}</b>
          </div>
        </>
      ) : (
        <p>一张都没信，也算一种清醒。</p>
      )}
      {doubted.length > 0 && (
        <>
          <h3>你存疑的 {doubted.length} 张，作废条件在这里</h3>
          <ul className="rc-doubt">
            {doubted.map((c) => (
              <li key={c.id}>
                <b>{c.title}</b>
                <br />
                <span>{c.void_if}</span>
              </li>
            ))}
          </ul>
        </>
      )}
      <div className="rc-acts">
        {onCheckout && charged.length > 0 && (
          <button
            type="button"
            className="btn main"
            onClick={() => onCheckout(charged, cards.filter((c) => c.kind === 'sober' && progress.picks[c.id] === 1))}
          >
            打印 3D 堂食小票
          </button>
        )}
        <Link className={onCheckout && charged.length > 0 ? 'btn' : 'btn main'} href="/calendar">
          查看验菜日历
        </Link>
        <button type="button" className="btn" onClick={onReset}>
          换一桌新菜（Shuffle）
        </button>
      </div>
    </motion.div>
  )
}
