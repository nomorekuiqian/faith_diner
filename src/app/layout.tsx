import type { Metadata, Viewport } from 'next'
import Header from '@/components/Header'
import EnergyField from '@/components/fx/EnergyField'
import './globals.css'

export const metadata: Metadata = {
  title: '美股信仰食堂 · 大跌之后不要慌',
  description: '大跌之后不要慌，来信仰食堂充值一些信仰吧。看清市场上的信仰与风险提示，选你信的打张小票。'
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
          href="https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@600;800&family=IBM+Plex+Mono:wght@500;700&family=Noto+Sans+SC:wght@400;500;700;900&family=ZCOOL+QingKe+HuangYou&display=swap"
        />
      </head>
      <body>
        <EnergyField />
        <div className="shell">
          <Header />
          {children}
          <div className="foot">美股信仰食堂 · 结合 FMP 官方宏观财报数据与公开观点整理，历史对照为近似值，不构成任何投资建议。</div>
        </div>
      </body>
    </html>
  )
}
