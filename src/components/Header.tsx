'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import SoundToggle from './SoundToggle'

const TABS = [
  { href: '/', label: '翻牌点菜' },
  { href: '/menu', label: '完整菜单' },
  { href: '/calendar', label: '验菜日历' },
  { href: '/sources', label: '食材来源' }
]

function Mark() {
  return (
    <svg className="mark" viewBox="0 0 40 40" aria-hidden="true">
      <path d="M14 10c0-2.5 2-3.5 2-6M20 9c0-2.5 2-3.5 2-6M26 10c0-2.5 2-3.5 2-6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M7 18h26a13 13 0 0 1-26 0Z" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round" />
      <path d="M14 31h12M11 35h18" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  )
}

export default function Header() {
  const path = usePathname()
  return (
    <header className="top">
      <Link className="brand" href="/">
        <Mark />
        <b>美股信仰食堂</b>
        <small>暖阳堂食</small>
      </Link>
      <div className="top-r">
        <nav className="tabs" aria-label="页面">
          {TABS.map((t) => (
            <Link key={t.href} href={t.href} aria-current={path === t.href ? 'page' : undefined}>
              {t.label}
            </Link>
          ))}
        </nav>
        <SoundToggle />
      </div>
    </header>
  )
}
