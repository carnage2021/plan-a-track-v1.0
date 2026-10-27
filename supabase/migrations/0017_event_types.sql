-- Each caterer's own list of event types (Wedding, Birthday, Griha Shanti ...), shown in the enquiry, quotation
-- and booking forms. An account with none yet uses the app's standard list. Run after 0016. Safe to run again.

create table if not exists public.event_types (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id) on delete cascade,
  name text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create unique index if not exists event_types_name_key on public.event_types (tenant_id, lower(name));
create index if not exists event_types_tenant_idx on public.event_types (tenant_id);

alter table public.event_types enable row level security;
drop policy if exists "tenant members read" on public.event_types;
drop policy if exists "owner writes" on public.event_types;
create policy "tenant members read" on public.event_types for select using (tenant_id = public.current_tenant_id());
create policy "owner writes" on public.event_types for all
  using (tenant_id = public.current_tenant_id() and public.current_role_is('owner'))
  with check (tenant_id = public.current_tenant_id());
