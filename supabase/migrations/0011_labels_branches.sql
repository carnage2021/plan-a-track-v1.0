-- QR labels for cutlery, equipment and raw material, every scan made on them, and branches.
-- Run once on top of 0001 to 0010.

-- One printed label: a bunch (a crate of 50 plates, a 25 kg bag of rice) or a single piece.
create table public.stock_labels (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id) on delete cascade,
  -- Short code printed under the QR and typed in if a label is damaged, e.g. C-000042 or R-000107.
  code text not null,
  kind text not null check (kind in ('asset', 'ingredient')),
  asset_id uuid references public.assets (id) on delete cascade,
  ingredient_id uuid references public.ingredients (id) on delete cascade,
  -- Pieces in the bunch, or the bag's weight or volume in the ingredient's unit.
  qty numeric(12, 3) not null check (qty > 0),
  -- What is still in it; a bag partly issued to the kitchen keeps its label with less inside.
  remaining numeric(12, 3) not null,
  single boolean not null default false,
  status text not null default 'in_store' check (status in ('in_store', 'out', 'used', 'lost')),
  -- The cutlery challan a bunch is out on.
  challan_id uuid references public.challans (id) on delete set null,
  note text not null default '',
  last_scan_at timestamptz,
  created_at timestamptz not null default now(),
  unique (tenant_id, code),
  constraint one_item check ((kind = 'asset' and asset_id is not null) or (kind = 'ingredient' and ingredient_id is not null))
);

create table public.label_scans (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id) on delete cascade,
  label_id uuid not null references public.stock_labels (id) on delete cascade,
  action text not null check (action in ('load', 'return', 'receive', 'issue', 'count', 'lost')),
  qty numeric(12, 3) not null default 0,
  -- The challan, purchase order or order the scan was for.
  ref_id uuid,
  scanned_by uuid default auth.uid(),
  at timestamptz not null default now()
);

create index on public.stock_labels (tenant_id, status);
create index on public.label_scans (tenant_id, label_id);

alter table public.stock_labels enable row level security;
alter table public.label_scans enable row level security;
create policy "tenant members read" on public.stock_labels for select using (tenant_id = public.current_tenant_id());
create policy "tenant members read" on public.label_scans for select using (tenant_id = public.current_tenant_id());
create policy "store roles write" on public.stock_labels for all
  using (tenant_id = public.current_tenant_id() and public.current_role_is('owner', 'operations', 'store', 'kitchen'))
  with check (tenant_id = public.current_tenant_id());
create policy "store roles scan" on public.label_scans for all
  using (tenant_id = public.current_tenant_id() and public.current_role_is('owner', 'operations', 'store', 'kitchen'))
  with check (tenant_id = public.current_tenant_id());

-- Hands out a block of numbers at once, for printing a sheet of labels; returns the last number of the block.
create or replace function public.next_doc_numbers(p_doc_type text, p_financial_year text, p_count integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  if p_count < 1 or p_count > 500 then
    raise exception 'Between 1 and 500 numbers at a time';
  end if;
  insert into public.number_series (tenant_id, doc_type, financial_year, last_number)
  values (public.current_tenant_id(), p_doc_type, p_financial_year, p_count)
  on conflict (tenant_id, doc_type, financial_year)
  do update set last_number = public.number_series.last_number + p_count
  returning last_number into n;
  return n;
end;
$$;

-- Branches: which kitchen or office a record belongs to. Records with no branch (everything made before
-- branches were set up) show in every branch.
alter table public.enquiries add column branch_id uuid references public.branches (id) on delete set null;
alter table public.quotations add column branch_id uuid references public.branches (id) on delete set null;
alter table public.orders add column branch_id uuid references public.branches (id) on delete set null;
alter table public.stores add column branch_id uuid references public.branches (id) on delete set null;
alter table public.workers add column branch_id uuid references public.branches (id) on delete set null;
alter table public.vehicles add column branch_id uuid references public.branches (id) on delete set null;
create index on public.orders (tenant_id, branch_id);
create index on public.enquiries (tenant_id, branch_id);
