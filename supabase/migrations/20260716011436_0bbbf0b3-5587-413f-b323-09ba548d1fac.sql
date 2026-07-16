
ALTER TABLE public.board_items
  ADD COLUMN IF NOT EXISTS lab text NOT NULL DEFAULT 'janoshik' CHECK (lab IN ('janoshik','finnrick')),
  ADD COLUMN IF NOT EXISTS us_only boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS thumbnail_url text,
  ADD COLUMN IF NOT EXISTS coa_url text,
  ADD COLUMN IF NOT EXISTS batch_id text;

ALTER TABLE public.results
  ADD COLUMN IF NOT EXISTS findings jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Seed two demo campaigns. goal_cents is generated from sample+test+ops.
INSERT INTO public.board_items
  (id, product_name, seller, batch_id, lab, us_only, sample_cost_cents, test_cost_cents, operations_margin_cents, state, description)
VALUES
  ('11111111-1111-4111-8111-111111111111',
   'Retatrutide 10mg', 'Vendor X', '2406', 'janoshik', false,
   8000, 70800, 4000, 'funding',
   'Full 4-tier independent panel — sealed vial shipped to Janoshik (Prague).'),
  ('22222222-2222-4222-8222-222222222222',
   'Tirzepatide 10mg', 'Vendor Y', 'US-2407', 'finnrick', true,
   3000, 13000, 2000, 'funding',
   'US-only campaign. Finnrick covers purity; pledges fund contaminant add-ons.')
ON CONFLICT (id) DO NOTHING;
