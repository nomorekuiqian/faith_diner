'use client'

import { courseOf, dishName, keyDataOf, logicOf, pointOf, watchOf } from '@/lib/dish'
import type { Card, CardStat } from '@/lib/types'

interface Props {
  card: Card
  stat?: CardStat
  evText: string
  picked: boolean
  onToggle: () => void
  onClose: () => void
}

// 菜品说明：菜名、标题，以及直白拆解（关键数据、逻辑链条、接下来关注什么）
export default function DishSheet({ card, stat, evText, picked, onToggle, onClose }: Props) {
  const faith = card.kind === 'faith'
  const keyData = keyDataOf(card)
  const logic = logicOf(card)
  const watch = watchOf(card)
  const hasDetail = Boolean(keyData || logic || watch)

  return (
    <article className="dsh">
      <div className="dsh-top">
        <span className={`ds-tag${faith ? '' : ' ds-tag--sober'}`}>{courseOf(card)}</span>
        {faith && card.charge >= 12 && <span className="ds-badge">推荐</span>}
        <span className="dsh-sold">已售 {stat?.charges ?? 0}</span>
      </div>
      <div className="dsh-head">
        <h2>{dishName(card)}</h2>
        {faith ? (
          <span className="ds-price ds-price--lg">
            {card.charge}
            <small>信仰</small>
          </span>
        ) : (
          <span className="ds-price ds-price--free">免费</span>
        )}
      </div>
      <p className="dsh-claim">{card.title}</p>
      {hasDetail ? (
        <details className="dsh-more" open>
          <summary>数据、逻辑与关注点</summary>
          <dl>
            {keyData && (
              <>
                <dt>关键数据</dt>
                <dd>{keyData}</dd>
              </>
            )}
            {logic && (
              <>
                <dt>逻辑链条</dt>
                <dd>{logic}</dd>
              </>
            )}
            {watch && (
              <>
                <dt className="is-ok">接下来关注什么</dt>
                <dd>{watch}</dd>
              </>
            )}
          </dl>
        </details>
      ) : (
        <p className="dsh-point">{pointOf(card)}</p>
      )}
      <dl className="dsh-meta">
        <dt>出品</dt>
        <dd>
          {card.source.name}
          {card.source.stance && <span className="ds-muted">，{card.source.stance}</span>}
          {card.source.url && (
            <>
              {' '}
              <a className="ds-link" href={card.source.url} target="_blank" rel="noopener noreferrer">
                看原文
              </a>
            </>
          )}
        </dd>
        {evText && (
          <>
            <dt>关注节点</dt>
            <dd>{evText}</dd>
          </>
        )}
      </dl>
      <div className="dsh-actions">
        <button type="button" className="ds-btn ds-btn--secondary" onClick={onClose}>
          关闭
        </button>
        {picked ? (
          <button type="button" className="ds-btn ds-btn--secondary" onClick={onToggle}>
            退掉这道
          </button>
        ) : (
          <button type="button" className="ds-btn ds-btn--primary" onClick={onToggle}>
            {faith ? (
              <>
                加一份 <b>+{card.charge}</b>
              </>
            ) : (
              '加这道凉菜'
            )}
          </button>
        )}
      </div>
    </article>
  )
}
