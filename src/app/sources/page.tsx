import { getLatestDeck } from '@/lib/data'
import type { Card } from '@/lib/types'

export const dynamic = 'force-dynamic'
export const metadata = { title: '食材来源 · 美股信仰食堂' }

export default async function SourcesPage() {
  const { cards } = await getLatestDeck()
  const groups = new Map<string, Card[]>()
  for (const c of cards) groups.set(c.source.name, [...(groups.get(c.source.name) ?? []), c])
  const faith = cards.filter((c) => c.kind === 'faith').length

  return (
    <section className="page">
      <h1>这些食材从哪来</h1>
      <p className="lede">
        当前卡池共 {cards.length} 道菜（{faith} 道信仰菜，{cards.length - faith} 道清醒避坑），来自 {groups.size} 个数据与观点来源。
      </p>
      <h2>怎么备菜的</h2>
      <ol className="rules">
        <li>一手宏观与财报数据：通过 Financial Modeling Prep（FMP）直接拉取美国 GDP、就业、零售、CPI、美债收益率、原油与核心科技股最新财报。</li>
        <li>经典常青历史库：美股百年回撤与长期胜率、比特币周期规律、巴菲特 / 彼得·林奇 / 霍华德·马克斯等经得起周期检验的原则。</li>
        <li>市场观点精选：从 MarketBrew 推文库筛出带具体数据或明确逻辑的看多观点与风险提醒，剔除纯情绪喊单帖。</li>
        <li>所有卡片均附原始出处与作废/兑现条件，方便到期回头验菜。</li>
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
                      {card.tag}
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
