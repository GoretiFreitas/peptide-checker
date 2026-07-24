-- Explicitly block client-side writes to purchases; service_role bypasses RLS.
CREATE POLICY "purchases_no_client_insert" ON public.purchases FOR INSERT TO authenticated, anon WITH CHECK (false);
CREATE POLICY "purchases_no_client_update" ON public.purchases FOR UPDATE TO authenticated, anon USING (false) WITH CHECK (false);
CREATE POLICY "purchases_no_client_delete" ON public.purchases FOR DELETE TO authenticated, anon USING (false);

-- Subscriptions: writes only via webhook (service_role).
CREATE POLICY "subscriptions_no_client_insert" ON public.subscriptions FOR INSERT TO authenticated, anon WITH CHECK (false);
CREATE POLICY "subscriptions_no_client_update" ON public.subscriptions FOR UPDATE TO authenticated, anon USING (false) WITH CHECK (false);
CREATE POLICY "subscriptions_no_client_delete" ON public.subscriptions FOR DELETE TO authenticated, anon USING (false);

-- User roles: prevent privilege escalation. Only service_role or admin scripts may write.
CREATE POLICY "user_roles_no_client_insert" ON public.user_roles FOR INSERT TO authenticated, anon WITH CHECK (false);
CREATE POLICY "user_roles_no_client_update" ON public.user_roles FOR UPDATE TO authenticated, anon USING (false) WITH CHECK (false);
CREATE POLICY "user_roles_no_client_delete" ON public.user_roles FOR DELETE TO authenticated, anon USING (false);