-- Phase 4B (rest): dispatch and transport, and the on-site event screen.
-- Run once on top of 0001 to 0005.

create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id) on delete cascade,
  name text not null,
  reg_number text not null default '',
  -- Own vehicle, or hired from a transport vendor.
  hired boolean not null default false,
  vendor_id uuid references public.vendors (id) on delete set null,
  capacity text not null default '',
  rate_per_trip numeric(12, 2) not null default 0,
  driver_name text not null default '',
  driver_phone text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- One vehicle run to one function: what is loaded, when it leaves, and proof it arrived.
create table public.trips (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id) on delete cascade,
  order_id uuid not null references public.orders (id) on delete cascade,
  function_id uuid not null references public.event_functions (id) on delete cascade,
  vehicle_id uuid references public.vehicles (id) on delete set null,
  driver_name text not null default '',
  driver_phone text not null default '',
  depart_time text not null default '',
  status text not null default 'planned' check (status in ('planned', 'loading', 'dispatched', 'delivered')),
  cost numeric(12, 2) not null default 0,
  -- [{ "label": "Food containers", "done": true }, ...]
  loading jsonb not null default '[]'::jsonb,
  proof_path text,
  delivered_at timestamptz,
  notes text not null default '',
  created_at timestamptz not null default now()
);

-- The supervisor's record of one function at the venue.
create table public.onsite (
  function_id uuid primary key references public.event_functions (id) on delete cascade,
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id) on delete cascade,
  order_id uuid not null references public.orders (id) on delete cascade,
  -- { "setup": "2026-10-20T17:05:00Z", "food": ..., "counters": ..., "service": ..., "cleanup": ... }
  checklist jsonb not null default '{}'::jsonb,
  guests integer not null default 0 check (guests >= 0),
  signoff_name text not null default '',
  signoff_path text,
  signed_at timestamptz,
  updated_at timestamptz not null default now()
);

create table public.onsite_issues (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id) on delete cascade,
  order_id uuid not null references public.orders (id) on delete cascade,
  function_id uuid not null references public.event_functions (id) on delete cascade,
  kind text not null default 'other' check (kind in ('short_item', 'late_vendor', 'complaint', 'equipment', 'other')),
  note text not null default '',
  photo_path text,
  resolved boolean not null default false,
  reported_by text not null default '',
  created_at timestamptz not null default now()
);

create index on public.vehicles (tenant_id);
create index on public.trips (tenant_id, function_id);
create index on public.onsite (tenant_id);
create index on public.onsite_issues (tenant_id, function_id);

do $$
declare
  t text;
  rules constant jsonb := '{
    "vehicles": ["owner", "operations", "store"],
    "trips": ["owner", "operations", "store", "kitchen"],
    "onsite": ["owner", "operations"],
    "onsite_issues": ["owner", "operations", "kitchen"]
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
