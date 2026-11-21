import type { Metadata, Viewport } from 'next'
import Header from '@/components/Header'
import './globals.css'
import '../styles/tokens.css'
import '../styles/ds.css'
import '../styles/home.css'
import '../styles/menu.css'
import '../styles/events.css'

export const metadata: Metadata = {
  title: '美股信仰食堂',
  description: '大跌之后不要慌，来信仰食堂点两道菜压压惊：看清市场上的信仰与风险提示，选你信的打张小票。'
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#14533c'
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@800&family=IBM+Plex+Mono:wght@500;600;700&family=Noto+Sans+SC:wght@400;500;600;700;900&family=ZCOOL+QingKe+HuangYou&display=swap"
        />
      </head>
      <body>
        <Header />
        <div className="shell">{children}</div>
        <footer className="ds-foot ds-container">内容摘自公开数据和观点，历史对照为近似值，不构成投资建议。</footer>
      </body>
    </html>
  )
}
