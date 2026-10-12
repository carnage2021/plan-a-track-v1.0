-- Phase 3: supply. Recipes and raw material, stock, vendors and purchase,
-- third-party food orders, and cutlery / equipment issue and return.
-- Mirrors lib/supply-types.ts. Safe to run once on top of 0001 and 0002.

create type public.vendor_type as enum ('raw_material', 'food_agency', 'rental', 'transport', 'labour', 'decor', 'hospitality');
create type public.movement_type as enum ('opening', 'purchase', 'issue', 'return', 'wastage', 'adjustment', 'transfer');
create type public.po_status as enum ('draft', 'sent', 'partial', 'received', 'cancelled');
create type public.outsource_status as enum ('draft', 'sent', 'accepted', 'preparing', 'dispatched', 'delivered', 'cancelled');
create type public.challan_status as enum ('draft', 'issued', 'returned');

create table public.vendors (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id) on delete cascade,
  name text not null,
  vendor_type public.vendor_type not null default 'raw_material',
  phone text not null default '',
  gstin text not null default '',
  payment_terms text not null default '',
  rating smallint not null default 0 check (rating between 0 and 5),
  notes text not null default '',
  created_at timestamptz not null default now()
);

-- Recipe settings and the mapped third-party agency live on the dish itself.
alter table public.menu_items
  add column recipe_base integer not null default 100 check (recipe_base > 0),
  add column buffer_pct numeric(5, 2) not null default 5,
  add column agency_id uuid references public.vendors (id) on delete set null,
  add column agency_rate numeric(12, 2) not null default 0;

-- When another agency books us as their caterer.
alter table public.orders add column commission_pct numeric(5, 2) not null default 0;

create table public.stores (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table public.ingredients (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id) on delete cascade,
  name text not null,
  unit text not null default 'kg',
  section text not null default 'grocery' check (section in ('grocery', 'vegetables', 'dairy', 'dry_fruits', 'other')),
  reorder_level numeric(12, 3) not null default 0,
  last_rate numeric(12, 2) not null default 0,
  location text not null default '',
  expires_on date,
  created_at timestamptz not null default now()
);

-- Quantity of an ingredient for menu_items.recipe_base guests.
create table public.recipe_lines (
  item_id uuid not null references public.menu_items (id) on delete cascade,
  ingredient_id uuid not null references public.ingredients (id) on delete cascade,
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id) on delete cascade,
  qty numeric(12, 3) not null check (qty > 0),
  primary key (item_id, ingredient_id)
);

create table public.vendor_rates (
  vendor_id uuid not null references public.vendors (id) on delete cascade,
  ingredient_id uuid not null references public.ingredients (id) on delete cascade,
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id) on delete cascade,
  rate numeric(12, 2) not null,
  primary key (vendor_id, ingredient_id)
);

create table public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id) on delete cascade,
  number text not null,
  vendor_id uuid not null references public.vendors (id) on delete restrict,
  order_id uuid references public.orders (id) on delete set null,
  status public.po_status not null default 'draft',
  expected_on date,
  deliver_time text not null default '',
  deliver_place text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now(),
  unique (tenant_id, number)
);

create table public.po_lines (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id) on delete cascade,
  po_id uuid not null references public.purchase_orders (id) on delete cascade,
  ingredient_id uuid not null references public.ingredients (id) on delete restrict,
  qty numeric(12, 3) not null,
  rate numeric(12, 2) not null default 0,
  -- Filled at goods received; null until then.
  received_qty numeric(12, 3),
  received_rate numeric(12, 2),
  deliver_on date,
  deliver_time text not null default '',
  deliver_place text not null default ''
);

-- Signed quantity: positive adds to the store, negative takes out. Stock is the sum.
create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id) on delete cascade,
  ingredient_id uuid not null references public.ingredients (id) on delete cascade,
  store_id uuid not null references public.stores (id) on delete cascade,
  movement public.movement_type not null,
  qty numeric(12, 3) not null,
  rate numeric(12, 2),
  note text not null default '',
  order_id uuid references public.orders (id) on delete set null,
  po_id uuid references public.purchase_orders (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.outsource_orders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id) on delete cascade,
  number text not null,
  order_id uuid not null references public.orders (id) on delete cascade,
  function_id uuid references public.event_functions (id) on delete cascade,
  vendor_id uuid not null references public.vendors (id) on delete restrict,
  status public.outsource_status not null default 'draft',
  deliver_on date,
  deliver_time text not null default '',
  deliver_place text not null default '',
  contact text not null default '',
  notes text not null default '',
  on_time boolean,
  issue text,
  created_at timestamptz not null default now(),
  unique (tenant_id, number)
);

create table public.outsource_lines (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id) on delete cascade,
  outsource_id uuid not null references public.outsource_orders (id) on delete cascade,
  item_id uuid not null references public.menu_items (id) on delete restrict,
  qty numeric(12, 2) not null,
  agency_rate numeric(12, 2) not null default 0,
  client_rate numeric(12, 2) not null default 0
);

create table public.vendor_bills (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id) on delete cascade,
  vendor_id uuid not null references public.vendors (id) on delete cascade,
  po_id uuid references public.purchase_orders (id) on delete set null,
  outsource_id uuid references public.outsource_orders (id) on delete set null,
  bill_no text not null default '',
  bill_date date not null default current_date,
  amount numeric(12, 2) not null check (amount > 0),
  note text not null default '',
  created_at timestamptz not null default now()
);

-- A payment with no bill yet is simply an advance; the ledger nets them.
create table public.vendor_payments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id) on delete cascade,
  vendor_id uuid not null references public.vendors (id) on delete cascade,
  amount numeric(12, 2) not null check (amount > 0),
  mode public.payment_mode not null default 'bank',
  paid_on date not null default current_date,
  note text not null default '',
  created_at timestamptz not null default now()
);

create table public.assets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id) on delete cascade,
  name text not null,
  category text not null default 'Crockery',
  total_qty integer not null default 0,
  replacement_cost numeric(12, 2) not null default 0,
  location text not null default '',
  -- How the requirement is worked out: per guest, per dish (optionally of one category), per function, or by hand.
  rule_basis text not null default 'manual' check (rule_basis in ('per_guest', 'per_dish', 'per_function', 'manual')),
  rule_value numeric(8, 3) not null default 0,
  rule_category_id uuid references public.menu_categories (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.challans (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id) on delete cascade,
  number text not null,
  order_id uuid not null references public.orders (id) on delete cascade,
  function_id uuid references public.event_functions (id) on delete cascade,
  status public.challan_status not null default 'draft',
  vehicle text not null default '',
  note text not null default '',
  breakage_charged boolean not null default false,
  issued_at timestamptz,
  returned_at timestamptz,
  created_at timestamptz not null default now(),
  unique (tenant_id, number)
);

create table public.challan_lines (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id) on delete cascade,
  challan_id uuid not null references public.challans (id) on delete cascade,
  asset_id uuid not null references public.assets (id) on delete restrict,
  required integer not null default 0,
  issued integer not null default 0,
  returned integer not null default 0,
  broken integer not null default 0,
  missing integer not null default 0,
  rented_qty integer not null default 0,
  rental_vendor_id uuid references public.vendors (id) on delete set null,
  rental_cost numeric(12, 2) not null default 0,
  rental_due date,
  deliver_time text not null default '',
  deliver_place text not null default ''
);

create index on public.vendors (tenant_id);
create index on public.ingredients (tenant_id);
create index on public.recipe_lines (tenant_id);
create index on public.stock_movements (tenant_id, ingredient_id);
create index on public.purchase_orders (tenant_id, status);
create index on public.po_lines (po_id);
create index on public.outsource_orders (tenant_id, order_id);
create index on public.outsource_lines (outsource_id);
create index on public.vendor_bills (tenant_id, vendor_id);
create index on public.vendor_payments (tenant_id, vendor_id);
create index on public.assets (tenant_id);
create index on public.challans (tenant_id, order_id);
create index on public.challan_lines (challan_id);

-- Tenant isolation on every table, then role limits on who may write.
do $$
declare
  t text;
  rules constant jsonb := '{
    "vendors": ["owner", "store", "accountant", "operations"],
    "stores": ["owner", "store"],
    "ingredients": ["owner", "store", "kitchen"],
    "recipe_lines": ["owner", "store", "kitchen", "sales"],
    "vendor_rates": ["owner", "store", "accountant"],
    "purchase_orders": ["owner", "store"],
    "po_lines": ["owner", "store"],
    "stock_movements": ["owner", "store", "kitchen", "operations"],
    "outsource_orders": ["owner", "store", "operations", "sales", "accountant"],
    "outsource_lines": ["owner", "store", "operations", "sales", "accountant"],
    "vendor_bills": ["owner", "store", "accountant"],
    "vendor_payments": ["owner", "accountant"],
    "assets": ["owner", "store", "operations"],
    "challans": ["owner", "store", "operations"],
    "challan_lines": ["owner", "store", "operations"]
  }';
  roles text;
begin
  for t in select jsonb_object_keys(rules) loop
    select string_agg(quote_literal(r), ', ') into roles from jsonb_array_elements_text(rules -> t) r;
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "tenant members read" on public.%I for select using (tenant_id = public.current_tenant_id())', t);
    execute format(
      'create policy "allowed roles write" on public.%I for all using (tenant_id = public.current_tenant_id() and public.current_role_is(%s)) with check (tenant_id = public.current_tenant_id())',
      t, roles
    );
  end loop;
end;
$$;

-- Store and operations staff add a breakage charge to an order from the return challan.
drop policy "allowed roles write" on public.extra_charges;
create policy "allowed roles write" on public.extra_charges
  for all using (tenant_id = public.current_tenant_id() and public.current_role_is('owner', 'sales', 'operations', 'store'))
  with check (tenant_id = public.current_tenant_id());
