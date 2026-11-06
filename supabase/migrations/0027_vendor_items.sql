-- Vendor price list: what each vendor or agency supplies (a service, a product, a dish) and at what rate, uploaded
-- from the caterer's sheet ("Vendor price list" on the Import page) or added on the Vendors page. When a vendor is
-- picked for an extra line in a booking (waiters, water bottles, a decoration), their price for that item goes on
-- their work order and into the order's costing; the booking itself keeps only the client's price.
-- Run after 0026. Safe to run again.

create table if not exists public.vendor_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id) on delete cascade,
  vendor_id uuid not null references public.vendors (id) on delete cascade,
  name text not null,
  unit text not null default '',
  rate numeric(12, 2) not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists vendor_items_tenant on public.vendor_items (tenant_id);
create index if not exists vendor_items_vendor on public.vendor_items (vendor_id);

alter table public.vendor_items enable row level security;
drop policy if exists "tenant members read" on public.vendor_items;
create policy "tenant members read" on public.vendor_items for select using (tenant_id = public.current_tenant_id());
drop policy if exists "allowed roles write" on public.vendor_items;
-- The same people who keep the vendor list.
create policy "allowed roles write" on public.vendor_items
  for all using (tenant_id = public.current_tenant_id() and public.current_role_is('owner', 'store', 'accountant', 'operations'))
  with check (tenant_id = public.current_tenant_id());
