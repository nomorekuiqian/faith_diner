'use client'

import { motion } from 'motion/react'
import RollingNumber from './fx/RollingNumber'

interface Props {
  count: number
  total: number
  placing: boolean
  onOpen: () => void
  onPlace: () => void
  className?: string
}

// 手机底部点菜条：左边点开点菜单，右边直接落单
export default function OrderBar({ count, total, placing, onOpen, onPlace, className }: Props) {
  return (
    <div className={`ds-orderbar${className ? ` ${className}` : ''}`}>
      <div className="ds-orderbar-in">
        <button type="button" className="ds-orderbar-sum" onClick={onOpen} aria-label="打开点菜单">
          <span>{count ? `已点 ${count} 道` : '还没点菜'}</span>
          <motion.b key={total} initial={total ? { scale: 1.22 } : false} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 320, damping: 14 }}>
            <RollingNumber value={total} />
          </motion.b>
        </button>
        <button type="button" className="ds-btn ds-btn--primary" onClick={onPlace} disabled={!count || placing}>
          {placing ? '落单中' : '落单'}
        </button>
      </div>
    </div>
  )
}
