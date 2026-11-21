-- 信仰充值站：牌组、卡片、验证事件、滑卡记录

CREATE TABLE IF NOT EXISTS public.decks (
  id          text PRIMARY KEY,               -- 例如 2026-11-21
  title       text NOT NULL,
  published_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.verify_events (
  key         text PRIMARY KEY,
  name        text NOT NULL,
  when_label  text NOT NULL,
  short_label text NOT NULL,
  happens_at  timestamptz,                    -- null 表示持续追踪
  sort        int  NOT NULL DEFAULT 0,
  status      text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','settled'))
);

CREATE TABLE IF NOT EXISTS public.cards (
  id            text PRIMARY KEY,
  deck_id       text NOT NULL REFERENCES public.decks(id) ON DELETE CASCADE,
  position      int  NOT NULL,
  kind          text NOT NULL CHECK (kind IN ('faith','sober')),
  tag           text NOT NULL,
  title         text NOT NULL,
  rows          jsonb NOT NULL DEFAULT '[]'::jsonb,   -- [[label, text], ...]
  void_if       text,
  ok_if         text,
  charge        int  NOT NULL DEFAULT 0,
  event_keys    text[] NOT NULL DEFAULT '{}',
  source        jsonb NOT NULL,                        -- {name,handle,via,stance,date,url}
  verify_status text NOT NULL DEFAULT 'unverified' CHECK (verify_status IN ('unverified','verified','corrected')),
  outcome       text NOT NULL DEFAULT 'pending' CHECK (outcome IN ('pending','fulfilled','void','partial','postponed')),
  UNIQUE (deck_id, position)
);
CREATE INDEX IF NOT EXISTS cards_deck_idx ON public.cards (deck_id, position);

CREATE TABLE IF NOT EXISTS public.swipes (
  device_id  uuid NOT NULL,
  card_id    text NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,
  dir        smallint NOT NULL CHECK (dir IN (-1, 1)),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (device_id, card_id)
);
CREATE INDEX IF NOT EXISTS swipes_card_idx ON public.swipes (card_id);

-- 只读内容：任何人可读，客户端不能写
ALTER TABLE public.decks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verify_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.swipes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public read decks" ON public.decks;
CREATE POLICY "public read decks" ON public.decks FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "public read events" ON public.verify_events;
CREATE POLICY "public read events" ON public.verify_events FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "public read cards" ON public.cards;
CREATE POLICY "public read cards" ON public.cards FOR SELECT TO anon, authenticated USING (true);

REVOKE INSERT, UPDATE, DELETE ON public.decks, public.verify_events, public.cards FROM anon, authenticated;
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON public.decks, public.verify_events, public.cards TO anon, authenticated;

-- 滑卡记录：客户端不直接读写表，只能通过下面两个函数
REVOKE ALL ON public.swipes FROM anon, authenticated;

-- 全站统计：只暴露聚合数，不暴露设备 id
CREATE OR REPLACE VIEW public.card_stats AS
  SELECT c.id AS card_id,
         c.deck_id,
         count(s.*) FILTER (WHERE s.dir = 1)::int  AS charges,
         count(s.*) FILTER (WHERE s.dir = -1)::int AS doubts
  FROM public.cards c
  LEFT JOIN public.swipes s ON s.card_id = c.id
  GROUP BY c.id, c.deck_id;
GRANT SELECT ON public.card_stats TO anon, authenticated;

-- 记录一次滑卡（同一设备对同一张卡只保留最后一次），返回这张卡最新的全站统计
CREATE OR REPLACE FUNCTION public.record_swipe(p_device uuid, p_card text, p_dir smallint)
RETURNS TABLE (card_id text, charges int, doubts int)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  IF p_dir NOT IN (-1, 1) THEN
    RAISE EXCEPTION 'dir must be -1 or 1';
  END IF;
  INSERT INTO public.swipes (device_id, card_id, dir)
  VALUES (p_device, p_card, p_dir)
  ON CONFLICT (device_id, card_id) DO UPDATE SET dir = EXCLUDED.dir, updated_at = now();
  RETURN QUERY
    SELECT cs.card_id, cs.charges, cs.doubts FROM public.card_stats cs WHERE cs.card_id = p_card;
END $$;

-- 用户点“重新刷一遍”时清掉这台设备在某副牌上的记录
CREATE OR REPLACE FUNCTION public.reset_swipes(p_device uuid, p_deck text)
RETURNS void
LANGUAGE sql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  DELETE FROM public.swipes s USING public.cards c
  WHERE s.card_id = c.id AND c.deck_id = p_deck AND s.device_id = p_device;
$$;

REVOKE ALL ON FUNCTION public.record_swipe(uuid, text, smallint) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reset_swipes(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_swipe(uuid, text, smallint) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reset_swipes(uuid, text) TO anon, authenticated;
