import path from 'node:path'
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // 上级目录也有 package-lock.json，显式指定项目根目录，避免 Next.js 选错
  outputFileTracingRoot: path.join(__dirname),
  // 允许在开发服务器运行时用另一个目录做生产构建检查：NEXT_DIST_DIR=.next-check npm run build
  distDir: process.env.NEXT_DIST_DIR || '.next'
}

export default nextConfig
