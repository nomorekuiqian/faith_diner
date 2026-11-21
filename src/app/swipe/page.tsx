import DinerSwipeHome from '@/components/DinerSwipeHome'
import { getLatestDeck } from '@/lib/data'

export const dynamic = 'force-dynamic'
export const metadata = { title: '翻牌点菜 · 美股信仰食堂' }

export default async function SwipePage() {
  const { deck, cards, events, stats, orders } = await getLatestDeck()
  return <DinerSwipeHome deck={deck} cards={cards} events={events} stats={stats} orders={orders} />
}
