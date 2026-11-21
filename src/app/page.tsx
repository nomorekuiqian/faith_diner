import Deck from '@/components/Deck'
import NextCheck from '@/components/NextCheck'
import { getLatestDeck } from '@/lib/data'

export const dynamic = 'force-dynamic'

export default async function Home() {
  const { deck, cards, events, stats } = await getLatestDeck()
  const authors = Array.from(new Map(cards.map((c) => [c.source.name, c.source])).values())

  return (
    <section className="v-deck">
      <div className="deck-col">
        <div className="intro">
          <h1>{deck.title}</h1>
          <p>
            {cards.length} 张卡，来自 {authors.length} 个来源近 10 天的公开推文。右滑充值，左滑存疑，点卡片看它在什么情况下作废。
          </p>
        </div>
        <Deck deckId={deck.id} cards={cards} events={events} initialStats={stats} />
      </div>

      <aside className="aside">
        <div>
          <h2>下一个验证点</h2>
          <NextCheck deckId={deck.id} cards={cards} events={events} />
        </div>
        <div>
          <h2>今天的牌来自这些人</h2>
          <div className="authors">
            {authors.map((s) => {
              const c = (s.handle || s.name).charAt(0)
              return (
                <span key={s.name}>
                  <span className="ava" aria-hidden="true">
                    {/[a-z]/i.test(c) ? c.toUpperCase() : c}
                  </span>
                  {s.name}
                </span>
              )
            })}
          </div>
        </div>
        <p className="how">
          每张卡都是从近 10 天的公开推文里挑出来、再用中文改写的。看多的叫信仰卡，有面值，会加余额；看空或提醒风险的叫清醒卡，不加余额，但每 2 到 3 张信仰卡后面就会插一张。你的每次滑动都会记到后台，卡片上显示的是全站的充值人数。
        </p>
      </aside>
    </section>
  )
}
