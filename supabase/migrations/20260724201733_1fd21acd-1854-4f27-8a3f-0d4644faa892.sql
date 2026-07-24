
CREATE TABLE public.certificate_register (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sha256 TEXT NOT NULL UNIQUE,
  normalized_sha256 TEXT,
  batch_id TEXT,
  product_name TEXT,
  sequence TEXT,
  purity_percent NUMERIC,
  issuing_lab TEXT,
  issue_date TEXT,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  seen_count INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX certificate_register_batch_idx ON public.certificate_register (batch_id);
CREATE INDEX certificate_register_normalized_idx ON public.certificate_register (normalized_sha256);

GRANT SELECT ON public.certificate_register TO anon, authenticated;
GRANT ALL ON public.certificate_register TO service_role;

ALTER TABLE public.certificate_register ENABLE ROW LEVEL SECURITY;

CREATE POLICY "register_public_read" ON public.certificate_register
  FOR SELECT TO anon, authenticated USING (true);

-- Append-only enforcement: block UPDATE/DELETE for every non-service role via trigger.
CREATE OR REPLACE FUNCTION public.certificate_register_append_only()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'certificate_register is append-only';
  END IF;
  IF TG_OP = 'UPDATE' THEN
    -- Only allow updating seen_count and last_seen_at (repeat-sighting bookkeeping).
    IF NEW.sha256 IS DISTINCT FROM OLD.sha256
       OR NEW.normalized_sha256 IS DISTINCT FROM OLD.normalized_sha256
       OR NEW.batch_id IS DISTINCT FROM OLD.batch_id
       OR NEW.product_name IS DISTINCT FROM OLD.product_name
       OR NEW.sequence IS DISTINCT FROM OLD.sequence
       OR NEW.purity_percent IS DISTINCT FROM OLD.purity_percent
       OR NEW.issuing_lab IS DISTINCT FROM OLD.issuing_lab
       OR NEW.issue_date IS DISTINCT FROM OLD.issue_date
       OR NEW.first_seen_at IS DISTINCT FROM OLD.first_seen_at
       OR NEW.id IS DISTINCT FROM OLD.id
    THEN
      RAISE EXCEPTION 'certificate_register fields are immutable';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER certificate_register_append_only_trg
BEFORE UPDATE OR DELETE ON public.certificate_register
FOR EACH ROW EXECUTE FUNCTION public.certificate_register_append_only();
