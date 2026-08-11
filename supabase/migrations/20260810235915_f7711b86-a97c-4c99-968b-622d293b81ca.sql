ALTER TABLE public.pledges ADD COLUMN IF NOT EXISTS x_handle text;
ALTER TABLE public.pledges ADD COLUMN IF NOT EXISTS display_mode text NOT NULL DEFAULT 'initials' CHECK (display_mode IN ('handle', 'initials', 'anonymous'));
ALTER TABLE public.pledges ADD COLUMN IF NOT EXISTS hide_amount boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.pledges.x_handle IS 'Self-reported X handle, stripped of @, max 15 chars; never verified.';
COMMENT ON COLUMN public.pledges.display_mode IS 'Public backer-list identity: handle, initials, or anonymous.';
COMMENT ON COLUMN public.pledges.hide_amount IS 'When true, amount is hidden on public backer list.';