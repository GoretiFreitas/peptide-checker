REVOKE SELECT ON public.pledges FROM anon, authenticated;
GRANT SELECT (id, item_id, user_id, amount_cents, status, environment, created_at, updated_at, refunded_cents, rolled_over_from_item_id, rolled_over_at, x_handle, display_mode, hide_amount) ON public.pledges TO authenticated;
GRANT ALL ON public.pledges TO service_role;