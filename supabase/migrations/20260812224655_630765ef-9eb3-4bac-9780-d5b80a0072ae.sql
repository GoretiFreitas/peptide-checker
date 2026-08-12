ALTER TABLE public.pledges ADD COLUMN IF NOT EXISTS payment_method_type text;
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS payment_method_type text;