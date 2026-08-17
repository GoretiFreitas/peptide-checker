REVOKE UPDATE ON public.pledges FROM anon;
REVOKE UPDATE ON public.pledges FROM authenticated;
GRANT UPDATE (x_handle, display_mode, display_initials, hide_amount, stripe_checkout_session_id) ON public.pledges TO authenticated;

DROP POLICY IF EXISTS "users update own pledge identity" ON public.pledges;
CREATE POLICY "users update own pledge identity"
ON public.pledges
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);