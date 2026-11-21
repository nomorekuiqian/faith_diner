import CalendarList from '@/components/CalendarList'
import { getLatestDeck } from '@/lib/data'

export const dynamic = 'force-dynamic'
export const metadata = { title: '未来事件 · 美股信仰食堂' }

export default async function CalendarPage() {
  const { deck, cards, events, stats } = await getLatestDeck()
  return (
    <section className="ev-page">
      <CalendarList deckId={deck.id} cards={cards} events={events} stats={stats} />
      <p className="ev-note">美联储议息、11 月 CPI、11 月 PCE 时间已按官方日程核对；2027 年财报季及中期回看为预计窗口。</p>
    </section>
  )
}
