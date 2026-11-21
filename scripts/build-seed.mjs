// 把 data/deck-*.json 转成可重复执行的 upsert SQL。
// 用法：node scripts/build-seed.mjs data/deck-2026-11-21.json > tmp/seed.sql
import { readFileSync } from 'node:fs'

const file = process.argv[2]
if (!file) {
  console.error('用法：node scripts/build-seed.mjs <deck.json>')
  process.exit(1)
}
const { deck, events, cards } = JSON.parse(readFileSync(file, 'utf8'))

const q = (v) => (v === null || v === undefined ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`)
const j = (v) => `${q(JSON.stringify(v))}::jsonb`
const arr = (a) => `ARRAY[${a.map(q).join(',')}]::text[]`

const out = []

out.push(
  `INSERT INTO public.decks (id, title) VALUES (${q(deck.id)}, ${q(deck.title)})
   ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title;`
)
for (const e of events) {
  out.push(
    `INSERT INTO public.verify_events (key, name, when_label, short_label, happens_at, sort)
     VALUES (${q(e.key)}, ${q(e.name)}, ${q(e.when_label)}, ${q(e.short_label)}, ${e.happens_at ? q(e.happens_at) + '::timestamptz' : 'NULL'}, ${e.sort})
     ON CONFLICT (key) DO UPDATE SET name = EXCLUDED.name, when_label = EXCLUDED.when_label,
       short_label = EXCLUDED.short_label, happens_at = EXCLUDED.happens_at, sort = EXCLUDED.sort;`
  )
}
out.push(`UPDATE public.cards SET position = position + 1000 WHERE deck_id = ${q(deck.id)};`)
cards.forEach((c, i) => {
  out.push(
    `INSERT INTO public.cards (id, deck_id, position, kind, tag, title, rows, void_if, ok_if, charge, event_keys, source)
     VALUES (${q(c.id)}, ${q(deck.id)}, ${i + 1}, ${q(c.kind)}, ${q(c.tag)}, ${q(c.title)}, ${j(c.rows)},
       ${q(c.void_if)}, ${q(c.ok_if)}, ${c.charge || 0}, ${arr(c.event_keys || [])}, ${j(c.source)})
     ON CONFLICT (id) DO UPDATE SET position = EXCLUDED.position, kind = EXCLUDED.kind, tag = EXCLUDED.tag,
       title = EXCLUDED.title, rows = EXCLUDED.rows, void_if = EXCLUDED.void_if, ok_if = EXCLUDED.ok_if,
       charge = EXCLUDED.charge, event_keys = EXCLUDED.event_keys, source = EXCLUDED.source;`
  )
})

process.stdout.write(out.join('\n') + '\n')
