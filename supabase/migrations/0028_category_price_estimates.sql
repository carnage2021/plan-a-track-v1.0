-- 1. One price for every dish in a category or sub-category (Live counters › Woodfire pizza: ₹130).
--    price_set empty or 1: each dish costs the price. price_set 2: the price is for a set of 2 dishes, so 1 or 2
--    pizzas picked for an event cost ₹130 a plate, 3 or 4 cost ₹260. Dishes inside take the price; the nearest
--    priced category wins.
-- 2. Cost Calculator: menus and extras worked out for their bill, costing and profit without making a booking.
--    Each calculation is kept with its events, menu, extras and discount (the booking draft) until deleted.
-- Run after 0027. Safe to run again.

alter table public.menu_categories add column if not exists price numeric(12, 2);
alter table public.menu_categories add column if not exists price_set integer check (price_set is null or price_set >= 1);

create table if not exists public.estimates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id) on delete cascade,
  name text not null,
  draft jsonb not null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists estimates_tenant on public.estimates (tenant_id);

alter table public.estimates enable row level security;
drop policy if exists "tenant members read" on public.estimates;
create policy "tenant members read" on public.estimates for select using (tenant_id = public.current_tenant_id());
drop policy if exists "allowed roles write" on public.estimates;
create policy "allowed roles write" on public.estimates
  for all using (tenant_id = public.current_tenant_id() and public.current_role_is('owner', 'sales', 'accountant'))
  with check (tenant_id = public.current_tenant_id());
