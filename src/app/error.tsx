'use client'

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <section className="page">
      <h1>牌组没有加载出来</h1>
      <p className="lede">{error.message}</p>
      <button type="button" className="btn main" onClick={reset}>
        重新加载
      </button>
    </section>
  )
}
