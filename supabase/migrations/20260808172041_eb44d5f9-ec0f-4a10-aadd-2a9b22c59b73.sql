CREATE OR REPLACE VIEW public.item_funding_totals AS
SELECT item_id,
  sum(CASE WHEN status IN ('paid','authorized','captured') THEN amount_cents ELSE 0 END) AS pledged_cents,
  count(*) FILTER (WHERE status IN ('paid','authorized','captured')) AS backer_count
FROM public.pledges
GROUP BY item_id;