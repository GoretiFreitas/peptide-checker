
-- Profiles: restrict SELECT to authenticated
DROP POLICY IF EXISTS "profiles readable by everyone" ON public.profiles;
CREATE POLICY "profiles readable by authenticated"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

-- Private schema for internal helpers not exposed via PostgREST
CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

REVOKE ALL ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated, service_role;

-- Recreate every dependent policy to reference private.has_role
DROP POLICY IF EXISTS "admins update items" ON public.board_items;
CREATE POLICY "admins update items" ON public.board_items
  FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'))
  WITH CHECK (private.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins delete items" ON public.board_items
  FOR DELETE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "admins manage stretch" ON public.board_stretch_goals;
CREATE POLICY "admins manage stretch" ON public.board_stretch_goals
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'))
  WITH CHECK (private.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "users read own pledges" ON public.pledges;
CREATE POLICY "users read own pledges" ON public.pledges
  FOR SELECT TO authenticated
  USING ((auth.uid() = user_id) OR private.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "admins update pledges" ON public.pledges;
CREATE POLICY "admins update pledges" ON public.pledges
  FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'))
  WITH CHECK (private.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins delete pledges" ON public.pledges
  FOR DELETE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "results readable when published" ON public.results;
CREATE POLICY "results readable when published" ON public.results
  FOR SELECT
  USING ((published_at IS NOT NULL) OR private.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "admins manage results" ON public.results;
CREATE POLICY "admins manage results" ON public.results
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'))
  WITH CHECK (private.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "admins read all purchases" ON public.purchases;
CREATE POLICY "admins read all purchases" ON public.purchases
  FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "admins read activity" ON public.admin_activity;
CREATE POLICY "admins read activity" ON public.admin_activity
  FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'));

-- Drop the public (API-exposed) has_role
DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);
