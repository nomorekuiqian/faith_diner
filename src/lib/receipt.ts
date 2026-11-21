'use client'

import { topicOf } from './dish'
import type { Card, VerifyEvent } from './types'

export interface OrderResult {
  order_no: string
  total: number
  created_at: string
  daily_seq: number
  items: string[]
  sides: string[]
}

export interface ReceiptInput {
  order: OrderResult
  dishes: Card[]
  sides: Card[]
  events: VerifyEvent[]
  deckTitle: string
  table: string
}

// 80mm 热敏小票宽度 576pt，精简排版成一份清晰可留存的立场凭证
const W = 576
const PAD = 38
const INK = '#1d1c19'
const SOFT = '#6c665d'
const PAPER = '#fbf9f2'
const SANS = '"Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif'
const MONO = '"IBM Plex Mono", ui-monospace, Menlo, monospace'
const BRAND = '"ZCOOL QingKe HuangYou", "Noto Sans SC", sans-serif'

type Op = (ctx: CanvasRenderingContext2D) => void

interface TextOpts {
  size?: number
  weight?: number
  family?: string
  color?: string
  align?: 'left' | 'center' | 'right'
  lineH?: number
  maxW?: number
  x?: number
}

function font(o: TextOpts) {
  return `${o.weight ?? 400} ${o.size ?? 18}px ${o.family ?? SANS}`
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const out: string[] = []
  let line = ''
  for (const ch of Array.from(text)) {
    const test = line + ch
    if (line && ctx.measureText(test).width > maxW) {
      const m = line.match(/^(.*[\s一-鿿，。；：、（）])([A-Za-z0-9.%+\-]+)$/)
      if (/[A-Za-z0-9.%+\-]/.test(ch) && m) {
        out.push(m[1].trimEnd())
        line = m[2] + ch
      } else {
        out.push(line)
        line = ch === ' ' ? '' : ch
      }
    } else {
      line = test
    }
  }
  if (line) out.push(line)
  return out
}

class Layout {
  y = 0
  ops: Op[] = []
  constructor(private m: CanvasRenderingContext2D) {}

  gap(n: number) {
    this.y += n
  }

  text(str: string, o: TextOpts = {}) {
    const size = o.size ?? 18
    const lineH = o.lineH ?? Math.round(size * 1.48)
    const maxW = o.maxW ?? W - PAD * 2
    this.m.font = font(o)
    const lines = wrap(this.m, str, maxW)
    for (const ln of lines) {
      const y = this.y + size
      const align = o.align ?? 'left'
      const x = o.x ?? (align === 'center' ? W / 2 : align === 'right' ? W - PAD : PAD)
      this.ops.push((ctx) => {
        ctx.font = font(o)
        ctx.fillStyle = o.color ?? INK
        ctx.textAlign = align
        ctx.textBaseline = 'alphabetic'
        ctx.fillText(ln, x, y)
      })
      this.y += lineH
    }
    return lines.length
  }

  row(left: string, right: string, lo: TextOpts = {}, ro: TextOpts = {}) {
    this.m.font = font({ family: MONO, weight: 700, size: 19, ...ro })
    const rw = this.m.measureText(right).width
    const top = this.y
    const rsize = ro.size ?? 19
    this.ops.push((ctx) => {
      ctx.font = font({ family: MONO, weight: 700, size: 19, ...ro })
      ctx.fillStyle = ro.color ?? INK
      ctx.textAlign = 'right'
      ctx.textBaseline = 'alphabetic'
      ctx.fillText(right, W - PAD, top + Math.max(rsize, lo.size ?? 18))
    })
    this.text(left, { ...lo, maxW: W - PAD * 2 - rw - 16 })
  }

  dash(style: 'dash' | 'double' = 'dash') {
    const y = this.y + 10
    this.ops.push((ctx) => {
      ctx.strokeStyle = INK
      ctx.lineWidth = 1.5
      ctx.setLineDash(style === 'dash' ? [6, 6] : [])
      ctx.beginPath()
      ctx.moveTo(PAD, y)
      ctx.lineTo(W - PAD, y)
      ctx.stroke()
      if (style === 'double') {
        ctx.beginPath()
        ctx.moveTo(PAD, y + 5)
        ctx.lineTo(W - PAD, y + 5)
        ctx.stroke()
      }
      ctx.setLineDash([])
    })
    this.y += style === 'double' ? 28 : 22
  }

  custom(height: number, op: (ctx: CanvasRenderingContext2D, top: number) => void) {
    const top = this.y
    this.ops.push((ctx) => op(ctx, top))
    this.y += height
  }
}

function hash(s: string) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function rng(seed: number) {
  let t = seed
  return () => {
    t += 0x6d2b79f5
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

function fmtDate(iso: string) {
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

function stanceLabel(dishes: Card[]): string {
  const counts = new Map<string, number>()
  for (const d of dishes) {
    const t = topicOf(d)
    counts.set(t, (counts.get(t) ?? 0) + 1)
  }
  const top = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? ''
  if (top.includes('基本面') || top.includes('财报')) return '基本面派'
  if (top.includes('宏观')) return '宏观顺风派'
  if (top.includes('历史')) return '长期主义派'
  if (top.includes('大佬')) return '老炮经验派'
  return '多元观察派'
}

function build(m: CanvasRenderingContext2D, input: ReceiptInput) {
  const { order, dishes, sides, events, table } = input
  const evMap = Object.fromEntries(events.map((e) => [e.key, e]))
  const L = new Layout(m)

  L.gap(32)
  // 极简港式招牌灯箱 + K 线碗单色热敏线稿
  L.custom(64, (ctx, top) => {
    const cx = W / 2
    ctx.save()
    ctx.translate(cx - 28, top + 2)
    ctx.strokeStyle = INK
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    // 招牌圆角框
    ctx.lineWidth = 2.6
    ctx.beginPath()
    ctx.roundRect(2, 2, 52, 52, 11)
    ctx.stroke()
    // 上冲 K 线
    ctx.lineWidth = 2.8
    ctx.beginPath()
    ctx.moveTo(15, 25)
    ctx.lineTo(22, 19)
    ctx.lineTo(27, 23)
    ctx.lineTo(39, 12)
    ctx.moveTo(33, 12)
    ctx.lineTo(39, 12)
    ctx.lineTo(39, 18)
    ctx.stroke()
    // 汤碗
    ctx.beginPath()
    ctx.moveTo(12, 30)
    ctx.lineTo(44, 30)
    ctx.arc(28, 30, 16, 0, Math.PI, false)
    ctx.closePath()
    ctx.stroke()
    // 碗底
    ctx.beginPath()
    ctx.moveTo(21, 49)
    ctx.lineTo(35, 49)
    ctx.stroke()
    ctx.restore()
  })

  L.text('美股信仰食堂', { family: BRAND, size: 46, align: 'center', lineH: 54 })
  L.text('立场留存凭证 · 留作日后验真伪', { size: 16, align: 'center', color: SOFT, lineH: 26 })
  L.gap(6)
  L.dash()

  // 精简元信息：仅两行
  L.row(fmtDate(order.created_at), `NO.${order.order_no}`, { family: MONO, size: 15, color: SOFT }, { family: MONO, size: 16, weight: 700 })
  L.row(`桌号 ${table} · 第 ${order.daily_seq} 单`, stanceLabel(dishes), { size: 15, color: SOFT }, { family: SANS, size: 15, weight: 700 })
  L.dash()

  // 我认同的核心观点
  L.row('我今日认同的逻辑', '权重', { size: 14, color: SOFT, weight: 700 }, { size: 14, family: SANS, color: SOFT })
  L.gap(6)
  dishes.forEach((d, idx) => {
    const num = String(idx + 1).padStart(2, '0')
    L.row(`${num}  ${d.title}`, `+${d.charge}`, { size: 18, weight: 700, lineH: 26 }, { size: 20 })
    L.gap(8)
  })

  // 附带风险提示（精简一行一条）
  if (sides.length) {
    L.gap(4)
    L.text('同时记下的风险提示', { size: 14, weight: 700, color: SOFT, lineH: 24 })
    for (const s of sides) {
      L.text(`· ${s.title}`, { size: 15, color: SOFT, lineH: 22 })
      L.gap(4)
    }
  }

  L.dash('double')
  L.custom(58, (ctx, top) => {
    const base = top + 44
    ctx.textBaseline = 'alphabetic'
    ctx.fillStyle = INK
    ctx.textAlign = 'left'
    ctx.font = font({ size: 24, weight: 900 })
    ctx.fillText('合计信仰', PAD, base)
    ctx.textAlign = 'right'
    ctx.font = font({ size: 15, color: SOFT })
    ctx.fillStyle = SOFT
    const unitW = ctx.measureText('点').width
    ctx.fillText('点', W - PAD, base)
    ctx.fillStyle = INK
    ctx.font = font({ family: MONO, size: 44, weight: 700 })
    ctx.fillText(`+${order.total}`, W - PAD - unitW - 6, base)
  })
  L.dash()

  // 未来核对节点：只取最关键的 3 个，清晰不啰嗦
  const linkedEvs = Array.from(
    new Map(dishes.flatMap((d) => d.event_keys.map((k) => evMap[k])).filter(Boolean).map((e) => [e.key, e])).values()
  ).sort((a, b) => a.sort - b.sort)
  const datedEvs = linkedEvs.filter((e) => Boolean(e.happens_at)).slice(0, 3)
  const pickEvs = datedEvs.length ? datedEvs : linkedEvs.slice(0, 2)

  if (pickEvs.length) {
    L.text('到期翻出此票核对', { size: 15, weight: 700, lineH: 26 })
    for (const e of pickEvs) {
      L.row(e.name, e.short_label, { size: 15, color: SOFT, lineH: 23 }, { size: 16, color: INK })
    }
    L.dash()
  }

  // 简洁条形码
  L.gap(4)
  L.custom(64, (ctx, top) => {
    const rand = rng(hash(order.order_no))
    const total = 340
    let x = (W - total) / 2
    ctx.fillStyle = INK
    while (x < (W + total) / 2) {
      const bw = 1.5 + Math.floor(rand() * 3) * 1.5
      if (rand() > 0.35) ctx.fillRect(x, top, bw, 46)
      x += bw + 1.5 + Math.floor(rand() * 2) * 1.5
    }
    ctx.font = font({ family: MONO, size: 13, weight: 500 })
    ctx.textAlign = 'center'
    ctx.fillText(`*FR${order.order_no.replace(/-/g, '')}*`, W / 2, top + 62)
  })
  L.gap(14)

  L.text('保存到本地留作凭证，时间会给出答案', { size: 16, weight: 700, align: 'center', lineH: 24 })
  L.text('公开数据与观点整理，不构成投资建议', { size: 13, align: 'center', color: SOFT, lineH: 22 })
  L.gap(26)
  return L
}

async function loadFonts(text: string) {
  if (typeof document === 'undefined' || !('fonts' in document)) return
  const specs = [
    `400 20px ${SANS}`,
    `500 20px ${SANS}`,
    `700 20px ${SANS}`,
    `900 20px ${SANS}`,
    `500 20px ${MONO}`,
    `700 20px ${MONO}`,
    `400 40px ${BRAND}`
  ]
  await Promise.all(specs.map((s) => document.fonts.load(s, text).catch(() => [])))
}

export async function drawReceipt(input: ReceiptInput, scale = 2): Promise<HTMLCanvasElement> {
  const allText = [
    '美股信仰食堂立场留存凭证留作日后验真伪桌号第单基本面宏观顺风长期主义老炮经验多元观察派我今日认同的逻辑权重同时记下的风险提示合计点到期翻出此票核对保存到本地时间会给出答案公开数据与观点整理不构成投资建议',
    input.deckTitle,
    ...input.dishes.map((d) => d.title),
    ...input.sides.map((d) => d.title),
    ...input.events.flatMap((e) => [e.name, e.short_label])
  ].join('')
  await loadFonts(allText + '0123456789+-*:FRNO.')

  const probe = document.createElement('canvas').getContext('2d')
  if (!probe) throw new Error('浏览器不支持画布')
  const layout = build(probe, input)
  const zig = 14
  const H = Math.ceil(layout.y) + zig

  const canvas = document.createElement('canvas')
  canvas.width = W * scale
  canvas.height = H * scale
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('浏览器不支持画布')
  ctx.scale(scale, scale)

  // 纸张与底边撕纸锯齿
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.lineTo(W, 0)
  ctx.lineTo(W, H - zig)
  const teeth = 24
  for (let i = teeth; i >= 0; i--) {
    const x = (W / teeth) * i
    ctx.lineTo(x, i % 2 === 0 ? H - zig : H)
  }
  ctx.closePath()
  ctx.fillStyle = PAPER
  ctx.fill()
  ctx.save()
  ctx.clip()
  const rand = rng(hash(input.order.order_no) ^ 0x9e37)
  for (let i = 0; i < 2000; i++) {
    ctx.fillStyle = `rgba(80,60,30,${rand() * 0.05})`
    ctx.fillRect(rand() * W, rand() * H, 1.2, 1.2)
  }
  for (const op of layout.ops) op(ctx)
  ctx.restore()
  return canvas
}

export function receiptFileName(order: OrderResult, ext: 'png' | 'pdf') {
  return `立场凭证-${order.order_no}.${ext}`
}

export async function saveReceiptPng(canvas: HTMLCanvasElement, order: OrderResult) {
  const blob: Blob | null = await new Promise((r) => canvas.toBlob(r, 'image/png'))
  if (!blob) throw new Error('图片生成失败')
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = receiptFileName(order, 'png')
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 4000)
}

export async function saveReceiptPdf(canvas: HTMLCanvasElement, order: OrderResult) {
  const { jsPDF } = await import('jspdf')
  const wMm = 80
  const hMm = (wMm * canvas.height) / canvas.width
  const pdf = new jsPDF({ unit: 'mm', format: [wMm, hMm], orientation: 'portrait' })
  pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, wMm, hMm)
  pdf.save(receiptFileName(order, 'pdf'))
}
