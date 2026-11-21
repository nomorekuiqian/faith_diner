'use client'

import { animate, motion, useMotionValue, useSpring, useTransform } from 'motion/react'
import { forwardRef, useImperativeHandle, useRef, useState } from 'react'
import { courseOf, dishName, keyDataOf, logicOf, pointOf, watchOf } from '@/lib/dish'
import type { Card, CardStat, VerifyEvent } from '@/lib/types'

export interface BoardHandle {
  fling: (dir: 1 | -1) => void
}

interface Props {
  card: Card
  depth: number
  interactive: boolean
  flipped: boolean
  stat?: CardStat
  ev?: VerifyEvent
  evText: string
  reduced: boolean
  deal: boolean
  onFlip: () => void
  onFlingStart: (dir: 1 | -1, rect: DOMRect) => void
  onSwiped: (dir: 1 | -1) => void
}

// 今日推介牌：往右拖是加一份，往左拖是存疑，点一下翻到背面看做法和退菜规则
const BoardCard = forwardRef<BoardHandle, Props>(function BoardCard(
  { card, depth, interactive, flipped, stat, ev, evText, reduced, deal, onFlip, onFlingStart, onSwiped },
  ref
) {
  const faith = card.kind === 'faith'
  const el = useRef<HTMLElement>(null)
  const flying = useRef(false)
  const x = useMotionValue(0)
  const rotate = useTransform(x, [-320, 0, 320], [-14, 0, 14])
  const stampR = useTransform(x, [24, 110], [0, 1])
  const stampL = useTransform(x, [-110, -24], [1, 0])
  const stampRScale = useTransform(x, [24, 110], [1.2, 1])
  const stampLScale = useTransform(x, [-110, -24], [1, 1.2])

  // 桌面端轻量 3D 悬停倾斜 + 玻璃扫光位置
  const tiltX = useSpring(0, { stiffness: 260, damping: 26 })
  const tiltY = useSpring(0, { stiffness: 260, damping: 26 })
  const sheenX = useSpring(50, { stiffness: 220, damping: 28 })
  const sheenY = useSpring(30, { stiffness: 220, damping: 28 })
  const [hovering, setHovering] = useState(false)

  const sheenTransform = useTransform([sheenX, sheenY], ([sx, sy]: number[]) => `translate3d(${(sx - 50) * 0.9}%, ${(sy - 50) * 0.9}%, 0)`)

  const onPointerMove = (e: React.PointerEvent<HTMLElement>) => {
    if (!interactive || reduced || e.pointerType !== 'mouse' || flying.current) return
    const rect = e.currentTarget.getBoundingClientRect()
    const px = (e.clientX - rect.left) / rect.width
    const py = (e.clientY - rect.top) / rect.height
    tiltX.set((0.5 - py) * 6)
    tiltY.set((px - 0.5) * 6)
    sheenX.set(px * 100)
    sheenY.set(py * 100)
    if (!hovering) setHovering(true)
  }

  const onPointerLeave = () => {
    setHovering(false)
    tiltX.set(0)
    tiltY.set(0)
  }

  const fling = (dir: 1 | -1) => {
    if (flying.current || !el.current) return
    flying.current = true
    onFlingStart(dir, el.current.getBoundingClientRect())
    if (reduced) {
      onSwiped(dir)
      return
    }
    const target = dir * Math.max(720, window.innerWidth * 0.9)
    void animate(x, target, { duration: 0.36, ease: [0.3, 0.6, 0.4, 1] }).then(() => onSwiped(dir))
  }
  useImperativeHandle(ref, () => ({ fling }))

  const sold = stat?.charges ?? 0
  const keyData = keyDataOf(card)
  const logic = logicOf(card)
  const watch = watchOf(card)

  return (
    <motion.article
      ref={el}
      className={`bc-card${faith ? '' : ' is-sober'}${interactive ? ' is-live' : ''}${hovering ? ' is-hover' : ''}`}
      style={{ x, rotate, rotateX: tiltX, rotateY: tiltY, zIndex: 10 - depth }}
      initial={deal && !reduced ? { y: 40, opacity: 0 } : { y: (depth + 1) * 10, scale: 1 - (depth + 1) * 0.03, opacity: 0 }}
      animate={{ y: depth * 10, scale: 1 - depth * 0.03, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 260, damping: 26, delay: deal && !reduced ? (2 - depth) * 0.08 : 0 }}
      aria-hidden={depth > 0 ? true : undefined}
      drag={interactive && !reduced ? 'x' : false}
      dragMomentum={false}
      dragElastic={0.8}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      onDragStart={() => {
        setHovering(false)
        tiltX.set(0)
        tiltY.set(0)
      }}
      onDragEnd={(_, info) => {
        if (info.offset.x > 110 || info.velocity.x > 650) fling(1)
        else if (info.offset.x < -110 || info.velocity.x < -650) fling(-1)
        else void animate(x, 0, { type: 'spring', stiffness: 420, damping: 30 })
      }}
      onTap={(e) => {
        if (!interactive) return
        if ((e.target as HTMLElement).closest('a')) return
        onFlip()
      }}
    >
      <motion.div
        className="bc-flipper"
        initial={false}
        animate={{ rotateY: flipped ? 180 : 0 }}
        transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 170, damping: 20 }}
      >
        <div className="bc-face bc-front">
          {interactive && !reduced && <motion.span className="bc-sheen" style={{ transform: sheenTransform }} aria-hidden="true" />}
          <div className="bc-top">
            <span className={`ds-tag${faith ? '' : ' ds-tag--sober'}`}>{courseOf(card)}</span>
            {faith && card.charge >= 12 && <span className="ds-badge">推荐</span>}
            <span className="bc-sold">已售 {sold}</span>
          </div>
          <div className="bc-head">
            <h3 className="bc-dish">{dishName(card)}</h3>
            {faith ? (
              <span className="ds-price ds-price--lg">
                {card.charge}
                <small>信仰</small>
              </span>
            ) : (
              <span className="ds-price ds-price--free">免费</span>
            )}
          </div>
          <p className="bc-claim">{card.title}</p>
          <p className="bc-point">{pointOf(card)}</p>
          <div className="bc-foot">
            <span>出品 {card.source.name}</span>
            {ev && <span>关注 {ev.short_label}</span>}
          </div>
        </div>

        <div className="bc-face bc-back">
          <div className="bc-top">
            <span className="ds-tag">观点拆解</span>
          </div>
          <h3 className="bc-dish bc-dish--sm">{dishName(card)}</h3>
          <dl className="bc-dl">
            {keyData && (
              <>
                <dt>关键数据</dt>
                <dd>{keyData}</dd>
              </>
            )}
            {logic && (
              <>
                <dt>逻辑链条</dt>
                <dd>{logic}</dd>
              </>
            )}
            {watch && (
              <>
                <dt className="is-ok">接下来关注什么</dt>
                <dd>{watch}</dd>
              </>
            )}
            {!keyData && !logic && !watch && <dd>{pointOf(card)}</dd>}
          </dl>
          {evText && <p className="bc-ev">关注节点：{evText}</p>}
          <a className="ds-link bc-src" href={card.source.url} target="_blank" rel="noopener noreferrer" onPointerDown={(e) => e.stopPropagation()}>
            看原文：{card.source.name}
          </a>
        </div>
      </motion.div>

      <motion.span className="bc-stamp r" style={{ opacity: stampR, scale: stampRScale }} aria-hidden="true">
        {faith ? '加一份' : '记下了'}
      </motion.span>
      <motion.span className="bc-stamp l" style={{ opacity: stampL, scale: stampLScale }} aria-hidden="true">
        {faith ? '存疑' : '跳过'}
      </motion.span>
    </motion.article>
  )
})

export default BoardCard
