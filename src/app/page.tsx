import DinerSwipeHome from '@/components/DinerSwipeHome'
import { getLatestDeck } from '@/lib/data'

export const dynamic = 'force-dynamic'

export default async function Home() {
  const { deck, cards, events, stats, orders } = await getLatestDeck()
  return <DinerSwipeHome deck={deck} cards={cards} events={events} stats={stats} orders={orders} />
}
