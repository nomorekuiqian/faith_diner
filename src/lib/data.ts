import { insforge } from './insforge'
import type { Card, CardStat, Deck, DeckBundle, VerifyEvent } from './types'

const CARD_COLUMNS =
  'id, deck_id, position, kind, tag, title, rows, void_if, ok_if, charge, event_keys, source, verify_status, outcome'

const CACHE_TTL_MS = 30_000
let cached: { at: number; data: DeckBundle } | null = null
let inflight: Promise<DeckBundle> | null = null

function fail(what: string, error: unknown): never {
  const msg = error && typeof error === 'object' && 'message' in error ? String((error as { message: unknown }).message) : String(error)
  throw new Error(`读取${what}失败：${msg}`)
}

async function fetchLatestDeck(): Promise<DeckBundle> {
  const deckRes = await insforge.database
    .from('decks')
    .select('id, title')
    .order('published_at', { ascending: false })
    .limit(1)
  if (deckRes.error) fail('牌组', deckRes.error)
  const deck = (deckRes.data as Deck[] | null)?.[0]
  if (!deck) throw new Error('数据库里还没有牌组，请先运行 npm run seed')

  const [cardsRes, eventsRes, statsRes, ordersRes] = await Promise.all([
    insforge.database.from('cards').select(CARD_COLUMNS).eq('deck_id', deck.id).order('position', { ascending: true }).limit(200),
    insforge.database.from('verify_events').select('key, name, when_label, short_label, happens_at, sort, status').order('sort', { ascending: true }).limit(100),
    insforge.database.from('card_stats').select('card_id, charges, doubts').eq('deck_id', deck.id).limit(200),
    insforge.database.from('deck_order_stats').select('deck_id, orders').eq('deck_id', deck.id).limit(1)
  ])
  if (cardsRes.error) fail('卡片', cardsRes.error)
  if (eventsRes.error) fail('验证事件', eventsRes.error)
  if (statsRes.error) fail('统计', statsRes.error)
  if (ordersRes.error) fail('出单数', ordersRes.error)
  const orders = ((ordersRes.data as { orders: number }[] | null)?.[0]?.orders ?? 0) as number

  const stats: Record<string, CardStat> = {}
  for (const s of (statsRes.data as CardStat[] | null) ?? []) stats[s.card_id] = s

  return {
    deck,
    cards: (cardsRes.data as Card[] | null) ?? [],
    events: (eventsRes.data as VerifyEvent[] | null) ?? [],
    stats,
    orders
  }
}

// 取最新一副牌（30 秒内存缓存 + 并发去重，切换导航秒开）
export async function getLatestDeck(): Promise<DeckBundle> {
  const now = Date.now()
  if (cached && now - cached.at < CACHE_TTL_MS) {
    return cached.data
  }
  if (!inflight) {
    inflight = fetchLatestDeck()
      .then((data) => {
        cached = { at: Date.now(), data }
        return data
      })
      .finally(() => {
        inflight = null
      })
  }
  return inflight
}
