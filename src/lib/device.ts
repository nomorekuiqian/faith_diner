'use client'

// 本机状态：匿名设备 id + 每副牌的进度。真正的滑卡记录同时写进 InsForge。
const DEVICE_KEY = 'faith-recharge:device'
const progressKey = (deckId: string) => `faith-recharge:progress:${deckId}`

export interface Progress {
  index: number
  balance: number
  picks: Record<string, 1 | -1>
  hand?: string[]
  seen?: string[]
}

function uuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}

export function getDeviceId(): string {
  try {
    const existing = localStorage.getItem(DEVICE_KEY)
    if (existing) return existing
    const id = uuid()
    localStorage.setItem(DEVICE_KEY, id)
    return id
  } catch {
    return uuid()
  }
}

export function loadProgress(deckId: string, start: number): Progress {
  try {
    const raw = localStorage.getItem(progressKey(deckId))
    if (raw) {
      const p = JSON.parse(raw) as Progress
      if (typeof p.index === 'number' && typeof p.balance === 'number' && p.picks) return p
    }
  } catch {
    /* 隐私模式或存储被禁用时从头开始 */
  }
  return { index: 0, balance: start, picks: {} }
}

export function saveProgress(deckId: string, p: Progress) {
  try {
    localStorage.setItem(progressKey(deckId), JSON.stringify(p))
  } catch {
    /* 忽略 */
  }
}

export const PROGRESS_EVENT = 'faith-recharge:progress'
