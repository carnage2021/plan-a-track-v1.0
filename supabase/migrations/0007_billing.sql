-- Phase 5A: client billing (plan E1). Payment schedule per order, proforma and GST invoices,
-- credit notes and refunds. Payments themselves are already in 0002. Run once on top of 0001 to 0006.

-- Milestones of an order's payment schedule. An order with none uses the default split in the app.
create table public.payment_milestones (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id) on delete cascade,
  order_id uuid not null references public.orders (id) on delete cascade,
  position integer not null default 0,
  label text not null,
  -- Percentage of the order total, or a fixed amount.
  kind text not null default 'percent' check (kind in ('percent', 'amount')),
  value numeric(12, 2) not null check (value >= 0),
  due_date date not null,
  reminded_at timestamptz,
  created_at timestamptz not null default now()
);

-- Invoices keep a frozen copy of their lines and totals, so later order changes never alter an issued invoice.
create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id) on delete cascade,
  order_id uuid not null references public.orders (id) on delete restrict,
  number text not null,
  kind text not null check (kind in ('proforma', 'tax')),
  issued_on date not null default current_date,
  -- { "lines": [{ "label", "qty", "rate", "amount" }], "taxable", "cgst", "sgst", "igst", "total", "client": {...} }
  snapshot jsonb not null,
  total numeric(12, 2) not null,
  created_at timestamptz not null default now(),
  unique (tenant_id, number)
);

-- Money taken off what the client owes (cancellation, fewer guests, goodwill), and any part of it paid back.
create table public.credit_notes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id) on delete cascade,
  order_id uuid not null references public.orders (id) on delete restrict,
  number text not null,
  reason text not null,
  amount numeric(12, 2) not null check (amount > 0),
  refund_amount numeric(12, 2) not null default 0 check (refund_amount >= 0),
  refund_mode public.payment_mode,
  issued_on date not null default current_date,
  created_at timestamptz not null default now(),
  unique (tenant_id, number)
);

create index on public.payment_milestones (tenant_id, order_id);
create index on public.invoices (tenant_id, order_id);
create index on public.credit_notes (tenant_id, order_id);

do $$
declare
  t text;
begin
  foreach t in array array['payment_milestones', 'invoices', 'credit_notes'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "tenant members read" on public.%I for select using (tenant_id = public.current_tenant_id())', t);
    execute format(
      'create policy "billing roles write" on public.%I for all using (tenant_id = public.current_tenant_id() and public.current_role_is(''owner'', ''sales'', ''accountant'')) with check (tenant_id = public.current_tenant_id())',
      t
    );
  end loop;
end;
$$;
