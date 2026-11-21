import { insforge } from './insforge'
import type { Card, CardStat, Deck, DeckBundle, VerifyEvent } from './types'

const CARD_COLUMNS =
  'id, deck_id, position, kind, tag, dish, title, rows, void_if, ok_if, charge, event_keys, source, verify_status, outcome'

const CACHE_TTL_MS = 30_000

type DeckCacheStore = {
  cached: { at: number; data: DeckBundle } | null
  inflight: Promise<DeckBundle> | null
}

// 挂在 globalThis 上，确保不同路由 chunk 和开发热更新之间共享同一份热缓存
const g = globalThis as typeof globalThis & { __faithDeckCache?: DeckCacheStore }
const store: DeckCacheStore = (g.__faithDeckCache ??= { cached: null, inflight: null })

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
    insforge.database.from('cards').select(CARD_COLUMNS).eq('deck_id', deck.id).order('position', { ascending: true }).limit(300),
    insforge.database.from('verify_events').select('key, name, when_label, short_label, happens_at, sort, status').order('sort', { ascending: true }).limit(100),
    insforge.database.from('card_stats').select('card_id, charges, doubts').eq('deck_id', deck.id).limit(300),
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

function refreshLatestDeck(): Promise<DeckBundle> {
  if (!store.inflight) {
    store.inflight = fetchLatestDeck()
      .then((data) => {
        store.cached = { at: Date.now(), data }
        return data
      })
      .finally(() => {
        store.inflight = null
      })
  }
  return store.inflight
}

// 取最新一副牌（30 秒 SWR 缓存：有缓存立即返回，过期后后台静默刷新，避免切 tab 时等远程库）
export async function getLatestDeck(): Promise<DeckBundle> {
  const now = Date.now()
  if (store.cached) {
    if (now - store.cached.at >= CACHE_TTL_MS) {
      void refreshLatestDeck().catch(() => {})
    }
    return store.cached.data
  }
  return refreshLatestDeck()
}
