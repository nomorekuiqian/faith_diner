-- 点菜模式：每次下单生成一张小票，同时把点过的菜记进 swipes（dir = 1），沿用全站统计
CREATE TABLE IF NOT EXISTS public.orders (
  id         bigserial PRIMARY KEY,
  order_no   text NOT NULL UNIQUE,
  device_id  uuid NOT NULL,
  deck_id    text NOT NULL REFERENCES public.decks(id) ON DELETE CASCADE,
  items      text[] NOT NULL,
  sides      text[] NOT NULL DEFAULT '{}',
  total      int NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS orders_deck_idx ON public.orders (deck_id);

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.orders FROM anon, authenticated;

-- 每副牌的出单数，只暴露计数
CREATE OR REPLACE VIEW public.deck_order_stats AS
  SELECT d.id AS deck_id, count(o.id)::int AS orders
  FROM public.decks d LEFT JOIN public.orders o ON o.deck_id = d.id
  GROUP BY d.id;
GRANT SELECT ON public.deck_order_stats TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.place_order(p_device uuid, p_deck text, p_items text[], p_sides text[])
RETURNS TABLE (order_no text, total int, created_at timestamptz, daily_seq int, items text[], sides text[])
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
#variable_conflict use_column
DECLARE
  v_items text[];
  v_sides text[];
  v_total int;
  v_seq   int;
  v_no    text;
  v_id    bigint;
  v_at    timestamptz;
BEGIN
  IF p_items IS NULL OR coalesce(array_length(p_items, 1), 0) = 0 THEN
    RAISE EXCEPTION '至少要点一道信仰菜';
  END IF;
  IF array_length(p_items, 1) > 40 OR coalesce(array_length(p_sides, 1), 0) > 40 THEN
    RAISE EXCEPTION '一单最多 40 道菜';
  END IF;

  SELECT array_agg(c.id ORDER BY c.position), coalesce(sum(c.charge), 0)::int
    INTO v_items, v_total
    FROM public.cards c
   WHERE c.deck_id = p_deck AND c.kind = 'faith' AND c.id = ANY (p_items);
  IF v_items IS NULL THEN
    RAISE EXCEPTION '菜单里没有这些菜';
  END IF;

  SELECT coalesce(array_agg(c.id ORDER BY c.position), '{}')
    INTO v_sides
    FROM public.cards c
   WHERE c.deck_id = p_deck AND c.kind = 'sober' AND c.id = ANY (coalesce(p_sides, '{}'));

  SELECT count(*)::int + 1 INTO v_seq FROM public.orders o WHERE o.deck_id = p_deck;
  v_no := substr(replace(p_deck, '-', ''), 5) || '-' || lpad(v_seq::text, 4, '0');

  INSERT INTO public.orders AS o (order_no, device_id, deck_id, items, sides, total)
  VALUES (v_no, p_device, p_deck, v_items, v_sides, v_total)
  ON CONFLICT (order_no) DO NOTHING
  RETURNING o.id, o.created_at INTO v_id, v_at;

  IF v_id IS NULL THEN
    -- 并发下单撞号时加一个短后缀
    v_no := v_no || '-' || substr(md5(random()::text), 1, 3);
    INSERT INTO public.orders AS o (order_no, device_id, deck_id, items, sides, total)
    VALUES (v_no, p_device, p_deck, v_items, v_sides, v_total)
    RETURNING o.id, o.created_at INTO v_id, v_at;
  END IF;

  INSERT INTO public.swipes AS s (device_id, card_id, dir)
  SELECT p_device, x, 1 FROM unnest(v_items || v_sides) AS x
  ON CONFLICT (device_id, card_id) DO UPDATE SET dir = 1, updated_at = now();

  RETURN QUERY SELECT v_no, v_total, v_at, v_seq, v_items, v_sides;
END $$;

REVOKE ALL ON FUNCTION public.place_order(uuid, text, text[], text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.place_order(uuid, text, text[], text[]) TO anon, authenticated;
