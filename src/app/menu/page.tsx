import Menu from '@/components/Menu'
import { getLatestDeck } from '@/lib/data'

export const dynamic = 'force-dynamic'
export const metadata = { title: '全部菜单 · 美股信仰食堂' }

export default async function MenuPage() {
  const { deck, cards, events, stats, orders } = await getLatestDeck()
  return <Menu deck={deck} cards={cards} events={events} stats={stats} orders={orders} />
}
