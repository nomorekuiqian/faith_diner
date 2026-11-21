import { createClient } from '@insforge/sdk'

const baseUrl = process.env.NEXT_PUBLIC_INSFORGE_URL
const anonKey = process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY

if (!baseUrl || !anonKey) {
  throw new Error('缺少 NEXT_PUBLIC_INSFORGE_URL 或 NEXT_PUBLIC_INSFORGE_ANON_KEY，请检查 .env.local')
}

// 匿名客户端：只能读公开内容，写入只能走 record_swipe / reset_swipes 两个函数
export const insforge = createClient({ baseUrl, anonKey })
