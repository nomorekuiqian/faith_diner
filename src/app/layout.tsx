import type { Metadata, Viewport } from 'next'
import Header from '@/components/Header'
import './globals.css'

export const metadata: Metadata = {
  title: '信仰充值站',
  description: '每天一副信仰牌组：来自公开推文的看多论点和风险提醒，每张卡都写明它会在哪天被验证。'
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover'
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
          href="https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@600;800&family=Noto+Sans+SC:wght@400;500;700;900&family=ZCOOL+QingKe+HuangYou&display=swap"
        />
      </head>
      <body>
        <div className="shell">
          <Header />
          {children}
          <div className="foot">内容摘自公开推文和文章，经改写，数字未经独立核实。历史对照为近似值。不构成任何投资建议。</div>
        </div>
      </body>
    </html>
  )
}
