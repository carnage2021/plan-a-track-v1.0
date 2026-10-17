-- Phase 4B (part): kitchen production. Where each dish of each function stands in the kitchen,
-- and what was left over afterwards, which feeds future quantity planning. Run once on top of 0001 to 0004.

create table public.kitchen_items (
  function_id uuid not null references public.event_functions (id) on delete cascade,
  item_id uuid not null references public.menu_items (id) on delete cascade,
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'prep', 'cooking', 'ready', 'packed')),
  -- Plates' worth left at the end of the function.
  leftover numeric(10, 1) not null default 0 check (leftover >= 0),
  updated_at timestamptz not null default now(),
  primary key (function_id, item_id)
);

create index on public.kitchen_items (tenant_id);

alter table public.kitchen_items enable row level security;
create policy "tenant members read" on public.kitchen_items for select using (tenant_id = public.current_tenant_id());
create policy "allowed roles write" on public.kitchen_items
  for all using (tenant_id = public.current_tenant_id() and public.current_role_is('owner', 'operations', 'kitchen'))
  with check (tenant_id = public.current_tenant_id());
