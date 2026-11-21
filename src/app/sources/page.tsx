import { getLatestDeck } from '@/lib/data'
import type { Card } from '@/lib/types'

export const dynamic = 'force-dynamic'
export const metadata = { title: '来源 · 信仰充值站' }

export default async function SourcesPage() {
  const { cards } = await getLatestDeck()
  const groups = new Map<string, Card[]>()
  for (const c of cards) groups.set(c.source.name, [...(groups.get(c.source.name) ?? []), c])
  const faith = cards.filter((c) => c.kind === 'faith').length

  return (
    <section className="page">
      <h1>这副牌从哪来</h1>
      <p className="lede">
        今天这 {cards.length} 张卡来自 {groups.size} 个来源：{faith} 张信仰卡，{cards.length - faith} 张清醒卡。
      </p>
      <h2>怎么挑的</h2>
      <ol className="rules">
        <li>从 MarketBrew 已抓取的推文里取最近 10 天的原创帖，不含回复。</li>
        <li>按关键词筛出和这轮下跌有关的内容：恐慌指数、历史回报、超卖、加息、通胀、比特币、抄底、熊市等，再按点赞数排序。</li>
        <li>保留有具体数据或明确判断的帖子，看多做成信仰卡，看空或提醒风险做成清醒卡。</li>
        <li>不收：直接给买卖点位的喊单帖、涉及个人私生活的新闻、只有情绪没有论据的帖子。</li>
        <li>原文改写成中文摘要，附原推链接。推文里的数字都没有经过独立核实。</li>
      </ol>
      <h2>来源列表</h2>
      <ul className="src-list">
        {Array.from(groups.entries()).map(([name, list]) => {
          const s = list[0].source
          const c = (s.handle || s.name).charAt(0)
          return (
            <li key={name}>
              <span className="ava" aria-hidden="true">
                {/[a-z]/i.test(c) ? c.toUpperCase() : c}
              </span>
              <div className="meta">
                <b>{s.via ? `${s.name}（经 @${s.handle} 转述）` : `${s.name} @${s.handle}`}</b>
                <span>{s.stance}</span>
                <div>
                  {list.map((card) => (
                    <a key={card.id} href={card.source.url} target="_blank" rel="noopener noreferrer">
                      {card.kind === 'faith' ? '信仰卡' : '清醒卡'}：{card.tag}
                    </a>
                  ))}
                </div>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
