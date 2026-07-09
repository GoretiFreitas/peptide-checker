
-- Roles
create type public.app_role as enum ('admin');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  handle text unique,
  created_at timestamptz not null default now()
);
grant select on public.profiles to anon, authenticated;
grant update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "profiles readable by everyone" on public.profiles for select using (true);
create policy "users update own profile" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;
create policy "users read own roles" on public.user_roles for select to authenticated using (auth.uid() = user_id);

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, handle) values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'handle', 'user-' || substr(new.id::text, 1, 8))
  ) on conflict (id) do nothing;
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Board items
create type public.board_state as enum (
  'nominated','funding','funded','procuring','testing','published','expired'
);

create table public.board_items (
  id uuid primary key default gen_random_uuid(),
  product_name text not null,
  seller text not null default '',
  source_url text,
  sequence text,
  description text,
  state public.board_state not null default 'nominated',
  sample_cost_cents integer not null default 0,
  test_cost_cents integer not null default 0,
  operations_margin_cents integer not null default 0,
  goal_cents integer generated always as (sample_cost_cents + test_cost_cents + operations_margin_cents) stored,
  test_battery jsonb not null default '["identity","purity","content"]'::jsonb,
  funding_deadline timestamptz,
  nominated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.board_items to anon, authenticated;
grant insert on public.board_items to authenticated;
grant all on public.board_items to service_role;
alter table public.board_items enable row level security;
create policy "board items readable by everyone" on public.board_items for select using (true);
create policy "authenticated can nominate" on public.board_items for insert to authenticated with check (
  auth.uid() = nominated_by and state = 'nominated'
);
create policy "admins update items" on public.board_items for update to authenticated using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

-- Stretch goals
create table public.board_stretch_goals (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.board_items(id) on delete cascade,
  label text not null,
  add_cost_cents integer not null,
  unlocked boolean not null default false,
  created_at timestamptz not null default now()
);
grant select on public.board_stretch_goals to anon, authenticated;
grant all on public.board_stretch_goals to service_role;
alter table public.board_stretch_goals enable row level security;
create policy "stretch readable by everyone" on public.board_stretch_goals for select using (true);
create policy "admins manage stretch" on public.board_stretch_goals for all to authenticated using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

-- Pledges
create type public.pledge_status as enum ('authorized','captured','cancelled','failed','pending');

create table public.pledges (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.board_items(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  amount_cents integer not null check (amount_cents > 0),
  stripe_payment_intent_id text unique,
  stripe_checkout_session_id text unique,
  status public.pledge_status not null default 'pending',
  environment text not null default 'sandbox',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.pledges to authenticated;
grant insert on public.pledges to authenticated;
grant all on public.pledges to service_role;
alter table public.pledges enable row level security;
-- No anon read: pledges are private to the pledger and admins.
create policy "users read own pledges" on public.pledges for select to authenticated using (auth.uid() = user_id or public.has_role(auth.uid(), 'admin'));
create policy "users create own pledges" on public.pledges for insert to authenticated with check (auth.uid() = user_id);
create policy "admins update pledges" on public.pledges for update to authenticated using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

-- Public view of pledge totals (safe to expose)
create or replace view public.item_funding_totals as
  select item_id,
    sum(case when status in ('authorized','captured') then amount_cents else 0 end)::bigint as pledged_cents,
    count(*) filter (where status in ('authorized','captured'))::bigint as backer_count
  from public.pledges
  group by item_id;
grant select on public.item_funding_totals to anon, authenticated;

-- Results
create type public.result_verdict as enum ('consistent','concerns','failed','insufficient');

create table public.results (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null unique references public.board_items(id) on delete cascade,
  batch_id text,
  sampled_at date,
  tested_at date,
  lab_name text,
  summary text,
  verdict public.result_verdict not null default 'consistent',
  raw_findings jsonb not null default '{}'::jsonb,
  signed_off_by uuid references auth.users(id) on delete set null,
  signed_off_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.results to anon, authenticated;
grant all on public.results to service_role;
alter table public.results enable row level security;
create policy "results readable when published" on public.results for select using (published_at is not null or public.has_role(auth.uid(), 'admin'));
create policy "admins manage results" on public.results for all to authenticated using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

-- Community fund (single row)
create table public.community_fund (
  id boolean primary key default true,
  total_cents bigint not null default 0,
  updated_at timestamptz not null default now(),
  constraint community_fund_singleton check (id = true)
);
insert into public.community_fund (id, total_cents) values (true, 0);
grant select on public.community_fund to anon, authenticated;
grant all on public.community_fund to service_role;
alter table public.community_fund enable row level security;
create policy "fund readable by everyone" on public.community_fund for select using (true);

-- updated_at trigger
create or replace function public.tg_touch_updated_at()
returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end; $$;
create trigger touch_board_items before update on public.board_items for each row execute function public.tg_touch_updated_at();
create trigger touch_pledges before update on public.pledges for each row execute function public.tg_touch_updated_at();
create trigger touch_results before update on public.results for each row execute function public.tg_touch_updated_at();

-- Seed 3 demo items so the board is never empty
insert into public.board_items (product_name, seller, source_url, description, state, sample_cost_cents, test_cost_cents, operations_margin_cents, test_battery, funding_deadline)
values
  ('Semaglutide 5mg', 'Peptide Sciences', 'https://example.com/semaglutide-5mg', 'Community-requested test of the most-purchased semaglutide product on the market.', 'funding', 12000, 34000, 5000, '["identity","purity","content","endotoxins"]'::jsonb, now() + interval '12 days'),
  ('BPC-157 5mg', 'BioTech Peptides', 'https://example.com/bpc-157-5mg', 'Full injectable-grade panel including sterility and endotoxin.', 'funded', 8000, 42000, 5500, '["identity","purity","content","endotoxins","sterility"]'::jsonb, null),
  ('Retatrutide 10mg', 'Amino Asylum', 'https://example.com/retatrutide-10mg', 'First independent test in the community for this product.', 'published', 15000, 38000, 5000, '["identity","purity","content"]'::jsonb, null);

-- Published result for the third item
insert into public.results (item_id, batch_id, sampled_at, tested_at, lab_name, summary, verdict, raw_findings, signed_off_at, published_at)
select id, 'RTT-2026-04-B',
  date '2026-05-02', date '2026-05-19',
  'Janoshik Analytical',
  'Identity confirmed by mass spec. Chromatographic purity 96.8% (research grade). Net peptide content 78%. No independent injectable-safety tests were commissioned in this round.',
  'concerns',
  '{"identity":"pass","purity_percent":96.8,"content_percent":78,"endotoxins":"not tested","sterility":"not tested"}'::jsonb,
  now() - interval '3 days', now() - interval '2 days'
from public.board_items where product_name = 'Retatrutide 10mg';
