'use client'

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

// 80mm 热敏小票是 576 个点宽，这里按这个宽度排版，再按 scale 放大输出
const W = 576
const PAD = 34
const INK = '#211c15'
const SOFT = '#6e6558'
const PAPER = '#fbf8f0'
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

// 中文逐字换行；英文和数字尽量不拆开
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
    const lineH = o.lineH ?? Math.round(size * 1.45)
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

  // 左边可换行的文字 + 右边对齐的金额
  row(left: string, right: string, lo: TextOpts = {}, ro: TextOpts = {}) {
    this.m.font = font({ family: MONO, weight: 700, size: 20, ...ro })
    const rw = this.m.measureText(right).width
    const top = this.y
    const rsize = ro.size ?? 20
    this.ops.push((ctx) => {
      ctx.font = font({ family: MONO, weight: 700, size: 20, ...ro })
      ctx.fillStyle = ro.color ?? INK
      ctx.textAlign = 'right'
      ctx.fillText(right, W - PAD, top + Math.max(rsize, lo.size ?? 18))
    })
    this.text(left, { ...lo, maxW: W - PAD * 2 - rw - 16 })
  }

  dash(style: 'dash' | 'double' = 'dash') {
    const y = this.y + 10
    this.ops.push((ctx) => {
      ctx.strokeStyle = INK
      ctx.lineWidth = 1.6
      ctx.setLineDash(style === 'dash' ? [7, 6] : [])
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

function fmtTime(iso: string) {
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

function firstEvent(card: Card, evMap: Record<string, VerifyEvent>) {
  return card.event_keys
    .map((k) => evMap[k])
    .filter(Boolean)
    .sort((a, b) => a.sort - b.sort)[0]
}

function build(m: CanvasRenderingContext2D, input: ReceiptInput) {
  const { order, dishes, sides, events, deckTitle, table } = input
  const evMap = Object.fromEntries(events.map((e) => [e.key, e]))
  const L = new Layout(m)

  L.gap(30)
  // 标志：热气小碗
  L.custom(64, (ctx, top) => {
    const cx = W / 2
    ctx.save()
    ctx.translate(cx - 32, top + 4)
    ctx.strokeStyle = INK
    ctx.lineWidth = 4
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    // 三缕热气
    for (const sx of [20, 32, 44]) {
      ctx.beginPath()
      ctx.moveTo(sx, 14)
      ctx.quadraticCurveTo(sx - 4, 8, sx + 2, 2)
      ctx.stroke()
    }
    // 碗身
    ctx.beginPath()
    ctx.moveTo(8, 22)
    ctx.lineTo(56, 22)
    ctx.arc(32, 22, 24, 0, Math.PI, false)
    ctx.closePath()
    ctx.stroke()
    // 碗底
    ctx.beginPath()
    ctx.moveTo(20, 52)
    ctx.lineTo(44, 52)
    ctx.stroke()
    ctx.restore()
  })
  L.text('美股信仰食堂', { family: BRAND, size: 48, align: 'center', lineH: 58 })
  L.text('暖阳街角食堂 · 堂食小票', { size: 18, align: 'center', color: SOFT, lineH: 28 })
  L.text('营业时间：美股开盘到比特币收盘，全年无休', { size: 14, align: 'center', color: SOFT })
  L.gap(6)
  L.dash()

  L.row('单号', order.order_no, { size: 17, color: SOFT }, { size: 20 })
  L.row('今日出单', `第 ${order.daily_seq} 单`, { size: 17, color: SOFT }, { size: 18, family: SANS })
  L.row('桌号', table, { size: 17, color: SOFT }, { size: 20 })
  L.row('下单时间', fmtTime(order.created_at), { size: 17, color: SOFT }, { size: 18 })
  L.row('菜单', deckTitle.replace('的信仰牌组', ''), { size: 17, color: SOFT }, { size: 18, family: SANS, weight: 500 })
  L.dash()

  L.row('品名', '信仰', { size: 15, color: SOFT, weight: 700 }, { size: 15, family: SANS, color: SOFT })
  L.gap(4)
  for (const d of dishes) {
    L.row(d.title, `+${d.charge}`, { size: 19, weight: 700, lineH: 27 }, { size: 22 })
    const ev = firstEvent(d, evMap)
    if (ev) L.text(`取餐：${ev.when_label}，${ev.name}`, { size: 14, color: SOFT, lineH: 21, x: PAD + 14, maxW: W - PAD * 2 - 14 })
    L.text(`出品：${d.source.name}`, { size: 14, color: SOFT, lineH: 21, x: PAD + 14, maxW: W - PAD * 2 - 14 })
    L.gap(10)
  }

  if (sides.length) {
    L.gap(2)
    L.text('清醒小菜（赠送）', { size: 16, weight: 700, lineH: 26 })
    for (const s of sides) {
      L.row(s.title, '0', { size: 17, lineH: 25 }, { size: 20 })
      L.text(`出品：${s.source.name}`, { size: 14, color: SOFT, lineH: 21, x: PAD + 14, maxW: W - PAD * 2 - 14 })
      L.gap(8)
    }
  }
  L.dash()

  L.row('菜品', `${dishes.length} 道主菜 + ${sides.length} 道小菜`, { size: 17, color: SOFT }, { size: 17, family: SANS, weight: 500 })
  L.row('小计', `+${order.total}`, { size: 17, color: SOFT }, { size: 20 })
  L.row('清醒小菜', '免费', { size: 17, color: SOFT }, { size: 17, family: SANS, weight: 500 })
  L.dash('double')
  L.custom(62, (ctx, top) => {
    const base = top + 48
    ctx.textBaseline = 'alphabetic'
    ctx.fillStyle = INK
    ctx.textAlign = 'left'
    ctx.font = font({ size: 26, weight: 900 })
    ctx.fillText('合计充值', PAD, base)
    ctx.textAlign = 'right'
    ctx.font = font({ size: 15, color: SOFT })
    ctx.fillStyle = SOFT
    const unitW = ctx.measureText('点信仰').width
    ctx.fillText('点信仰', W - PAD, base)
    ctx.fillStyle = INK
    ctx.font = font({ family: MONO, size: 48, weight: 700 })
    ctx.fillText(`+${order.total}`, W - PAD - unitW - 8, base)
  })
  L.dash()

  const evs = Array.from(new Map(dishes.flatMap((d) => d.event_keys.map((k) => evMap[k])).filter(Boolean).map((e) => [e.key, e])).values()).sort(
    (a, b) => a.sort - b.sort
  )
  if (evs.length) {
    L.text('取餐时间：到这天看信仰兑现没有', { size: 16, weight: 700, lineH: 28 })
    for (const e of evs) {
      L.row(e.name, e.short_label, { size: 15, lineH: 23 }, { size: 17 })
    }
    L.dash()
  }

  // 条形码（装饰）
  L.gap(6)
  L.custom(78, (ctx, top) => {
    const rand = rng(hash(order.order_no))
    const total = 380
    let x = (W - total) / 2
    ctx.fillStyle = INK
    while (x < (W + total) / 2) {
      const bw = 1.5 + Math.floor(rand() * 3) * 1.5
      if (rand() > 0.35) ctx.fillRect(x, top, bw, 60)
      x += bw + 1.5 + Math.floor(rand() * 2) * 1.5
    }
    ctx.font = font({ family: MONO, size: 15, weight: 500 })
    ctx.textAlign = 'center'
    ctx.fillText(`*FR${order.order_no.replace(/-/g, '')}*`, W / 2, top + 78)
  })
  L.gap(16)

  for (const ln of ['信仰一经点单，记得拿稳别慌', '每道菜的作废条件写在背面，到期按规则验菜', '数据结合 FMP 官方财报与公开观点，不构成投资建议']) {
    L.text(ln, { size: 14, align: 'center', color: SOFT, lineH: 22 })
  }
  L.gap(10)
  L.text('慢慢吃，跌了随时再来', { size: 22, weight: 900, align: 'center', lineH: 32 })
  L.gap(30)
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
    '美股信仰食堂暖阳街角堂食小票营业时间开盘到比特币收盘全年无休单号今日出单第桌号下单菜单品名取餐出品清醒避坑小菜赠送主菜道小计免费合计充值点到这天看兑现没有一经记得拿稳别慌每作废条件写在背面期按规则验菜数据结合官方财报与公开观点不构成投资建议慢慢吃跌了随时再来',
    input.deckTitle,
    ...input.dishes.flatMap((d) => [d.title, d.source.name]),
    ...input.sides.flatMap((d) => [d.title, d.source.name]),
    ...input.events.flatMap((e) => [e.name, e.when_label])
  ].join('')
  await loadFonts(allText + '0123456789+-*:FR')

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

  // 纸张，底边是撕纸锯齿
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
  for (let i = 0; i < 2600; i++) {
    ctx.fillStyle = `rgba(80,60,30,${rand() * 0.06})`
    ctx.fillRect(rand() * W, rand() * H, 1.2, 1.2)
  }
  for (const op of layout.ops) op(ctx)
  ctx.restore()
  return canvas
}

export function receiptFileName(order: OrderResult, ext: 'png' | 'pdf') {
  return `信仰小票-${order.order_no}.${ext}`
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
