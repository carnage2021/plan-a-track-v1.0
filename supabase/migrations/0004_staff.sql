-- Phase 4A: workers, task assignment with pricing, attendance, payouts and monthly payroll.
-- Mirrors the types in lib/staff.ts. Run once on top of 0001 to 0003.

create type public.worker_type as enum ('salaried', 'daily', 'contractor');
create type public.task_status as enum ('assigned', 'accepted', 'in_progress', 'done', 'verified');

create table public.workers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id) on delete cascade,
  name text not null,
  phone text not null default '',
  -- Category: Cook, Helper, Waiter, Counter staff, Cleaner, Supervisor, Driver, or the caterer's own.
  role text not null default 'Helper',
  worker_type public.worker_type not null default 'daily',
  -- Labour contractor (a vendor of type 'labour') who supplies this worker.
  contractor_id uuid references public.vendors (id) on delete set null,
  skills text[] not null default '{}',
  rate_day numeric(12, 2) not null default 0,
  rate_event numeric(12, 2) not null default 0,
  overtime_rate numeric(12, 2) not null default 0,
  monthly_salary numeric(12, 2) not null default 0,
  id_proof text not null default '',
  upi text not null default '',
  rating smallint not null default 0 check (rating between 0 and 5),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.worker_leaves (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id) on delete cascade,
  worker_id uuid not null references public.workers (id) on delete cascade,
  leave_date date not null,
  paid boolean not null default false,
  unique (worker_id, leave_date)
);

-- Every piece of work on an event: who, when and what it costs.
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id) on delete cascade,
  order_id uuid not null references public.orders (id) on delete cascade,
  function_id uuid references public.event_functions (id) on delete cascade,
  title text not null,
  role text not null default '',
  worker_id uuid references public.workers (id) on delete set null,
  -- Set when the task is a named chef cooking one dish.
  item_id uuid references public.menu_items (id) on delete set null,
  start_time text not null default '',
  due_time text not null default '',
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high')),
  status public.task_status not null default 'assigned',
  -- Amount is qty x rate, so quantity-based work (per 100 rotis, per counter) fits.
  qty numeric(10, 2) not null default 1,
  rate numeric(12, 2) not null default 0,
  overtime_hours numeric(6, 2) not null default 0,
  checked_in_at timestamptz,
  notes text not null default '',
  created_at timestamptz not null default now()
);

-- Money paid to a worker or contractor: an advance, a payout for tasks, or a salary.
create table public.worker_payments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id) on delete cascade,
  worker_id uuid references public.workers (id) on delete cascade,
  contractor_id uuid references public.vendors (id) on delete cascade,
  kind text not null default 'payout' check (kind in ('advance', 'payout', 'salary')),
  amount numeric(12, 2) not null check (amount > 0),
  mode public.payment_mode not null default 'cash',
  paid_on date not null default current_date,
  note text not null default '',
  created_at timestamptz not null default now(),
  constraint one_payee check (num_nonnulls(worker_id, contractor_id) = 1)
);

-- One slip per salaried worker per month.
create table public.salary_slips (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id) on delete cascade,
  worker_id uuid not null references public.workers (id) on delete cascade,
  month text not null check (month ~ '^\d{4}-\d{2}$'),
  base numeric(12, 2) not null default 0,
  unpaid_days numeric(5, 1) not null default 0,
  allowance numeric(12, 2) not null default 0,
  bonus numeric(12, 2) not null default 0,
  deduction numeric(12, 2) not null default 0,
  advance_recovery numeric(12, 2) not null default 0,
  net numeric(12, 2) not null default 0,
  paid_on date,
  created_at timestamptz not null default now(),
  unique (worker_id, month)
);

create index on public.workers (tenant_id);
create index on public.worker_leaves (tenant_id, worker_id);
create index on public.tasks (tenant_id, order_id);
create index on public.tasks (worker_id);
create index on public.worker_payments (tenant_id);
create index on public.salary_slips (tenant_id, month);

do $$
declare
  t text;
  rules constant jsonb := '{
    "workers": ["owner", "operations"],
    "worker_leaves": ["owner", "operations"],
    "tasks": ["owner", "operations", "kitchen"],
    "worker_payments": ["owner", "accountant"],
    "salary_slips": ["owner", "accountant"]
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
