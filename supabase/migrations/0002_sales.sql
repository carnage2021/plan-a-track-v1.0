-- Phase 2: the sales chain. Enquiry -> Quotation (versions) -> Order -> Event functions.
-- Mirrors lib/types.ts, which the app's demo store uses today.

create type public.diet as enum ('veg', 'jain', 'nonveg');
create type public.pricing_type as enum ('plate', 'counter', 'flat');
create type public.enquiry_stage as enum ('new', 'contacted', 'quoted', 'followup', 'booked', 'lost');
create type public.lead_source as enum ('website', 'whatsapp', 'phone', 'walkin', 'referral');
create type public.quote_status as enum ('draft', 'pending_approval', 'sent', 'approved', 'changes', 'rejected', 'superseded');
create type public.order_status as enum ('tentative', 'confirmed', 'in_progress', 'completed', 'cancelled');
create type public.payment_mode as enum ('cash', 'upi', 'bank', 'cheque', 'online');

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id) on delete cascade,
  name text not null,
  phone text not null default '',
  email text,
  address text,
  gstin text,
  client_type text not null default 'retail' check (client_type in ('retail', 'corporate', 'agency')),
  tags text[] not null default '{}',
  language text not null default 'en' check (language in ('en', 'hi', 'gu')),
  created_at timestamptz not null default now()
);

create table public.menu_categories (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id) on delete cascade,
  name text not null,
  icon text not null default 'Utensils',
  sort_order integer not null default 0
);

create table public.menu_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id) on delete cascade,
  category_id uuid not null references public.menu_categories (id) on delete restrict,
  name text not null,
  name_local text not null default '',
  diet public.diet not null default 'veg',
  cuisine text not null default '',
  spice smallint not null default 1 check (spice between 0 and 3),
  unit text not null default 'plate',
  pricing_type public.pricing_type not null default 'plate',
  cost numeric(12, 2) not null default 0,
  price numeric(12, 2) not null default 0,
  -- Storage paths in the media bucket; the first is the cover. At most five.
  photo_paths text[] not null default '{}' check (cardinality(photo_paths) <= 5),
  description text not null default '',
  active boolean not null default true,
  outsourced boolean not null default false,
  seasonal boolean not null default false,
  bestseller boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.packages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id) on delete cascade,
  name text not null,
  tier text not null default 'custom',
  price_per_plate numeric(12, 2) not null,
  min_pax integer not null default 0,
  description text not null default '',
  fixed_item_ids uuid[] not null default '{}'
);

-- "Choose any N" from a category.
create table public.package_rules (
  package_id uuid not null references public.packages (id) on delete cascade,
  category_id uuid not null references public.menu_categories (id) on delete cascade,
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id) on delete cascade,
  choose integer not null check (choose > 0),
  primary key (package_id, category_id)
);

create table public.enquiries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  event_type text not null,
  event_date date not null,
  venue text not null default '',
  pax integer not null default 0,
  budget_per_plate numeric(12, 2) not null default 0,
  food_pref public.diet not null default 'veg',
  notes text not null default '',
  source public.lead_source not null default 'phone',
  stage public.enquiry_stage not null default 'new',
  assigned_to uuid references public.profiles (id) on delete set null,
  follow_up_at date,
  lost_reason text,
  created_at timestamptz not null default now(),
  -- A lead cannot be closed as lost without a reason.
  constraint lost_needs_reason check (stage <> 'lost' or coalesce(lost_reason, '') <> '')
);

create table public.quotations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id) on delete cascade,
  number text not null,
  -- Shared by every version of the same quotation.
  group_id uuid not null,
  version integer not null default 1,
  client_id uuid not null references public.clients (id) on delete restrict,
  enquiry_id uuid references public.enquiries (id) on delete set null,
  event_type text not null,
  discount_type text not null default 'amount' check (discount_type in ('amount', 'percent')),
  discount_value numeric(12, 2) not null default 0,
  gst_rate numeric(5, 2) not null,
  gst_inclusive boolean not null default false,
  status public.quote_status not null default 'draft',
  valid_until date,
  notes text not null default '',
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (tenant_id, number, version)
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id) on delete cascade,
  number text not null,
  quotation_id uuid references public.quotations (id) on delete set null,
  client_id uuid not null references public.clients (id) on delete restrict,
  event_type text not null,
  discount_type text not null default 'amount' check (discount_type in ('amount', 'percent')),
  discount_value numeric(12, 2) not null default 0,
  gst_rate numeric(5, 2) not null,
  gst_inclusive boolean not null default false,
  status public.order_status not null default 'tentative',
  instructions text not null default '',
  manager_id uuid references public.profiles (id) on delete set null,
  cancel_note text,
  created_at timestamptz not null default now(),
  unique (tenant_id, number)
);

-- A function (Haldi, Wedding, Reception) belongs to exactly one quotation version or one order.
create table public.event_functions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id) on delete cascade,
  quotation_id uuid references public.quotations (id) on delete cascade,
  order_id uuid references public.orders (id) on delete cascade,
  name text not null,
  event_date date not null,
  serving_time time not null default '19:00',
  venue text not null default '',
  pax integer not null check (pax >= 0),
  package_id uuid references public.packages (id) on delete set null,
  sort_order integer not null default 0,
  constraint one_parent check (num_nonnulls(quotation_id, order_id) = 1)
);

create table public.function_items (
  function_id uuid not null references public.event_functions (id) on delete cascade,
  item_id uuid not null references public.menu_items (id) on delete restrict,
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id) on delete cascade,
  note text not null default '',
  -- Selection order matters: the first picks in a category are the ones the package covers.
  sort_order integer not null default 0,
  primary key (function_id, item_id)
);

create table public.extra_charges (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id) on delete cascade,
  quotation_id uuid references public.quotations (id) on delete cascade,
  order_id uuid references public.orders (id) on delete cascade,
  label text not null,
  amount numeric(12, 2) not null,
  constraint one_parent check (num_nonnulls(quotation_id, order_id) = 1)
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id) on delete cascade,
  order_id uuid not null references public.orders (id) on delete restrict,
  receipt_no text not null,
  amount numeric(12, 2) not null check (amount > 0),
  mode public.payment_mode not null,
  paid_on date not null default current_date,
  note text,
  recorded_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (tenant_id, receipt_no)
);

-- Change requests after confirmation: who, when and the price impact.
create table public.order_changes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id) on delete cascade,
  order_id uuid not null references public.orders (id) on delete cascade,
  description text not null,
  price_impact numeric(12, 2) not null default 0,
  changed_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index on public.clients (tenant_id);
create index on public.menu_categories (tenant_id);
create index on public.menu_items (tenant_id, category_id);
create index on public.packages (tenant_id);
create index on public.enquiries (tenant_id, stage);
create index on public.quotations (tenant_id, group_id);
create index on public.orders (tenant_id, status);
create index on public.event_functions (tenant_id, event_date);
create index on public.event_functions (quotation_id);
create index on public.event_functions (order_id);
create index on public.payments (order_id);

-- Guests booked per day, for the clash and capacity warning.
create view public.daily_load with (security_invoker = true) as
select f.tenant_id, f.event_date, sum(f.pax) as pax
from public.event_functions f
join public.orders o on o.id = f.order_id
where o.status <> 'cancelled'
group by f.tenant_id, f.event_date;

-- Tenant isolation on every table, then role limits on who may write.
do $$
declare
  t text;
  -- table name, roles allowed to insert / update / delete
  rules constant jsonb := '{
    "clients": ["owner", "sales"],
    "menu_categories": ["owner", "sales"],
    "menu_items": ["owner", "sales", "kitchen"],
    "packages": ["owner", "sales"],
    "package_rules": ["owner", "sales"],
    "enquiries": ["owner", "sales"],
    "quotations": ["owner", "sales"],
    "orders": ["owner", "sales", "operations"],
    "event_functions": ["owner", "sales", "operations"],
    "function_items": ["owner", "sales", "operations"],
    "extra_charges": ["owner", "sales"],
    "payments": ["owner", "sales", "accountant"],
    "order_changes": ["owner", "sales", "operations"]
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
