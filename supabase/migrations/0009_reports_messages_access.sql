-- Phase 6: messages and greetings (plan F2) and access control and the activity log (plan F3).
-- Reports (F1) need no new tables. Run once on top of 0001 to 0008.

alter table public.clients
  add column birthday date,
  add column anniversary date;

-- The caterer's own wording for each kind of message; the app falls back to its defaults.
create table public.message_templates (
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id) on delete cascade,
  key text not null,
  body text not null,
  updated_at timestamptz not null default now(),
  primary key (tenant_id, key)
);

-- Every message sent from the app, to whom and when.
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id) on delete cascade,
  channel text not null default 'whatsapp' check (channel in ('whatsapp', 'sms', 'email')),
  template_key text not null default 'custom',
  recipient_name text not null default '',
  recipient_phone text not null default '',
  body text not null,
  order_id uuid references public.orders (id) on delete set null,
  -- 'opened' means WhatsApp was opened with the message ready; the API statuses come with a WhatsApp provider.
  status text not null default 'opened' check (status in ('opened', 'sent', 'delivered', 'failed')),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index on public.messages (tenant_id, created_at desc);

-- What each role may open, and whether it sees prices and margins: { "sales": { "modules": ["menu", ...], "hidePrices": false } }.
-- A role with no entry keeps the built-in access. The database rules in each migration still apply underneath.
alter table public.tenants add column role_access jsonb not null default '{}'::jsonb;

-- Activity log: written by the database itself, so no change can skip it.
create table public.activity_log (
  id bigint generated always as identity primary key,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  table_name text not null,
  row_id text,
  action text not null check (action in ('insert', 'update', 'delete')),
  summary text not null default '',
  actor uuid,
  at timestamptz not null default now()
);
create index on public.activity_log (tenant_id, at desc);

create or replace function public.log_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  r jsonb := to_jsonb(coalesce(new, old));
begin
  -- Deleting a whole caterer account cascades through every table; there is nothing left to log against.
  if not exists (select 1 from tenants where id = (r ->> 'tenant_id')::uuid) then
    return null;
  end if;
  insert into activity_log (tenant_id, table_name, row_id, action, summary, actor)
  values (
    (r ->> 'tenant_id')::uuid,
    tg_table_name,
    coalesce(r ->> 'id', r ->> 'function_id'),
    lower(tg_op),
    -- The most human field the row has: its document number, name, receipt or label.
    coalesce(r ->> 'number', r ->> 'receipt_no', r ->> 'name', r ->> 'label', r ->> 'title', r ->> 'reason', ''),
    auth.uid()
  );
  return null;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array['clients', 'enquiries', 'quotations', 'orders', 'event_functions', 'payments', 'extra_charges', 'menu_items', 'packages',
    'vendors', 'purchase_orders', 'vendor_bills', 'vendor_payments', 'workers', 'tasks', 'worker_payments', 'invoices', 'credit_notes', 'expenses', 'petty_cash'] loop
    execute format('create trigger log_activity after insert or update or delete on public.%I for each row execute function public.log_activity()', t);
  end loop;
end;
$$;

alter table public.message_templates enable row level security;
alter table public.messages enable row level security;
alter table public.activity_log enable row level security;
create policy "tenant members read" on public.message_templates for select using (tenant_id = public.current_tenant_id());
create policy "owner writes" on public.message_templates for all
  using (tenant_id = public.current_tenant_id() and public.current_role_is('owner'))
  with check (tenant_id = public.current_tenant_id());
create policy "tenant members read" on public.messages for select using (tenant_id = public.current_tenant_id());
create policy "tenant members log" on public.messages for insert with check (tenant_id = public.current_tenant_id());
-- Only the owner reads the activity log; nobody writes to it directly.
create policy "owner reads" on public.activity_log for select using (tenant_id = public.current_tenant_id() and public.current_role_is('owner'));
