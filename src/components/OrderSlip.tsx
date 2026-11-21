'use client'

import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { dishName } from '@/lib/dish'
import type { Card } from '@/lib/types'
import RollingNumber from './fx/RollingNumber'

interface Props {
  table: string | null
  dishes: Card[]
  gifts: Card[]
  total: number
  placing: boolean
  error: string | null
  onPlace: () => void
  onRemove?: (card: Card) => void
}

// 点菜单：只写短菜名和价钱，凉菜写“送”
export default function OrderSlip({ table, dishes, gifts, total, placing, error, onPlace, onRemove }: Props) {
  const [flash, setFlash] = useState(false)
  const prevCount = useRef(dishes.length)

  useEffect(() => {
    if (dishes.length > prevCount.current) {
      setFlash(true)
      const t = window.setTimeout(() => setFlash(false), 540)
      prevCount.current = dishes.length
      return () => window.clearTimeout(t)
    }
    prevCount.current = dishes.length
  }, [dishes.length])

  const row = (c: Card, gift: boolean) => (
    <motion.li
      key={c.id}
      className={`ds-row ds-slip-item${gift ? ' ds-slip-gift' : ''}`}
      layout
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 10 }}
      transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
    >
      <span className="ds-row-name">{gift ? `送 ${dishName(c)}` : dishName(c)}</span>
      <span className="ds-row-dots" />
      {gift ? <span className="ds-row-free">免费</span> : <span className="ds-row-price">{c.charge}</span>}
      {onRemove && (
        <button type="button" className="ds-slip-x" onClick={() => onRemove(c)} aria-label={`退掉 ${dishName(c)}`}>
          退
        </button>
      )}
    </motion.li>
  )

  return (
    <div className={`ds-slip${flash ? ' is-flash' : ''}`}>
      <div className="ds-slip-head">
        <b>点菜单</b>
        {table && <span>{table} 桌</span>}
      </div>
      {dishes.length === 0 ? (
        <p className="ds-slip-empty">还没点菜，右滑牌子或点「加一份」记单</p>
      ) : (
        <ul className="ds-slip-list">
          <AnimatePresence initial={false}>
            {dishes.map((c) => row(c, false))}
            {gifts.map((c) => row(c, true))}
          </AnimatePresence>
        </ul>
      )}
      <div className="ds-slip-total">
        <span>合计信仰</span>
        <motion.b key={total} initial={total ? { scale: 1.18 } : false} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 340, damping: 16 }}>
          <RollingNumber value={total} />
        </motion.b>
      </div>
      <button type="button" className="ds-btn ds-btn--primary ds-btn--block" onClick={onPlace} disabled={!dishes.length || placing}>
        {placing ? '正在落单…' : '落单，打小票'}
      </button>
      {error && (
        <p className="ds-slip-err" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
