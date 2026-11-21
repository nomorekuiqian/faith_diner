'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const TABS = [
  { href: '/', label: '今日牌组' },
  { href: '/calendar', label: '验证日历' },
  { href: '/sources', label: '来源' }
]

export default function Header() {
  const path = usePathname()
  return (
    <header className="top">
      <Link className="brand" href="/">
        <b>信仰充值站</b>
        <small>原型</small>
      </Link>
      <nav className="tabs" aria-label="页面">
        {TABS.map((t) => (
          <Link key={t.href} href={t.href} aria-current={path === t.href ? 'page' : undefined}>
            {t.label}
          </Link>
        ))}
      </nav>
    </header>
  )
}
