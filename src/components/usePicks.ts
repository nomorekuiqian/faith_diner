'use client'

import { useEffect, useState } from 'react'
import { loadProgress, PROGRESS_EVENT } from '@/lib/device'

// 读取本机在某副牌上的选择，并在牌组页滑卡时同步更新
export function usePicks(deckId: string) {
  const [picks, setPicks] = useState<Record<string, 1 | -1>>({})
  useEffect(() => {
    const read = () => setPicks(loadProgress(deckId, 0).picks)
    read()
    window.addEventListener(PROGRESS_EVENT, read)
    window.addEventListener('storage', read)
    return () => {
      window.removeEventListener(PROGRESS_EVENT, read)
      window.removeEventListener('storage', read)
    }
  }, [deckId])
  return picks
}
