
CREATE OR REPLACE FUNCTION public.list_item_backers(_item_id uuid, _limit int DEFAULT 12)
RETURNS TABLE (
  amount_cents integer,
  created_at timestamptz,
  initial text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.amount_cents,
    p.created_at,
    upper(coalesce(substr(pr.handle, 1, 1), '?')) AS initial
  FROM public.pledges p
  LEFT JOIN public.profiles pr ON pr.id = p.user_id
  WHERE p.item_id = _item_id
    AND p.status IN ('authorized','captured')
  ORDER BY p.created_at DESC
  LIMIT LEAST(GREATEST(_limit, 1), 50);
$$;

REVOKE ALL ON FUNCTION public.list_item_backers(uuid, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_item_backers(uuid, int) TO anon, authenticated;
