'use client'

import { motion, useReducedMotion } from 'motion/react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { type MouseEvent, useEffect, useState } from 'react'
import { getDeviceId, tableFor } from '@/lib/device'
import SoundToggle from './SoundToggle'

const AUTHOR_X_URL = 'https://x.com/golden_pan1'

type TabKey = 'today' | 'menu' | 'calendar' | 'sources'

const TABS: { href: string; label: string; icon: TabKey }[] = [
  { href: '/', label: '今日推介', icon: 'today' },
  { href: '/menu', label: '全部菜单', icon: 'menu' },
  { href: '/calendar', label: '未来事件', icon: 'calendar' },
  { href: '/sources', label: '食材来源', icon: 'sources' }
]

// 港式茶餐厅招牌灯箱 Icon：复古双金框 + 上冲 K 线热气 + 冰室汤碗 + 朱红印点
function SignMark() {
  return (
    <span className="ds-mark" aria-hidden="true">
      <svg viewBox="0 0 64 64" fill="none">
        {/* 灯箱底板与复古双线框 */}
        <rect x="2.5" y="2.5" width="59" height="59" rx="14" fill="#104431" stroke="#F5C12E" strokeWidth="2.6" />
        <rect x="7.5" y="7.5" width="49" height="49" rx="9" stroke="#F5C12E" strokeOpacity="0.52" strokeWidth="1.4" />
        {/* 港式招牌角标朱红点 */}
        <circle className="ds-mark-dot" cx="49.5" cy="14.5" r="3.2" fill="#E14635" />
        {/* 上冲 K 线热气 */}
        <g className="ds-mark-kline">
          <path d="M17.5 28.5L25 22L31 26.5L43 14.5" stroke="#F5C12E" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M36 14.5H43V21.5" stroke="#F5C12E" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
        </g>
        {/* 冰室公鸡碗剪影 + 朱红边线 */}
        <path d="M14 33.5H50C50 43.4 42.2 50 32 50C21.8 50 14 43.4 14 33.5Z" fill="#FFFDF7" />
        <path d="M17.5 37.5H46.5" stroke="#D63A2A" strokeWidth="2.6" strokeLinecap="round" />
        <path d="M23 53.5H41" stroke="#F5C12E" strokeWidth="3" strokeLinecap="round" />
      </svg>
    </span>
  )
}

function TabIcon({ kind }: { kind: TabKey }) {
  switch (kind) {
    case 'today':
      return (
        <svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3.5" y="4" width="10.5" height="13" rx="2" />
          <path d="M14 6.5h1.5a1.5 1.5 0 0 1 1.5 1.5v7.5a2 2 0 0 1-2 2H7.5" />
          <path d="M6.5 8.5h4.5M6.5 11.8h3" />
        </svg>
      )
    case 'menu':
      return (
        <svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 5.5h12M4 10h12M4 14.5h8" />
          <circle cx="15.5" cy="14.5" r="1.5" fill="currentColor" stroke="none" />
        </svg>
      )
    case 'calendar':
      return (
        <svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="4.5" width="14" height="12.5" rx="2" />
          <path d="M6.5 2.8v3M13.5 2.8v3M3 8.5h14" />
          <path d="M7.5 12.6l1.7 1.7 3.5-3.4" />
        </svg>
      )
    case 'sources':
      return (
        <svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4.5 15.5V5.5a2 2 0 0 1 2-2h9v12H6.5a2 2 0 0 0-2 2Z" />
          <path d="M4.5 15.5a2 2 0 0 1 2-2h9" />
          <path d="M8 7h4.5M8 9.8h3.2" />
        </svg>
      )
  }
}

export default function Header() {
  const path = usePathname()
  const router = useRouter()
  const reduced = useReducedMotion()
  const [table, setTable] = useState<string | null>(null)
  const [scrolled, setScrolled] = useState(false)
  const [pendingPath, setPendingPath] = useState<string | null>(null)

  useEffect(() => {
    setTable(tableFor(getDeviceId()))
  }, [])

  // 路由切换完成后清除乐观高亮
  useEffect(() => {
    setPendingPath(null)
  }, [path])

  // 空闲时预取其余顶部 tab，避免首次点击才发 RSC 请求
  useEffect(() => {
    const prefetchAll = () => {
      for (const t of TABS) {
        if (t.href !== path) router.prefetch(t.href)
      }
    }
    const ric = window.requestIdleCallback as ((cb: () => void, opts?: { timeout: number }) => number) | undefined
    if (typeof ric === 'function') {
      const id = ric(prefetchAll, { timeout: 1200 })
      return () => window.cancelIdleCallback?.(id)
    }
    const timer = setTimeout(prefetchAll, 250)
    return () => clearTimeout(timer)
  }, [path, router])

  const markPending = (href: string) => (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
    if (href !== path) setPendingPath(href)
  }

  const activePath = pendingPath ?? path

  useEffect(() => {
    let raf = 0
    const onScroll = () => {
      if (raf) return
      raf = window.requestAnimationFrame(() => {
        raf = 0
        setScrolled(window.scrollY > 10)
      })
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (raf) window.cancelAnimationFrame(raf)
    }
  }, [])

  return (
    <header className={`ds-header${scrolled ? ' is-scrolled' : ''}`}>
      <div className="ds-container ds-header-in">
        <Link className="ds-brand" href="/" prefetch={true} onClick={markPending('/')}>
          <SignMark />
          <span className="ds-brand-sign">
            <span className="ds-brand-top">
              <b>美股信仰食堂</b>
              <em className="ds-brand-chop">开市</em>
            </span>
            <small className="ds-brand-sub">FAITH DINER · 港式冰室</small>
          </span>
        </Link>

        <nav className="ds-nav" aria-label="页面导航">
          <div className="ds-nav-rail">
            {TABS.map((t) => {
              const active = activePath === t.href
              return (
                <Link
                  key={t.href}
                  href={t.href}
                  prefetch={true}
                  onClick={markPending(t.href)}
                  onMouseEnter={() => {
                    if (t.href !== path) router.prefetch(t.href)
                  }}
                  className={`ds-nav-link${active ? ' is-active' : ''}`}
                  aria-current={path === t.href ? 'page' : undefined}
                >
                  {active && (
                    <motion.span
                      className="ds-nav-pill"
                      layoutId="ds-nav-pill"
                      transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 32 }}
                      aria-hidden="true"
                    />
                  )}
                  <span className="ds-nav-label">
                    <TabIcon kind={t.icon} />
                    <span>{t.label}</span>
                  </span>
                </Link>
              )
            })}
          </div>
        </nav>

        <div className="ds-topbar-r">
          <a
            className="ds-author"
            href={AUTHOR_X_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="作者 Golden 的 X（Twitter）主页"
            title="作者 Golden · @golden_pan1"
          >
            <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" aria-hidden="true">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
            <span className="ds-author-role">作者</span>
            <b>Golden</b>
          </a>
          {table && (
            <span className="ds-table" title="当前桌号 · 营业中">
              <i className="ds-live-dot" aria-hidden="true" />
              <span>{table} 桌</span>
            </span>
          )}
          <SoundToggle />
        </div>
      </div>
    </header>
  )
}
