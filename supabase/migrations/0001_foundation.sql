-- Phase 1: tenants, team and the row-level security that keeps each caterer's data separate.
-- Every business table carries tenant_id; policies compare it with the signed-in user's tenant.

create extension if not exists "pgcrypto";

create type public.app_role as enum ('owner', 'sales', 'operations', 'kitchen', 'store', 'accountant');
create type public.account_status as enum ('trial', 'active', 'overdue', 'suspended');

create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  subdomain text unique,
  tagline text not null default '',
  city text not null default '',
  phone text not null default '',
  email text not null default '',
  address text not null default '',
  logo_path text,
  brand_color text not null default '#7c2d12',
  gstin text not null default '',
  bank_name text not null default '',
  bank_account text not null default '',
  ifsc text not null default '',
  upi_id text not null default '',
  quote_prefix text not null default 'QT',
  order_prefix text not null default 'ORD',
  invoice_prefix text not null default 'INV',
  terms text not null default '',
  gst_rate numeric(5, 2) not null default 5,
  gst_inclusive boolean not null default false,
  discount_approval_pct numeric(5, 2) not null default 10,
  daily_capacity_pax integer not null default 1500,
  -- [{ "upTo": 300, "pct": 0 }, { "upTo": 500, "pct": 3 }, { "pct": 5 }]
  pax_slabs jsonb not null default '[]'::jsonb,
  status public.account_status not null default 'trial',
  setup_done boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.branches (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  name text not null,
  address text not null default '',
  created_at timestamptz not null default now()
);

-- One row per login. id matches auth.users.id.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  branch_id uuid references public.branches (id) on delete set null,
  name text not null,
  phone text not null default '',
  role public.app_role not null default 'sales',
  locale text not null default 'en' check (locale in ('en', 'hi', 'gu')),
  created_at timestamptz not null default now()
);

create table public.team_invites (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  name text not null,
  phone text not null,
  role public.app_role not null,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

-- Document number series, one counter per tenant, document type and financial year.
create table public.number_series (
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  doc_type text not null,
  financial_year text not null,
  last_number integer not null default 0,
  primary key (tenant_id, doc_type, financial_year)
);

create index on public.branches (tenant_id);
create index on public.profiles (tenant_id);
create index on public.team_invites (tenant_id);

-- Helpers used by every policy. security definer so they can read profiles without recursing into RLS.
create or replace function public.current_tenant_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select tenant_id from public.profiles where id = auth.uid()
$$;

create or replace function public.current_role_is(variadic roles public.app_role[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = any (roles))
$$;

-- Atomically hands out the next document number, e.g. next_doc_number('quote', '26-27') -> 66.
create or replace function public.next_doc_number(p_doc_type text, p_financial_year text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  insert into public.number_series (tenant_id, doc_type, financial_year, last_number)
  values (public.current_tenant_id(), p_doc_type, p_financial_year, 1)
  on conflict (tenant_id, doc_type, financial_year)
  do update set last_number = public.number_series.last_number + 1
  returning last_number into n;
  return n;
end;
$$;

alter table public.tenants enable row level security;
alter table public.branches enable row level security;
alter table public.profiles enable row level security;
alter table public.team_invites enable row level security;
alter table public.number_series enable row level security;

create policy "members read their tenant" on public.tenants
  for select using (id = public.current_tenant_id());
create policy "owner updates the tenant" on public.tenants
  for update using (id = public.current_tenant_id() and public.current_role_is('owner'))
  with check (id = public.current_tenant_id());

create policy "members read branches" on public.branches
  for select using (tenant_id = public.current_tenant_id());
create policy "owner manages branches" on public.branches
  for all using (tenant_id = public.current_tenant_id() and public.current_role_is('owner'))
  with check (tenant_id = public.current_tenant_id());

create policy "members read team" on public.profiles
  for select using (tenant_id = public.current_tenant_id());
create policy "owner manages team" on public.profiles
  for all using (tenant_id = public.current_tenant_id() and public.current_role_is('owner'))
  with check (tenant_id = public.current_tenant_id());
create policy "users update their own language" on public.profiles
  for update using (id = auth.uid())
  with check (id = auth.uid() and tenant_id = public.current_tenant_id());

create policy "owner manages invites" on public.team_invites
  for all using (tenant_id = public.current_tenant_id() and public.current_role_is('owner'))
  with check (tenant_id = public.current_tenant_id());

-- number_series is only touched through next_doc_number(); no direct policies on purpose.

-- Dish photos and logos live in one bucket, under a folder named after the tenant id.
insert into storage.buckets (id, name, public) values ('media', 'media', true) on conflict (id) do nothing;

create policy "tenant members upload media" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'media' and (storage.foldername(name))[1] = public.current_tenant_id()::text);
create policy "tenant members change their media" on storage.objects
  for update to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = public.current_tenant_id()::text);
create policy "tenant members delete their media" on storage.objects
  for delete to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = public.current_tenant_id()::text);
