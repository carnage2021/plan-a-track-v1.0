-- Phase 7: the platform (plan A1, A3). Super admin, plans and subscriptions, support, announcements,
-- the changelog and import history. Run once on top of 0001 to 0009.

-- People who run the platform. Add yourself after running this file:
--   insert into public.platform_admins (user_id) select id from auth.users where email = 'you@example.com';
create table public.platform_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.plans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  monthly_price numeric(12, 2) not null default 0,
  annual_price numeric(12, 2) not null default 0,
  -- A first-year annual price, when it differs from the renewal price.
  first_year_price numeric(12, 2),
  included_users integer not null default 3,
  extra_user_price numeric(12, 2) not null default 0,
  -- 0 means no limit.
  events_per_month integer not null default 0,
  branches integer not null default 1,
  storage_mb integer not null default 1024,
  -- Nav keys switched on; empty means everything.
  modules text[] not null default '{}',
  -- [{ "key": "messages", "label": "WhatsApp messages", "price": 499 }]
  addons jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  sort integer not null default 0
);

alter table public.tenants
  add column plan_id uuid references public.plans (id) on delete set null,
  add column trial_ends_at timestamptz default now() + interval '14 days',
  add column paid_until date,
  add column billing_cycle text not null default 'monthly' check (billing_cycle in ('monthly', 'annual')),
  add column addons text[] not null default '{}',
  add column extra_users integer not null default 0;

-- Existing accounts get a fresh 14-day trial from today rather than an expired one.
update public.tenants set trial_ends_at = now() + interval '14 days' where status = 'trial';

-- A caterer can edit its own business details, but never its plan, status or billing dates.
create or replace function public.guard_billing_columns()
returns trigger
language plpgsql
as $$
begin
  -- The admin API (service role) and the SQL editor (postgres) may change them; app users may not.
  if coalesce(auth.role(), '') <> 'service_role' and current_user not in ('postgres', 'supabase_admin') and (
    new.status is distinct from old.status or new.plan_id is distinct from old.plan_id or new.trial_ends_at is distinct from old.trial_ends_at
    or new.paid_until is distinct from old.paid_until or new.billing_cycle is distinct from old.billing_cycle
    or new.addons is distinct from old.addons or new.extra_users is distinct from old.extra_users) then
    raise exception 'Plan and billing details are changed by the platform team only';
  end if;
  return new;
end;
$$;
create trigger guard_billing_columns before update on public.tenants for each row execute function public.guard_billing_columns();

-- Our invoices to caterers for their subscription.
create table public.subscription_invoices (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  number text not null unique,
  description text not null,
  period_start date not null,
  period_end date not null,
  amount numeric(12, 2) not null,
  gst numeric(12, 2) not null default 0,
  total numeric(12, 2) not null,
  status text not null default 'paid' check (status in ('due', 'paid')),
  paid_on date,
  created_at timestamptz not null default now()
);

create table public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id) on delete cascade,
  user_id uuid default auth.uid() references auth.users (id) on delete set null,
  subject text not null,
  body text not null,
  status text not null default 'open' check (status in ('open', 'answered', 'closed')),
  reply text,
  replied_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  message text not null,
  tone text not null default 'info' check (tone in ('info', 'warning', 'success')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.changelog (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  published_on date not null default current_date
);

-- Everything a platform admin does to a caterer's account, including logging in as them.
create table public.admin_audit (
  id bigint generated always as identity primary key,
  admin_id uuid references auth.users (id) on delete set null,
  tenant_id uuid,
  action text not null,
  detail text not null default '',
  at timestamptz not null default now()
);

-- Excel uploads, so the last one can be undone.
create table public.imports (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id) on delete cascade,
  list text not null,
  file_name text not null default '',
  row_count integer not null,
  ids jsonb not null default '[]'::jsonb,
  undone boolean not null default false,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);

alter table public.platform_admins enable row level security;
alter table public.plans enable row level security;
alter table public.subscription_invoices enable row level security;
alter table public.support_tickets enable row level security;
alter table public.announcements enable row level security;
alter table public.changelog enable row level security;
alter table public.admin_audit enable row level security;
alter table public.imports enable row level security;

-- Platform tables are written only through the admin API with the service role; caterers read what is theirs.
create policy "signed-in users read plans" on public.plans for select to authenticated using (true);
create policy "signed-in users read announcements" on public.announcements for select to authenticated using (active);
create policy "signed-in users read changelog" on public.changelog for select to authenticated using (true);
create policy "tenant reads its invoices" on public.subscription_invoices for select using (tenant_id = public.current_tenant_id());
create policy "tenant reads its tickets" on public.support_tickets for select using (tenant_id = public.current_tenant_id());
create policy "tenant raises tickets" on public.support_tickets for insert with check (tenant_id = public.current_tenant_id() and status = 'open' and reply is null);
create policy "tenant reads imports" on public.imports for select using (tenant_id = public.current_tenant_id());
create policy "owner records imports" on public.imports for all
  using (tenant_id = public.current_tenant_id() and public.current_role_is('owner'))
  with check (tenant_id = public.current_tenant_id());

-- Starter plans; edit them in the admin panel.
insert into public.plans (name, monthly_price, annual_price, first_year_price, included_users, extra_user_price, events_per_month, branches, storage_mb, modules, addons, sort) values
  ('Starter', 999, 9990, 7990, 3, 199, 20, 1, 1024, '{}', '[{"key":"messages","label":"WhatsApp messages","price":299}]', 1),
  ('Growth', 2499, 24990, 19990, 8, 149, 0, 2, 5120, '{}', '[{"key":"messages","label":"WhatsApp messages","price":299}]', 2),
  ('Enterprise', 5999, 59990, null, 25, 99, 0, 10, 20480, '{}', '[]', 3);
