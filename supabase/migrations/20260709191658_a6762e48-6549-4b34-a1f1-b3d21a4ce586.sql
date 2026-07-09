
-- Fix search_path on touch trigger
create or replace function public.tg_touch_updated_at()
returns trigger language plpgsql set search_path = public
as $$ begin new.updated_at = now(); return new; end; $$;

-- Restrict who can execute SECURITY DEFINER helpers
revoke execute on function public.has_role(uuid, public.app_role) from public, anon;
grant execute on function public.has_role(uuid, public.app_role) to authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- Rebuild view as SECURITY INVOKER (Postgres 15+)
drop view if exists public.item_funding_totals;
create view public.item_funding_totals
with (security_invoker = true) as
  select item_id,
    sum(case when status in ('authorized','captured') then amount_cents else 0 end)::bigint as pledged_cents,
    count(*) filter (where status in ('authorized','captured'))::bigint as backer_count
  from public.pledges
  group by item_id;
grant select on public.item_funding_totals to anon, authenticated;
