-- record_swipe 的返回列 card_id 和 swipes.card_id 同名，PL/pgSQL 报“列引用不明确”。
-- 声明冲突时优先按表列解析。
CREATE OR REPLACE FUNCTION public.record_swipe(p_device uuid, p_card text, p_dir smallint)
RETURNS TABLE (card_id text, charges int, doubts int)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
#variable_conflict use_column
BEGIN
  IF p_dir NOT IN (-1, 1) THEN
    RAISE EXCEPTION 'dir must be -1 or 1';
  END IF;
  INSERT INTO public.swipes AS s (device_id, card_id, dir)
  VALUES (p_device, p_card, p_dir)
  ON CONFLICT (device_id, card_id) DO UPDATE SET dir = EXCLUDED.dir, updated_at = now();
  RETURN QUERY
    SELECT cs.card_id, cs.charges, cs.doubts FROM public.card_stats cs WHERE cs.card_id = p_card;
END $$;
