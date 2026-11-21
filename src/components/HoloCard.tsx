'use client'

import { animate, motion, useMotionTemplate, useMotionValue, useSpring, useTransform } from 'motion/react'
import { forwardRef, useImperativeHandle, useRef } from 'react'
import { keyDataOf, logicOf, watchOf } from '@/lib/dish'
import type { Card, CardStat } from '@/lib/types'

export interface HoloHandle {
  fling: (dir: 1 | -1) => void
}

interface Props {
  card: Card
  depth: number
  interactive: boolean
  flipped: boolean
  stat?: CardStat
  firstShort: string
  evText: string
  reduced: boolean
  deal: boolean
  onFlip: () => void
  onFlingStart: (dir: 1 | -1, rect: DOMRect) => void
  onSwiped: (dir: 1 | -1) => void
}

function initial(card: Card) {
  const c = (card.source.handle || card.source.name).charAt(0)
  return /[a-z]/i.test(c) ? c.toUpperCase() : c
}

const HoloCard = forwardRef<HoloHandle, Props>(function HoloCard(
  { card, depth, interactive, flipped, stat, firstShort, evText, reduced, deal, onFlip, onFlingStart, onSwiped },
  ref
) {
  const faith = card.kind === 'faith'
  const el = useRef<HTMLElement>(null)
  const flying = useRef(false)

  const x = useMotionValue(0)
  const rotate = useTransform(x, [-320, 0, 320], [-20, 0, 20])
  const stampR = useTransform(x, [24, 120], [0, 1])
  const stampL = useTransform(x, [-120, -24], [1, 0])
  const tiltX = useSpring(0, { stiffness: 180, damping: 16 })
  const tiltY = useSpring(0, { stiffness: 180, damping: 16 })
  const px = useMotionValue(50)
  const py = useMotionValue(50)
  const foilPos = useMotionTemplate`${px}% ${py}%`
  const glare = useMotionTemplate`radial-gradient(circle at ${px}% ${py}%, rgba(255,255,255,.75), rgba(255,255,255,0) 45%)`
  const foilOpacity = useSpring(faith ? 0.28 : 0, { stiffness: 120, damping: 20 })

  const fling = (dir: 1 | -1) => {
    if (flying.current || !el.current) return
    flying.current = true
    onFlingStart(dir, el.current.getBoundingClientRect())
    tiltX.set(0)
    tiltY.set(0)
    if (reduced) {
      onSwiped(dir)
      return
    }
    const target = dir * Math.max(760, window.innerWidth * 0.9)
    void animate(x, target, { duration: 0.42, ease: [0.25, 0.7, 0.3, 1] }).then(() => onSwiped(dir))
  }
  useImperativeHandle(ref, () => ({ fling }))

  const dealFrom = { y: -520, rotate: (depth - 1) * 14, opacity: 0, scale: 0.9 }

  return (
    <motion.article
      ref={el}
      className={`card${faith ? '' : ' sober'}${interactive ? ' live' : ''}`}
      style={{ x, rotate, rotateX: tiltX, rotateY: tiltY, zIndex: 10 - depth }}
      initial={deal && !reduced ? dealFrom : { y: (depth + 1) * 14, scale: 1 - (depth + 1) * 0.04, opacity: 0 }}
      animate={{ y: depth * 14, scale: 1 - depth * 0.04, opacity: 1, rotate: 0 }}
      transition={{
        type: 'spring',
        stiffness: 210,
        damping: 22,
        delay: deal && !reduced ? (2 - depth) * 0.14 + 0.15 : 0
      }}
      aria-hidden={depth > 0 ? true : undefined}
      drag={interactive && !reduced ? 'x' : false}
      dragMomentum={false}
      dragElastic={0.9}
      onDragStart={() => {
        tiltX.set(0)
        tiltY.set(0)
      }}
      onDragEnd={(_, info) => {
        if (info.offset.x > 110 || info.velocity.x > 650) fling(1)
        else if (info.offset.x < -110 || info.velocity.x < -650) fling(-1)
        else void animate(x, 0, { type: 'spring', stiffness: 420, damping: 26 })
      }}
      onTap={(e) => {
        if (!interactive) return
        if ((e.target as HTMLElement).closest('a')) return
        onFlip()
      }}
      onPointerMove={(e) => {
        if (!interactive || reduced || e.pointerType !== 'mouse' || e.buttons) return
        const r = e.currentTarget.getBoundingClientRect()
        const nx = (e.clientX - r.left) / r.width
        const ny = (e.clientY - r.top) / r.height
        tiltY.set((nx - 0.5) * 26)
        tiltX.set(-(ny - 0.5) * 20)
        px.set(nx * 100)
        py.set(ny * 100)
        foilOpacity.set(faith ? 0.85 : 0.25)
      }}
      onPointerLeave={() => {
        tiltX.set(0)
        tiltY.set(0)
        px.set(50)
        py.set(50)
        foilOpacity.set(faith ? 0.28 : 0)
      }}
    >
      <motion.div
        className="flipper"
        initial={false}
        animate={{ rotateY: flipped ? 180 : 0 }}
        transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 140, damping: 15 }}
      >
        {/* 正面 */}
        <div className="side front-side">
          <div className="face">
            <div className="c-top">
              <span className="tag">{card.tag}</span>
              <span className="chk">{card.verify_status === 'verified' ? '已核实' : '据原源整理'}</span>
            </div>
            <h3 className="c-title">{card.title}</h3>
            <div className="c-body">
              <dl className="front">
                {logicOf(card) ? (
                  <div>
                    <dd className="plain">{logicOf(card)}</dd>
                  </div>
                ) : (
                  card.rows
                    .filter(([label]) => label !== '详情' && label !== '关键数据' && label !== '关注什么')
                    .map(([label, text], i) => (
                      <div key={`${label}-${i}`}>
                        {label && <dt>{label}</dt>}
                        <dd className={label ? undefined : 'plain'}>{text}</dd>
                      </div>
                    ))
                )}
              </dl>
            </div>
            {faith && (
              <div className="c-ev">
                验证：<b>{evText}</b>
              </div>
            )}
            <Crowd faith={faith} stat={stat} />
            <div className="c-src">
              <span className="ava" aria-hidden="true">
                {initial(card)}
              </span>
              <span className="who">
                <b>{card.source.via ? `${card.source.name}，经 @${card.source.handle} 转述` : card.source.name}</b>
                <span>
                  {card.source.stance}，{card.source.date}
                </span>
              </span>
              <a href={card.source.url} target="_blank" rel="noopener noreferrer" onPointerDown={(e) => e.stopPropagation()}>
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
                <span className="s-vert">解腻</span>
                <span className="s-lab">不加余额</span>
              </>
            )}
          </div>
          <motion.div className="holo" style={{ backgroundPosition: foilPos, opacity: foilOpacity }} aria-hidden="true" />
          <motion.div className="glare" style={{ background: glare }} aria-hidden="true" />
        </div>

        {/* 背面 */}
        {(keyDataOf(card) || logicOf(card) || watchOf(card)) && (
          <div className="side back-side">
            <div className="b-head">
              <span className="tag">观点拆解</span>
              <span className="chk">{faith ? '数据、逻辑与关注点' : '看清风险与关注点'}</span>
            </div>
            <h3 className="c-title">{card.title}</h3>
            <dl className="back">
              {keyDataOf(card) && (
                <div>
                  <dt>关键数据</dt>
                  <dd style={{ whiteSpace: 'pre-line' }}>{keyDataOf(card)}</dd>
                </div>
              )}
              {logicOf(card) && (
                <div>
                  <dt>逻辑链条</dt>
                  <dd>{logicOf(card)}</dd>
                </div>
              )}
              {watchOf(card) && (
                <div>
                  <dt className="k">接下来关注什么</dt>
                  <dd style={{ whiteSpace: 'pre-line' }}>{watchOf(card)}</dd>
                </div>
              )}
            </dl>
            {faith && evText && (
              <div className="c-ev">
                验证：<b>{evText}</b>
              </div>
            )}
            <div className="b-foot">再点一下翻回正面</div>
          </div>
        )}
      </motion.div>

      <motion.span className="stamp r" style={{ opacity: stampR }}>
        {faith ? '充值' : '记住了'}
      </motion.span>
      <motion.span className="stamp l" style={{ opacity: stampL }}>
        {faith ? '存疑' : '跳过'}
      </motion.span>
    </motion.article>
  )
})

function Crowd({ faith, stat }: { faith: boolean; stat?: CardStat }) {
  const charges = stat?.charges ?? 0
  const doubts = stat?.doubts ?? 0
  const total = charges + doubts
  if (!faith) {
    return <div className="c-crowd">{charges > 0 ? `${charges} 人记住了这张` : '你是第一个读到这张的人'}</div>
  }
  if (!total) return <div className="c-crowd">你是第一个刷到这张卡的人</div>
  const pct = Math.round((charges / total) * 100)
  return (
    <div className="c-crowd">
      <span className="crowd-bar" aria-hidden="true">
        <i style={{ width: `${pct}%` }} />
      </span>
      全站 {charges} 人充值，{doubts} 人存疑
    </div>
  )
}

export default HoloCard
