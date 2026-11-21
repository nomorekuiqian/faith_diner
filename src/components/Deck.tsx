'use client'

import { motion } from 'motion/react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { insforge } from '@/lib/insforge'
import { getDeviceId, loadProgress, saveProgress, PROGRESS_EVENT, type Progress } from '@/lib/device'
import { dishName, keyDataOf, logicOf, watchOf } from '@/lib/dish'
import type { Card, CardStat, VerifyEvent } from '@/lib/types'
import BoardCard, { type BoardHandle } from './BoardCard'
import Magnetic from './fx/Magnetic'
import { sfx } from './fx/sound'

const START = 10

interface Props {
  deckId: string
  cards: Card[]
  events: VerifyEvent[]
  initialStats: Record<string, CardStat>
  onPick?: (card: Card, dir: 1 | -1, pickedFaith: Card[], pickedSober: Card[]) => void
  onCheckout?: (dishes: Card[], sides: Card[]) => void
}

// 每桌发 10 道信仰菜 + 2 道清醒凉菜，凉菜插在第 4 和第 9 道
const HAND_FAITH = 10
const HAND_SOBER = 2

function hasBack(card: Card | undefined) {
  if (!card) return false
  return Boolean(keyDataOf(card) || logicOf(card) || watchOf(card))
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
  const [notice, setNotice] = useState<string | null>(null)

  const topCard = useRef<BoardHandle | null>(null)
  const deckRef = useRef<HTMLDivElement | null>(null)
  const reduced = useRef(false)

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
    } else {
      const { hand, nextSeen } = dealHand(pool, p.seen ?? [])
      const next: Progress = { index: 0, balance: START, picks: {}, hand, seen: nextSeen }
      setProgress(next)
      saveProgress(deckId, next)
    }
    setLoaded(true)
    const t = window.setTimeout(() => setDeal(false), 900)
    return () => window.clearTimeout(t)
  }, [deckId, pool, poolMap])

  const cards = useMemo(() => {
    const ids = progress.hand?.filter((id) => Boolean(poolMap[id]))
    if (ids && ids.length > 0) return ids.map((id) => poolMap[id])
    return pool.slice(0, HAND_FAITH + HAND_SOBER)
  }, [progress.hand, pool, poolMap])

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
      .limit(100)
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

  // 牌子开始飞出：更新已售数、写后台、出声
  const onFlingStart = useCallback(
    (dir: 1 | -1) => {
      const card = cards[progress.index]
      if (!card) return
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
      if (dir === 1) {
        if (card.kind === 'faith') sfx.coin()
        else sfx.sober()
        try {
          navigator.vibrate?.(20)
        } catch {
          /* 忽略 */
        }
      } else {
        sfx.doubt()
      }
    },
    [cards, progress, sendSwipe]
  )

  // 牌子飞出屏幕：推进到下一道
  const onSwiped = useCallback(
    (dir: 1 | -1) => {
      const card = cards[progress.index]
      if (!card) return
      const balance = card.kind === 'faith' && dir === 1 ? Math.min(100, progress.balance + card.charge) : progress.balance
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
    setDeal(true)
    window.setTimeout(() => setDeal(false), 900)
    deckRef.current?.focus()
    if (onPick) {
      const first = poolMap[hand[0]]
      if (first) onPick(first, -1, [], [])
    }
    const { error } = await insforge.database.rpc('reset_swipes', { p_device: getDeviceId(), p_deck: deckId })
    if (!error) void refreshStats()
  }, [deckId, pool, poolMap, progress.seen, persist, refreshStats, onPick])

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
  const faithCurrent = current?.kind === 'faith'

  return (
    <div
      className="ds-deck"
      ref={deckRef}
      tabIndex={0}
      aria-label="今日推介。方向键右是加一份，左是存疑，空格看拆解"
      onKeyDown={onKeyDown}
    >
      <div className="ds-deck-head">
        <h2 className="ds-section-title">今日推介</h2>
        {!done && loaded && (
          <span className="ds-muted ds-deck-count">
            第 {Math.min(progress.index + 1, cards.length)} / {cards.length} 道
          </span>
        )}
        {!done && current && (
          <button type="button" className="ds-btn ds-btn--text ds-deck-flip" onClick={flip} disabled={!hasBack(current)}>
            {flipped ? '回正面' : '看拆解'}
          </button>
        )}
      </div>

      {!done && (
        <div className="bc-stack">
          {visible
            .map((card, d) => (
              <BoardCard
                key={card.id}
                ref={d === 0 ? topCard : undefined}
                card={card}
                depth={d}
                interactive={d === 0}
                flipped={d === 0 && flipped}
                stat={stats[card.id]}
                ev={firstEvent(card)}
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

      {done && loaded && <TableDone cards={cards} progress={progress} onReset={reset} onCheckout={onCheckout} />}

      {!done && current && (
        <div className="ds-deck-actions">
          <button type="button" className="ds-btn ds-btn--secondary" onClick={() => topCard.current?.fling(-1)}>
            {faithCurrent ? '存疑' : '跳过'}
          </button>
          <Magnetic type="button" strength={0.09} className="ds-btn ds-btn--primary" onClick={() => topCard.current?.fling(1)}>
            {faithCurrent ? (
              <>
                加一份 <b>+{current.charge}</b>
              </>
            ) : (
              '记下了'
            )}
          </Magnetic>
        </div>
      )}
      {notice && (
        <p className="ds-slip-err" role="status">
          {notice}
        </p>
      )}
    </div>
  )
}

interface DoneProps {
  cards: Card[]
  progress: Progress
  onReset: () => void
  onCheckout?: (dishes: Card[], sides: Card[]) => void
}

// 一桌推介刷完
function TableDone({ cards, progress, onReset, onCheckout }: DoneProps) {
  const charged = cards.filter((c) => c.kind === 'faith' && progress.picks[c.id] === 1)
  const sides = cards.filter((c) => c.kind === 'sober' && progress.picks[c.id] === 1)
  const sum = charged.reduce((a, c) => a + c.charge, 0)

  return (
    <motion.div className="ds-board bc-done" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.24 }}>
      <h3 className="bc-done-title">这桌推介看完了</h3>
      {charged.length ? (
        <>
          <ul className="ds-slip-list">
            {charged.map((c) => (
              <li key={c.id} className="ds-row">
                <span className="ds-row-name">{dishName(c)}</span>
                <span className="ds-row-dots" />
                <span className="ds-row-price">{c.charge}</span>
              </li>
            ))}
          </ul>
          <div className="ds-slip-total">
            <span>合计</span>
            <b>{sum}</b>
          </div>
        </>
      ) : (
        <p className="ds-muted">一道都没点，也是一种清醒。</p>
      )}
      <div className="bc-done-actions">
        {onCheckout && charged.length > 0 && (
          <button type="button" className="ds-btn ds-btn--primary ds-btn--block" onClick={() => onCheckout(charged, sides)}>
            落单，打小票
          </button>
        )}
        <button type="button" className="ds-btn ds-btn--secondary ds-btn--block" onClick={onReset}>
          换一桌推介
        </button>
      </div>
    </motion.div>
  )
}
