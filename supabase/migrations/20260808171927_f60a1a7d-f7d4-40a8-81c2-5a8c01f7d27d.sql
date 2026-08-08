ALTER TYPE public.pledge_status ADD VALUE IF NOT EXISTS 'paid';
ALTER TYPE public.pledge_status ADD VALUE IF NOT EXISTS 'refunded';

ALTER TABLE public.pledges
  ADD COLUMN IF NOT EXISTS backer_email text,
  ADD COLUMN IF NOT EXISTS rolled_over_from_item_id uuid REFERENCES public.board_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS rolled_over_at timestamptz,
  ADD COLUMN IF NOT EXISTS refunded_cents integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_pledges_item_status ON public.pledges(item_id, status);
CREATE INDEX IF NOT EXISTS idx_pledges_created_at ON public.pledges(created_at);