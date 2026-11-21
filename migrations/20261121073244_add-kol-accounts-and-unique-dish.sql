-- Unified faith-recharge backend: add KOL accounts catalog and enforce unique dish names per deck.

CREATE TABLE IF NOT EXISTS public.kol_accounts (
  username TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  region TEXT NOT NULL CHECK (region IN ('zh', 'en')),
  followers INTEGER,
  bio TEXT NOT NULL DEFAULT '',
  tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  why_add TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT 'grok_discovery',
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kol_accounts_region ON public.kol_accounts (region);
CREATE INDEX IF NOT EXISTS idx_kol_accounts_tags ON public.kol_accounts USING GIN (tags);

ALTER TABLE public.kol_accounts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.kol_accounts FROM anon, authenticated;
GRANT SELECT ON TABLE public.kol_accounts TO anon, authenticated;

DROP POLICY IF EXISTS "kol_accounts_public_read" ON public.kol_accounts;
CREATE POLICY "kol_accounts_public_read"
  ON public.kol_accounts
  FOR SELECT
  TO anon, authenticated
  USING (enabled = true);

CREATE UNIQUE INDEX IF NOT EXISTS idx_cards_deck_dish_unique
  ON public.cards (deck_id, dish)
  WHERE dish IS NOT NULL;
