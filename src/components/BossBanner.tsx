'use client'

import { AnimatePresence, motion } from 'motion/react'
import { topicOf } from '@/lib/dish'
import type { Card } from '@/lib/types'

function bossLine(count: number, total: number, last: Card | null): string {
  if (count === 0) return '盘面绿油油的吧？坐，挑两道踏实的压压惊。'
  if (last) {
    if (last.kind === 'sober') return '点得好，鸡汤喝多容易上头，配口凉菜刚好。'
    const topic = topicOf(last)
    if (topic.includes('基本面')) return '只看利润和估值，这道硬菜最管饱。'
    if (topic.includes('宏观')) return '利率和油价都在松绑，这道趁热吃。'
    if (topic.includes('历史')) return '翻翻百年老菜谱，心就不慌了。'
    if (topic.includes('大佬')) return '听听老炮怎么熬过来的，但别照抄仓位。'
  }
  if (total >= 30) return `已经 ${total} 点信仰了，差不多可以落单。`
  return `点了 ${count} 道，再来一两道就给你打小票。`
}

// 老板一句话：头像 + 对话气泡，代替原来的大插画
export default function BossBanner({ count, total, last, orders }: { count: number; total: number; last: Card | null; orders: number }) {
  const line = bossLine(count, total, last)
  return (
    <section className="boss" aria-label="老板">
      <span className="boss-ava" aria-hidden="true" />
      <div className="boss-bubble">
        <div className="boss-top">
          <b>老板</b>
          <span>今晚已出 {orders} 单</span>
        </div>
        <AnimatePresence mode="wait" initial={false}>
          <motion.p key={line} className="boss-line" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.18 }}>
            {line}
          </motion.p>
        </AnimatePresence>
      </div>
    </section>
  )
}
