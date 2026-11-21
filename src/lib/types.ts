export type CardKind = 'faith' | 'sober'

export interface CardSource {
  name: string
  handle: string
  via: boolean
  stance: string
  date: string
  url: string
}

export interface Card {
  id: string
  deck_id: string
  position: number
  kind: CardKind
  tag: string
  title: string
  rows: [string, string][]
  void_if: string | null
  ok_if: string | null
  charge: number
  event_keys: string[]
  source: CardSource
  verify_status: 'unverified' | 'verified' | 'corrected'
  outcome: 'pending' | 'fulfilled' | 'void' | 'partial' | 'postponed'
}

export interface VerifyEvent {
  key: string
  name: string
  when_label: string
  short_label: string
  happens_at: string | null
  sort: number
  status: 'pending' | 'settled'
}

export interface CardStat {
  card_id: string
  charges: number
  doubts: number
}

export interface Deck {
  id: string
  title: string
}

export interface DeckBundle {
  deck: Deck
  cards: Card[]
  events: VerifyEvent[]
  stats: Record<string, CardStat>
}
