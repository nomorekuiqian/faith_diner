'use client'

import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { eventBriefOf } from '@/lib/events'
import type { Card, CardStat, VerifyEvent } from '@/lib/types'
import { usePicks } from './usePicks'

interface Props {
  deckId: string
  cards: Card[]
  events: VerifyEvent[]
  stats: Record<string, CardStat>
}

export default function CalendarList({ deckId, cards, events, stats }: Props) {
  const reduced = useReducedMotion()
  const picks = usePicks(deckId)
  const [now, setNow] = useState<number | null>(null)
  const [onlyMine, setOnlyMine] = useState(false)
  const [openKey, setOpenKey] = useState<string | null>(null)

  useEffect(() => setNow(Date.now()), [])

  const myIds = useMemo(() => new Set(Object.entries(picks).filter(([, v]) => v === 1).map(([k]) => k)), [picks])

  const dated = useMemo(() => events.filter((e) => Boolean(e.happens_at)).sort((a, b) => a.sort - b.sort), [events])
  const ongoing = useMemo(() => events.filter((e) => !e.happens_at).sort((a, b) => a.sort - b.sort), [events])

  const nextAt = useMemo(() => {
    if (now === null) return null
    return (
      dated
        .map((e) => Date.parse(e.happens_at!))
        .filter((t) => t > now)
        .sort((a, b) => a - b)[0] ?? null
    )
  }, [dated, now])

  const filterEvents = (list: VerifyEvent[]) => {
    if (!onlyMine) return list
    return list.filter((e) => cards.some((c) => c.event_keys.includes(e.key) && myIds.has(c.id)))
  }

  const shownDated = filterEvents(dated)
  const shownOngoing = filterEvents(ongoing)

  const renderRelated = (evKey: string, linked: Card[]) => {
    const isOpen = openKey === evKey
    if (!linked.length) return null
    // 自己选过的观点排在最前面
    const sorted = [...linked].sort((a, b) => Number(myIds.has(b.id)) - Number(myIds.has(a.id)))
    return (
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.ul
            className="ev-related"
            initial={reduced ? false : { opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduced ? undefined : { opacity: 0, y: -6 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          >
            {sorted.map((c) => {
              const mine = myIds.has(c.id)
              return (
                <li key={c.id} className={mine ? 'is-mine' : undefined}>
                  <span>{c.title}</span>
                  <span className="ev-rel-badge">{mine ? '你已选' : c.kind === 'faith' ? `+${c.charge} 信仰` : '风险提示'}</span>
                </li>
              )
            })}
          </motion.ul>
        )}
      </AnimatePresence>
    )
  }

  return (
    <>
      <header className="ev-hero">
        <div>
          <h1>未来事件</h1>
          <p>决定接下来美股走向的关键日程与盯盘指标。过段时间拿出你存下的小票，就能对照这些节点看当时的判断是对是错。</p>
        </div>
        <div className="ev-filter" role="group" aria-label="筛选未来事件">
          <button type="button" className="ds-chip" aria-pressed={!onlyMine} onClick={() => setOnlyMine(false)}>
            {!onlyMine && (
              <motion.span
                className="ds-chip-pill"
                layoutId="ev-filter-pill"
                transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 32 }}
                aria-hidden="true"
              />
            )}
            <span className="ds-chip-label">全部事件</span>
          </button>
          <button type="button" className="ds-chip" aria-pressed={onlyMine} onClick={() => setOnlyMine(true)}>
            {onlyMine && (
              <motion.span
                className="ds-chip-pill"
                layoutId="ev-filter-pill"
                transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 32 }}
                aria-hidden="true"
              />
            )}
            <span className="ds-chip-label">只看与我选的有关{myIds.size ? ` (${myIds.size})` : ''}</span>
          </button>
        </div>
      </header>

      {onlyMine && shownDated.length === 0 && shownOngoing.length === 0 ? (
        <div className="ev-empty">
          <p>你还没有选中与未来事件关联的市场观点。去首页挑几道你认同的逻辑，这里会自动汇总你需要盯的节点。</p>
          <Link className="ds-btn ds-btn--primary" href="/">
            去挑今日观点
          </Link>
        </div>
      ) : (
        <>
          {shownDated.length > 0 && (
            <section className="ev-sec" aria-label="重要时间节点">
              <div className="ev-sec-head">
                <h2>重要时间节点</h2>
                <span>按时间先后排列 · 共 {shownDated.length} 场</span>
              </div>
              <ul className="ev-list">
                {shownDated.map((e, idx) => {
                  const brief = eventBriefOf(e)
                  const linked = cards.filter((c) => c.event_keys.includes(e.key))
                  const mineCount = linked.filter((c) => myIds.has(c.id)).length
                  const believers = linked
                    .filter((c) => c.kind === 'faith')
                    .reduce((a, c) => a + (stats[c.id]?.charges ?? 0), 0)
                  let countdown = ''
                  if (e.happens_at && now !== null) {
                    const d = Math.ceil((Date.parse(e.happens_at) - now) / 86400000)
                    countdown = d > 0 ? `还有 ${d} 天` : '已到节点'
                  }
                  const isNext = nextAt !== null && e.happens_at !== null && Date.parse(e.happens_at) === nextAt
                  const isOpen = openKey === e.key

                  return (
                    <motion.li
                      key={e.key}
                      className={`ev-card${isNext ? ' is-next' : ''}`}
                      initial={reduced ? false : { opacity: 0, y: 14 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.36, delay: Math.min(idx * 0.05, 0.25), ease: [0.22, 1, 0.36, 1] }}
                    >
                      <div className="ev-card-grid">
                        <div className="ev-date">
                          <span className="ev-date-big">{e.short_label}</span>
                          <span className="ev-date-sub">{e.when_label}</span>
                        </div>
                        <div className="ev-body">
                          <div className="ev-top">
                            {isNext && <span className="ds-badge">下一场重点</span>}
                            <span className="ds-tag">{brief.tag}</span>
                            {countdown && <span className="ev-countdown">{countdown}</span>}
                            {mineCount > 0 && <span className="ev-mine">与你选的 {mineCount} 条有关</span>}
                          </div>
                          <h3 className="ev-title">{e.name}</h3>
                          <p className="ev-summary">{brief.summary}</p>
                          <div className="ev-foot">
                            <span>{believers ? `全站 ${believers} 次认同押注在此节点` : '等待市场资金表态'}</span>
                            {linked.length > 0 && (
                              <button
                                type="button"
                                className="ev-toggle"
                                aria-expanded={isOpen}
                                onClick={() => setOpenKey(isOpen ? null : e.key)}
                              >
                                {isOpen ? '收起关联观点' : `查看关联的 ${linked.length} 条观点`}
                              </button>
                            )}
                          </div>
                          {renderRelated(e.key, linked)}
                        </div>
                      </div>
                    </motion.li>
                  )
                })}
              </ul>
            </section>
          )}

          {shownOngoing.length > 0 && (
            <section className="ev-sec" aria-label="持续盯盘指标">
              <div className="ev-sec-head">
                <h2>持续盯盘指标</h2>
                <span>没有固定日期，但每天影响盘面强弱</span>
              </div>
              <ul className="ev-ongoing">
                {shownOngoing.map((e, idx) => {
                  const brief = eventBriefOf(e)
                  const linked = cards.filter((c) => c.event_keys.includes(e.key))
                  const mineCount = linked.filter((c) => myIds.has(c.id)).length
                  const isOpen = openKey === e.key

                  return (
                    <motion.li
                      key={e.key}
                      className="ev-watch-card"
                      initial={reduced ? false : { opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.34, delay: Math.min(idx * 0.04, 0.2), ease: [0.22, 1, 0.36, 1] }}
                    >
                      <div className="ev-top">
                        <span className="ds-tag ds-tag--sober">{brief.tag}</span>
                        {mineCount > 0 && <span className="ev-mine">与你选的 {mineCount} 条有关</span>}
                      </div>
                      <h3 className="ev-title">{e.name}</h3>
                      <p className="ev-summary">{brief.summary}</p>
                      <div className="ev-foot">
                        <span>{e.when_label}</span>
                        {linked.length > 0 && (
                          <button
                            type="button"
                            className="ev-toggle"
                            aria-expanded={isOpen}
                            onClick={() => setOpenKey(isOpen ? null : e.key)}
                          >
                            {isOpen ? '收起' : `${linked.length} 条相关观点`}
                          </button>
                        )}
                      </div>
                      {renderRelated(e.key, linked)}
                    </motion.li>
                  )
                })}
              </ul>
            </section>
          )}
        </>
      )}
    </>
  )
}
