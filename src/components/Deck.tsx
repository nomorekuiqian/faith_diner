'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent, PointerEvent } from 'react'
import { insforge } from '@/lib/insforge'
import { getDeviceId, loadProgress, saveProgress, PROGRESS_EVENT, type Progress } from '@/lib/device'
import type { Card, CardStat, VerifyEvent } from '@/lib/types'

const START = 10
const THRESHOLD = 90

interface Props {
  deckId: string
  cards: Card[]
  events: VerifyEvent[]
  initialStats: Record<string, CardStat>
}

function initial(card: Card) {
  const c = (card.source.handle || card.source.name).charAt(0)
  return /[a-z]/i.test(c) ? c.toUpperCase() : c
}

export default function Deck({ deckId, cards, events, initialStats }: Props) {
  const evMap = useMemo(() => Object.fromEntries(events.map((e) => [e.key, e])), [events])
  const firstEvent = useCallback(
    (card: Card) =>
      card.event_keys
        .map((k) => evMap[k])
        .filter(Boolean)
        .sort((a, b) => a.sort - b.sort)[0],
    [evMap]
  )

  const [progress, setProgress] = useState<Progress>({ index: 0, balance: START, picks: {} })
  const [stats, setStats] = useState(initialStats)
  const [flipped, setFlipped] = useState(false)
  const [shown, setShown] = useState(START)
  const [notice, setNotice] = useState<string | null>(null)
  const busy = useRef(false)
  const shownRef = useRef(START)
  const topRef = useRef<HTMLElement | null>(null)
  const deckRef = useRef<HTMLDivElement | null>(null)
  const drag = useRef({ on: false, sx: 0, dx: 0 })
  const reduced = useRef(false)

  useEffect(() => {
    try {
      reduced.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    } catch {
      /* 忽略 */
    }
    const p = loadProgress(deckId, START)
    setProgress(p)
    shownRef.current = p.balance
    setShown(p.balance)
  }, [deckId])

  // 余额数字滚动到新值
  useEffect(() => {
    const to = progress.balance
    const from = shownRef.current
    shownRef.current = to
    if (reduced.current || from === to) {
      setShown(to)
      return
    }
    let raf = 0
    let t0 = 0
    const step = (t: number) => {
      if (!t0) t0 = t
      const k = Math.min(1, (t - t0) / 450)
      setShown(Math.round(from + (to - from) * (1 - Math.pow(1 - k, 3))))
      if (k < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [progress.balance])

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

  const commit = useCallback(
    (dir: 1 | -1) => {
      const card = cards[progress.index]
      if (busy.current || !card) return
      busy.current = true

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

      const balance =
        card.kind === 'faith' && dir === 1 ? Math.min(100, progress.balance + card.charge) : progress.balance
      const next: Progress = { index: progress.index + 1, balance, picks: { ...progress.picks, [card.id]: dir } }
      const finish = () => {
        setFlipped(false)
        persist(next)
        busy.current = false
      }

      const el = topRef.current
      if (reduced.current || !el) {
        finish()
        return
      }
      el.style.transition = 'transform .32s ease, opacity .32s ease'
      el.style.transform = `translateX(${dir * 620}px) rotate(${dir * 20}deg)`
      el.style.opacity = '0'
      const stamp = el.querySelector<HTMLElement>(dir === 1 ? '.stamp.r' : '.stamp.l')
      if (stamp) stamp.style.opacity = '1'
      window.setTimeout(finish, 300)
    },
    [cards, progress, persist, sendSwipe]
  )

  const flip = useCallback(() => {
    const card = cards[progress.index]
    if (card && card.kind === 'faith') setFlipped((f) => !f)
  }, [cards, progress.index])

  const reset = useCallback(async () => {
    persist({ index: 0, balance: START, picks: {} })
    setFlipped(false)
    deckRef.current?.focus()
    const { error } = await insforge.database.rpc('reset_swipes', { p_device: getDeviceId(), p_deck: deckId })
    if (!error) void refreshStats()
  }, [deckId, persist, refreshStats])

  // 拖拽
  const stamps = (el: HTMLElement, dx: number) => {
    const r = el.querySelector<HTMLElement>('.stamp.r')
    const l = el.querySelector<HTMLElement>('.stamp.l')
    if (r) r.style.opacity = String(Math.max(0, Math.min(1, dx / THRESHOLD)))
    if (l) l.style.opacity = String(Math.max(0, Math.min(1, -dx / THRESHOLD)))
  }
  const onPointerDown = (e: PointerEvent<HTMLElement>) => {
    if (busy.current || (e.target as HTMLElement).closest('a')) return
    drag.current = { on: true, sx: e.clientX, dx: 0 }
    e.currentTarget.style.transition = 'none'
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      /* 忽略 */
    }
  }
  const onPointerMove = (e: PointerEvent<HTMLElement>) => {
    if (!drag.current.on) return
    const dx = e.clientX - drag.current.sx
    drag.current.dx = dx
    e.currentTarget.style.transform = `translateX(${dx}px) rotate(${dx / 20}deg)`
    stamps(e.currentTarget, dx)
  }
  const snapBack = (el: HTMLElement) => {
    el.style.transition = ''
    el.style.transform = ''
    stamps(el, 0)
  }
  const onPointerUp = (e: PointerEvent<HTMLElement>) => {
    if (!drag.current.on) return
    drag.current.on = false
    const { dx } = drag.current
    const el = e.currentTarget
    el.style.transition = ''
    if (dx > THRESHOLD) commit(1)
    else if (dx < -THRESHOLD) commit(-1)
    else {
      snapBack(el)
      if (Math.abs(dx) < 4) flip()
    }
  }
  const onPointerCancel = (e: PointerEvent<HTMLElement>) => {
    if (!drag.current.on) return
    drag.current.on = false
    snapBack(e.currentTarget)
  }
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return
    if (e.key === 'ArrowRight') {
      e.preventDefault()
      commit(1)
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      commit(-1)
    } else if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault()
      flip()
    }
  }

  const done = progress.index >= cards.length
  const current = cards[progress.index]
  const visible = done ? [] : cards.slice(progress.index, progress.index + 3)

  return (
    <div className="deck" ref={deckRef} tabIndex={0} aria-label="信仰牌组。左右方向键滑动，空格翻面" onKeyDown={onKeyDown}>
      <div className="meter">
        <div className="bal">
          <span className="n">{shown}</span>
          <span className="u">点</span>
        </div>
        <div className="m-lab">
          <span>信仰余额，满格 100</span>
          <span>
            第 <b>{Math.min(progress.index + 1, cards.length)}</b> / {cards.length} 张
          </span>
        </div>
        <div className="bar" aria-hidden="true">
          <i style={{ width: `${Math.min(100, progress.balance)}%` }} />
        </div>
      </div>

      {!done && (
        <div className="stack">
          {visible
            .map((card, d) => (
              <CardView
                key={card.id}
                card={card}
                depth={d}
                flipped={d === 0 && flipped}
                stat={stats[card.id]}
                firstShort={firstEvent(card)?.short_label ?? ''}
                evText={card.event_keys
                  .map((k) => evMap[k])
                  .filter(Boolean)
                  .map((e) => `${e.name}（${e.when_label}）`)
                  .join('；')}
                topRef={d === 0 ? topRef : undefined}
                handlers={d === 0 ? { onPointerDown, onPointerMove, onPointerUp, onPointerCancel } : undefined}
              />
            ))
            .reverse()}
        </div>
      )}

      {done && (
        <Receipt cards={cards} progress={progress} stats={stats} firstShort={(c) => firstEvent(c)?.short_label ?? ''} onReset={reset} />
      )}

      {!done && current && (
        <>
          <div className="ctrl">
            <button type="button" className="btn" onClick={() => commit(-1)}>
              {current.kind === 'faith' ? '存疑' : '跳过'}
            </button>
            <button type="button" className="btn" onClick={flip} disabled={current.kind !== 'faith'}>
              {flipped ? '看正面' : '翻面'}
            </button>
            <button type="button" className="btn main" onClick={() => commit(1)}>
              {current.kind === 'faith' ? '充值' : '记住了'}
            </button>
          </div>
          <div className="keys">
            键盘：<kbd>←</kbd> 存疑　<kbd>→</kbd> 充值　<kbd>空格</kbd> 翻面
          </div>
        </>
      )}
      {notice && <p className="notice" role="status">{notice}</p>}
    </div>
  )
}

interface CardViewProps {
  card: Card
  depth: number
  flipped: boolean
  stat?: CardStat
  firstShort: string
  evText: string
  topRef?: React.MutableRefObject<HTMLElement | null>
  handlers?: {
    onPointerDown: (e: PointerEvent<HTMLElement>) => void
    onPointerMove: (e: PointerEvent<HTMLElement>) => void
    onPointerUp: (e: PointerEvent<HTMLElement>) => void
    onPointerCancel: (e: PointerEvent<HTMLElement>) => void
  }
}

function CardView({ card, depth, flipped, stat, firstShort, evText, topRef, handlers }: CardViewProps) {
  const faith = card.kind === 'faith'
  const who = card.source.via ? `${card.source.name}，经 @${card.source.handle} 转述` : card.source.name
  const charges = stat?.charges ?? 0
  const doubts = stat?.doubts ?? 0
  const crowd = faith
    ? charges + doubts > 0
      ? `已有 ${charges} 人充值，${doubts} 人存疑`
      : '你是第一个刷到这张卡的人'
    : charges > 0
      ? `${charges} 人记住了这张`
      : '你是第一个读到这张的人'

  return (
    <article
      ref={topRef}
      className={`card${faith ? '' : ' sober'}${flipped ? ' flipped' : ''}`}
      style={{ transform: `translateY(${depth * 12}px) scale(${1 - depth * 0.035})`, zIndex: 10 - depth }}
      aria-hidden={depth > 0 ? true : undefined}
      {...handlers}
    >
      <div className="face">
        <div className="c-top">
          <span className="tag">
            {faith ? '信仰' : '清醒'}：{card.tag}
          </span>
          <span className="chk">{card.verify_status === 'verified' ? '已核实' : '据推文，未核实'}</span>
        </div>
        <h3 className="c-title">{card.title}</h3>
        <div className="c-body">
          {!flipped ? (
            <dl className="front">
              {card.rows.map(([label, text]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{text}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <dl className="back">
              <dt className="v">作废条件</dt>
              <dd>{card.void_if}</dd>
              <dt className="k">兑现条件</dt>
              <dd>{card.ok_if}</dd>
            </dl>
          )}
        </div>
        {faith && (
          <div className="c-ev">
            验证：<b>{evText}</b>
          </div>
        )}
        <div className="c-crowd">{crowd}</div>
        <div className="c-src">
          <span className="ava" aria-hidden="true">
            {initial(card)}
          </span>
          <span className="who">
            <b>{who}</b>
            <span>
              {card.source.stance}，{card.source.date}
            </span>
          </span>
          <a href={card.source.url} target="_blank" rel="noopener noreferrer">
            原推
          </a>
        </div>
      </div>
      <div className="stub">
        {faith ? (
          <>
            <span className="s-lab">面值</span>
            <span className="s-val">+{card.charge}</span>
            <span className="s-lab">到期</span>
            <span className="s-date">{firstShort}</span>
          </>
        ) : (
          <>
            <span className="s-vert">清醒</span>
            <span className="s-lab">不加余额</span>
          </>
        )}
      </div>
      <span className="stamp r">{faith ? '充值' : '记住了'}</span>
      <span className="stamp l">{faith ? '存疑' : '跳过'}</span>
    </article>
  )
}

interface ReceiptProps {
  cards: Card[]
  progress: Progress
  stats: Record<string, CardStat>
  firstShort: (c: Card) => string
  onReset: () => void
}

function Receipt({ cards, progress, stats, firstShort, onReset }: ReceiptProps) {
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
    <div className="receipt">
      <h2>{charged.length ? '充值成功' : '今天没有充值'}</h2>
      <p className="sub">
        信仰余额 {progress.balance} 点；清醒卡读了 {soberRead} / {soberTotal} 张
      </p>
      {charged.length ? (
        <>
          <ul className="rc-rows">
            {charged.map((c) => {
              const p = pct(c)
              return (
                <li key={c.id}>
                  <span className="v">+{c.charge}</span>
                  <span>
                    {c.title}
                    {p !== null && <em className="rc-pct">全站 {p}% 的人也充了</em>}
                  </span>
                  <span className="d">{firstShort(c)}</span>
                </li>
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
        <Link className="btn main" href="/calendar">
          查看验证日历
        </Link>
        <button type="button" className="btn" onClick={onReset}>
          重新刷一遍
        </button>
      </div>
    </div>
  )
}
