
-- Add new roles
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'supporter';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'registry_member';

-- Subscriptions table (per stripe-webhooks knowledge)
CREATE TABLE public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  stripe_subscription_id text NOT NULL UNIQUE,
  stripe_customer_id text NOT NULL,
  product_id text NOT NULL,
  price_id text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean DEFAULT false,
  environment text NOT NULL DEFAULT 'sandbox',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX idx_subscriptions_user_id ON public.subscriptions(user_id);
CREATE INDEX idx_subscriptions_stripe_id ON public.subscriptions(stripe_subscription_id);

GRANT SELECT ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read own subscription" ON public.subscriptions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- One-time purchases (donations, registry access, pledge captures)
CREATE TABLE public.purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  stripe_payment_intent_id text UNIQUE,
  stripe_checkout_session_id text UNIQUE,
  stripe_customer_id text,
  product_id text NOT NULL,
  price_id text,
  kind text NOT NULL,               -- 'donation' | 'registry' | 'pledge_capture' | 'other'
  amount_cents bigint NOT NULL,
  net_cents bigint,                 -- amount minus Stripe fees, credited to fund
  currency text NOT NULL DEFAULT 'usd',
  status text NOT NULL DEFAULT 'succeeded',  -- succeeded | refunded | partially_refunded
  refunded_cents bigint NOT NULL DEFAULT 0,
  credited_to_fund boolean NOT NULL DEFAULT false,
  fund_credit_cents bigint NOT NULL DEFAULT 0,
  environment text NOT NULL DEFAULT 'sandbox',
  metadata jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX idx_purchases_user_id ON public.purchases(user_id);

GRANT SELECT ON public.purchases TO authenticated;
GRANT ALL ON public.purchases TO service_role;

ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read own purchases" ON public.purchases
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "admins read all purchases" ON public.purchases
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Admin activity feed
CREATE TABLE public.admin_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL,
  message text NOT NULL,
  meta jsonb,
  created_at timestamptz DEFAULT now()
);
GRANT SELECT ON public.admin_activity TO authenticated;
GRANT ALL ON public.admin_activity TO service_role;
ALTER TABLE public.admin_activity ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read activity" ON public.admin_activity
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Timestamp triggers
CREATE TRIGGER touch_subscriptions_updated_at BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();
CREATE TRIGGER touch_purchases_updated_at BEFORE UPDATE ON public.purchases
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();
