-- Payment correctness + abuse-control primitives.
--
-- 1. stripe_webhook_events  — makes Stripe webhook delivery idempotent.
-- 2. credit_community_fund  — atomic replacement for the read-modify-write credit.
-- 3. api_rate_limits        — fixed-window limiter for the public server functions.
-- 4. column grant repair    — pledges.display_initials was added after the
--                             column-level GRANT, so RLS clients could not read it.

-- ---------------------------------------------------------------------------
-- 1. Webhook event ledger
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.stripe_webhook_events (
  event_id     TEXT PRIMARY KEY,
  type         TEXT NOT NULL,
  environment  TEXT NOT NULL,
  received_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS stripe_webhook_events_received_idx
  ON public.stripe_webhook_events (received_at);

ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY;
-- Deliberately no policies: only service_role (which bypasses RLS) may touch this.
GRANT ALL ON public.stripe_webhook_events TO service_role;

-- ---------------------------------------------------------------------------
-- 2. Atomic community-fund credit
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.credit_community_fund(p_delta_cents BIGINT)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total BIGINT;
BEGIN
  UPDATE public.community_fund
     SET total_cents = total_cents + p_delta_cents,
         updated_at  = now()
   WHERE id = TRUE
  RETURNING total_cents INTO v_total;

  RETURN v_total;
END;
$$;

REVOKE ALL ON FUNCTION public.credit_community_fund(BIGINT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.credit_community_fund(BIGINT) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.credit_community_fund(BIGINT) TO service_role;

-- ---------------------------------------------------------------------------
-- 3. Fixed-window rate limiter
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.api_rate_limits (
  bucket_key   TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  hits         INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (bucket_key, window_start)
);

CREATE INDEX IF NOT EXISTS api_rate_limits_window_idx
  ON public.api_rate_limits (window_start);

ALTER TABLE public.api_rate_limits ENABLE ROW LEVEL SECURITY;
-- Deliberately no policies: service_role only.
GRANT ALL ON public.api_rate_limits TO service_role;

-- Returns TRUE when the call is allowed, FALSE when the bucket is exhausted.
CREATE OR REPLACE FUNCTION public.consume_rate_limit(
  p_key             TEXT,
  p_limit           INTEGER,
  p_window_seconds  INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_window TIMESTAMPTZ;
  v_hits   INTEGER;
BEGIN
  IF p_window_seconds <= 0 OR p_limit <= 0 THEN
    RAISE EXCEPTION 'consume_rate_limit: limit and window must be positive';
  END IF;

  -- Align to a fixed window so concurrent callers share one row.
  v_window := to_timestamp(
    floor(extract(EPOCH FROM now()) / p_window_seconds) * p_window_seconds
  );

  INSERT INTO public.api_rate_limits AS l (bucket_key, window_start, hits)
  VALUES (p_key, v_window, 1)
  ON CONFLICT (bucket_key, window_start)
  DO UPDATE SET hits = l.hits + 1
  RETURNING l.hits INTO v_hits;

  -- Opportunistic sweep of expired buckets (~1% of calls) so the table
  -- does not grow without bound and no cron job is required.
  IF random() < 0.01 THEN
    DELETE FROM public.api_rate_limits
     WHERE window_start < now() - make_interval(secs => p_window_seconds * 10);
  END IF;

  RETURN v_hits <= p_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_rate_limit(TEXT, INTEGER, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.consume_rate_limit(TEXT, INTEGER, INTEGER) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_rate_limit(TEXT, INTEGER, INTEGER) TO service_role;

-- ---------------------------------------------------------------------------
-- 3b. Atomic repeat-sighting bookkeeping for the register
--     (the append-only trigger permits exactly these two columns to change)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.bump_certificate_sighting(p_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_seen INTEGER;
BEGIN
  UPDATE public.certificate_register
     SET seen_count   = seen_count + 1,
         last_seen_at = now()
   WHERE id = p_id
  RETURNING seen_count INTO v_seen;

  RETURN v_seen;
END;
$$;

REVOKE ALL ON FUNCTION public.bump_certificate_sighting(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.bump_certificate_sighting(UUID) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bump_certificate_sighting(UUID) TO service_role;

-- ---------------------------------------------------------------------------
-- 4. Repair the pledges column grant
--    20260812145918 pinned an explicit column list; display_initials (added in
--    20260816130929) was never granted, so getMyPledgeIdentity failed with
--    "permission denied for column display_initials" under RLS.
-- ---------------------------------------------------------------------------
GRANT SELECT (display_initials) ON public.pledges TO authenticated;
