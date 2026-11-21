import CalendarList from '@/components/CalendarList'
import { getLatestDeck } from '@/lib/data'

export const dynamic = 'force-dynamic'
export const metadata = { title: '验菜日历 · 美股信仰食堂' }

export default async function CalendarPage() {
  const { deck, cards, events, stats } = await getLatestDeck()
  return (
    <section className="page">
      <h1>验菜日历</h1>
      <p className="lede">每道信仰菜都有取餐时间。到了这一天，就能看出它是兑现了还是作废了。</p>
      <CalendarList deckId={deck.id} cards={cards} events={events} stats={stats} />
      <p className="note">美联储议息、11 月 CPI、11 月 PCE 的时间已按官方日历核对；2027 年的财报季和回看时间是估计。</p>
    </section>
  )
}
