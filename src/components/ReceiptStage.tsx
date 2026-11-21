'use client'

import { AnimatePresence, motion } from 'motion/react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { drawReceipt, saveReceiptPdf, saveReceiptPng, type OrderResult } from '@/lib/receipt'
import type { Card, VerifyEvent } from '@/lib/types'

const PrinterStage = dynamic(() => import('./PrinterStage'), { ssr: false })

interface Props {
  order: OrderResult
  dishes: Card[]
  sides: Card[]
  events: VerifyEvent[]
  deckTitle: string
  table: string
  onClose: () => void
}

export default function ReceiptStage({ order, dishes, sides, events, deckTitle, table, onClose }: Props) {
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null)
  const [img, setImg] = useState<string | null>(null)
  const [printed, setPrinted] = useState(false)
  const [flat, setFlat] = useState(false)
  const [no3d, setNo3d] = useState(false)
  const [busy, setBusy] = useState<'png' | 'pdf' | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [reduced, setReduced] = useState(false)
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    try {
      setReduced(window.matchMedia('(prefers-reduced-motion: reduce)').matches)
    } catch {
      /* 忽略 */
    }
    let alive = true
    drawReceipt({ order, dishes, sides, events, deckTitle, table })
      .then((c) => {
        if (!alive) return
        setCanvas(c)
        setImg(c.toDataURL('image/png'))
      })
      .catch((e: unknown) => setMsg(e instanceof Error ? e.message : '小票排版失败'))
    return () => {
      alive = false
    }
  }, [order, dishes, sides, events, deckTitle, table])

  useEffect(() => {
    box.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (flat) setFlat(false)
        else onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [flat, onClose])

  const save = async (kind: 'png' | 'pdf') => {
    if (!canvas) return
    setBusy(kind)
    setMsg(null)
    try {
      if (kind === 'png') await saveReceiptPng(canvas, order)
      else await saveReceiptPdf(canvas, order)
      setMsg(kind === 'png' ? '图片已保存到下载文件夹' : 'PDF 已保存到下载文件夹')
    } catch (e) {
      setMsg(e instanceof Error ? `保存失败：${e.message}` : '保存失败，请再试一次')
    } finally {
      setBusy(null)
    }
  }

  const showFlat = no3d && img

  return (
    <motion.div
      className="rs-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={`小票 ${order.order_no}`}
      tabIndex={-1}
      ref={box}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="rs-head">
        <div>
          <h2>{printed ? '立场凭证已打好' : '正在出票'}</h2>
          <p>
            单号 <b>{order.order_no}</b> · 保存到本地，过段时间拿出来核对验真还是验伪
          </p>
        </div>
        <button type="button" className="rs-close" onClick={onClose} aria-label="关闭小票">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>

      <div className="rs-stage">
        {canvas && !no3d && (
          <PrinterStage
            receipt={canvas}
            reduced={reduced}
            onPrinted={() => setPrinted(true)}
            onFail={() => {
              setNo3d(true)
              setPrinted(true)
            }}
          />
        )}
        {showFlat && (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="rs-flat-inline" src={img} alt={`小票 ${order.order_no}`} />
        )}
        {!canvas && !msg && <p className="rs-wait">正在排版小票…</p>}
      </div>

      <AnimatePresence>
        {printed && (
          <motion.div
            className="rs-actions"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 220, damping: 20 }}
          >
            <button type="button" className="btn main" onClick={() => save('png')} disabled={!canvas || busy !== null}>
              {busy === 'png' ? '正在保存…' : '保存小票到本地'}
            </button>
            <button type="button" className="btn" onClick={() => setFlat(true)} disabled={!img}>
              看小票原图
            </button>
            <button type="button" className="btn" onClick={() => save('pdf')} disabled={!canvas || busy !== null}>
              {busy === 'pdf' ? '正在生成…' : '保存 PDF'}
            </button>
            <Link className="btn" href="/calendar">
              看未来事件
            </Link>
            <button type="button" className="btn ghost" onClick={onClose}>
              再点一单
            </button>
          </motion.div>
        )}
      </AnimatePresence>
      {msg && (
        <p className="rs-msg" role="status">
          {msg}
        </p>
      )}

      <AnimatePresence>
        {flat && img && (
          <motion.div className="rs-flat" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setFlat(false)}>
            <motion.div
              className="rs-flat-paper"
              initial={{ y: 60, rotate: -3, opacity: 0 }}
              animate={{ y: 0, rotate: 0, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 180, damping: 18 }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img} alt={`小票 ${order.order_no}`} />
            </motion.div>
            <p className="rs-flat-tip">手机上可以长按小票保存到相册。点空白处关闭。</p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
