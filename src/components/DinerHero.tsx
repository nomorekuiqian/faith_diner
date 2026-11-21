'use client'

import { AnimatePresence, motion } from 'motion/react'
import type { Card } from '@/lib/types'

interface Props {
  orderCount: number
  faithCount: number
  soberCount: number
  cartCount: number
  total: number
  lastPicked: Card | null
  table: string
}

function chefLine(cartCount: number, total: number, lastPicked: Card | null): string {
  if (cartCount === 0) {
    return '外头盘面绿油油的吧？坐，窗边暖和，挑两道踏实的压压惊。'
  }
  if (lastPicked) {
    if (lastPicked.kind === 'sober') {
      return '点得聪明——多头鸡汤喝多容易上头，配口清醒避坑刚刚好。'
    }
    if (lastPicked.tag === '基本面') {
      return '行家啊，只看利润和估值，这口硬菜最管饱、拿得最稳。'
    }
    if (lastPicked.tag === '宏观风向') {
      return '利率和油价都在悄悄松绑，这道宏观菜趁热吃。'
    }
    if (lastPicked.tag === '历史数据') {
      return '太阳底下没新鲜事，翻翻百年老菜谱，心就不慌了。'
    }
    if (lastPicked.tag === '大佬观点') {
      return '听听老炮们怎么熬过来的，但记住别盲目跟单，拿稳自己的仓位。'
    }
  }
  if (total >= 30) {
    return `已经凑够 +${total} 点信仰啦，差不多就下单出小票，别吃撑了。`
  }
  return `已经点了 ${cartCount} 道，再来一两道，我让后厨给你把小票打出来。`
}

export default function DinerHero({ orderCount, faithCount, soberCount, cartCount, total, lastPicked, table }: Props) {
  const speech = chefLine(cartCount, total, lastPicked)

  return (
    <section className="diner-hero" aria-label="美股信仰食堂吧台">
      <div className="dh-frame">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="dh-art" src="/diner-scene.jpg" alt="阳光洒进窗台的暖木食堂吧台，老板微笑端着木盘迎接客人" />

        {/* 门头微风暖帘 */}
        <div className="dh-noren" aria-hidden="true">
          <span>美</span>
          <span>股</span>
          <span>信</span>
          <span>仰</span>
          <span>食</span>
          <span>堂</span>
        </div>

        {/* 汤锅袅袅热气 */}
        <div className="dh-steam" aria-hidden="true">
          <i />
          <i />
          <i />
        </div>

        {/* 窗边阳光微尘 */}
        <div className="dh-sun" aria-hidden="true" />

        {/* 左上墙面：木牌招牌与核心宣言 */}
        <div className="dh-sign">
          <div className="dh-badge">
            <span className="dh-dot" aria-hidden="true" />
            <span>营业中 · {table} 桌</span>
          </div>
          <h1>大跌之后不要慌，来信仰食堂充值一些信仰吧</h1>
          <p className="dh-sub">看清市场上的信仰与风险提示，选你信的打张小票。</p>
          <div className="dh-stat">
            <span>今日已出单</span>
            <b>{orderCount}</b>
            <span>桌</span>
          </div>
        </div>

        {/* 右侧老板搭话气泡 */}
        <div className="dh-chef-wrap">
          <AnimatePresence mode="wait">
            <motion.div
              key={speech}
              className="dh-bubble"
              initial={{ opacity: 0, y: 8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.97 }}
              transition={{ duration: 0.25 }}
            >
              <span className="dh-who">老板</span>
              <p>{speech}</p>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </section>
  )
}
