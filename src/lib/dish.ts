import type { Card } from './types'

// 分类写成“招牌老菜 · 历史数据”：前半是菜系，后半是话题
export function courseOf(card: Card) {
  return card.tag.split(' · ')[0] || card.tag
}

export function topicOf(card: Card) {
  return card.tag.split(' · ')[1] || card.tag
}

// 点菜单、小票只写短菜名
export function dishName(card: Card) {
  return card.dish?.trim() || topicOf(card)
}

function rowByLabel(card: Card, ...labels: string[]) {
  for (const target of labels) {
    const row = card.rows.find(([label]) => label === target)
    if (row?.[1]?.trim()) return row[1].trim()
  }
  return ''
}

// 关键数据（兼容旧版“详情”）
export function keyDataOf(card: Card) {
  return rowByLabel(card, '关键数据', '详情')
}

// 逻辑链条（兼容旧版无标签正文）
export function logicOf(card: Card) {
  const labeled = rowByLabel(card, '逻辑链条')
  if (labeled) return labeled
  const plains = card.rows.filter(([label]) => label === '').map(([, text]) => text.trim()).filter(Boolean)
  return plains.join(' ')
}

// 接下来关注什么（兼容旧版 ok_if / void_if）
export function watchOf(card: Card) {
  const labeled = rowByLabel(card, '关注什么', '接下来关注什么')
  if (labeled) return labeled
  const parts: string[] = []
  if (card.ok_if?.trim()) parts.push(`正面信号：${card.ok_if.trim()}`)
  if (card.void_if?.trim()) parts.push(`风险信号：${card.void_if.trim()}`)
  return parts.join('\n')
}

// 菜单与正面卡片的一段摘要：优先用逻辑链条，其次无标签第一行
export function pointOf(card: Card) {
  const logic = rowByLabel(card, '逻辑链条')
  if (logic) return logic
  const row = card.rows.find(([label]) => label !== '详情' && label !== '关键数据' && label !== '关注什么')
  return row ? row[1] : ''
}

export function detailOf(card: Card) {
  return keyDataOf(card)
}
