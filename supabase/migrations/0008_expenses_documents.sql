-- Phase 5B: event expenses, petty cash, document settings and the public menu pages (plan E2, E3).
-- Run once on top of 0001 to 0007.

-- Money spent for an event or the business: gas, ice, tips, local transport and the like.
create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id) on delete cascade,
  number text not null,
  order_id uuid references public.orders (id) on delete set null,
  category text not null default 'misc' check (category in ('gas', 'ice', 'transport', 'tips', 'labour', 'rent', 'utilities', 'misc')),
  amount numeric(12, 2) not null check (amount > 0),
  mode public.payment_mode not null default 'cash',
  -- Set when it was paid out of a team member's petty cash (their team user id).
  petty_holder text,
  paid_to text not null default '',
  note text not null default '',
  photo_path text,
  spent_on date not null default current_date,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (tenant_id, number)
);

-- Cash handed to a manager for small expenses, and what they hand back.
create table public.petty_cash (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id) on delete cascade,
  holder text not null,
  kind text not null check (kind in ('issue', 'return')),
  amount numeric(12, 2) not null check (amount > 0),
  on_date date not null default current_date,
  note text not null default '',
  created_at timestamptz not null default now()
);

alter table public.tenants
  -- { "theme": "classic", "footer": "...", "showBank": true, "showUpiQr": true, "signaturePath": "..." }
  add column doc_settings jsonb not null default '{}'::jsonb,
  add column public_slug text unique check (public_slug ~ '^[a-z0-9][a-z0-9-]{2,39}$'),
  add column public_menu boolean not null default false,
  add column public_prices boolean not null default false;

create index on public.expenses (tenant_id, spent_on);
create index on public.petty_cash (tenant_id, holder);

alter table public.expenses enable row level security;
alter table public.petty_cash enable row level security;
create policy "tenant members read" on public.expenses for select using (tenant_id = public.current_tenant_id());
create policy "tenant members read" on public.petty_cash for select using (tenant_id = public.current_tenant_id());
create policy "allowed roles write" on public.expenses for all
  using (tenant_id = public.current_tenant_id() and public.current_role_is('owner', 'operations', 'accountant'))
  with check (tenant_id = public.current_tenant_id());
create policy "allowed roles write" on public.petty_cash for all
  using (tenant_id = public.current_tenant_id() and public.current_role_is('owner', 'accountant'))
  with check (tenant_id = public.current_tenant_id());

-- The public catalogue: only for a caterer who switched it on, and prices only if they chose to show them.
create or replace function public.public_catalogue(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'tenant', jsonb_build_object('name', t.name, 'tagline', t.tagline, 'city', t.city, 'phone', t.phone, 'logo', t.logo_path, 'brand', t.brand_color, 'prices', t.public_prices),
    'categories', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name) order by c.sort_order) from menu_categories c where c.tenant_id = t.id), '[]'),
    'items', coalesce((select jsonb_agg(jsonb_build_object(
        'id', i.id, 'category', i.category_id, 'name', i.name, 'local', i.name_local, 'diet', i.diet, 'description', i.description,
        'photo', i.photo_paths[1], 'bestseller', i.bestseller, 'unit', i.pricing_type,
        'price', case when t.public_prices then i.price end) order by i.name)
      from menu_items i where i.tenant_id = t.id and i.active), '[]'),
    'packages', coalesce((select jsonb_agg(jsonb_build_object('name', p.name, 'description', p.description, 'minPax', p.min_pax,
        'price', case when t.public_prices then p.price_per_plate end) order by p.price_per_plate)
      from packages p where p.tenant_id = t.id), '[]')
  )
  from tenants t
  where t.public_slug = lower(p_slug) and t.public_menu;
$$;

-- The table menu for one function, reached from its QR code. The function id is the secret in the link,
-- so no client name, venue or price is ever returned.
create or replace function public.public_event_menu(p_function uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'tenant', jsonb_build_object('name', t.name, 'tagline', t.tagline, 'phone', t.phone, 'logo', t.logo_path, 'brand', t.brand_color),
    'function', jsonb_build_object('name', f.name, 'date', f.event_date, 'eventType', o.event_type),
    'categories', coalesce((select jsonb_agg(distinct jsonb_build_object('id', c.id, 'name', c.name, 'sort', c.sort_order))
      from function_items fi join menu_items i on i.id = fi.item_id join menu_categories c on c.id = i.category_id where fi.function_id = f.id), '[]'),
    'items', coalesce((select jsonb_agg(jsonb_build_object('id', i.id, 'category', i.category_id, 'name', i.name, 'local', i.name_local, 'diet', i.diet,
        'description', i.description, 'photo', i.photo_paths[1], 'note', fi.note) order by fi.sort_order)
      from function_items fi join menu_items i on i.id = fi.item_id where fi.function_id = f.id), '[]')
  )
  from event_functions f
  join orders o on o.id = f.order_id
  join tenants t on t.id = f.tenant_id
  where f.id = p_function and o.status <> 'cancelled';
$$;

revoke all on function public.public_catalogue(text) from public;
revoke all on function public.public_event_menu(uuid) from public;
grant execute on function public.public_catalogue(text) to anon, authenticated;
grant execute on function public.public_event_menu(uuid) to anon, authenticated;

-- Records a payment that Razorpay confirmed by webhook. Only the server (service role) may call it.
-- Safe to call twice for the same Razorpay payment: the second call does nothing.
create or replace function public.record_online_payment(p_tenant uuid, p_order uuid, p_amount numeric, p_ref text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  fy text;
  n integer;
  receipt text;
begin
  if exists (select 1 from payments where tenant_id = p_tenant and note = 'Razorpay ' || p_ref) then
    return null;
  end if;
  if not exists (select 1 from orders where id = p_order and tenant_id = p_tenant) then
    raise exception 'Order % not found for this caterer', p_order;
  end if;
  -- Indian financial year, April to March: 26-27.
  fy := case when extract(month from current_date) >= 4
    then to_char(current_date, 'YY') || '-' || to_char(current_date + interval '1 year', 'YY')
    else to_char(current_date - interval '1 year', 'YY') || '-' || to_char(current_date, 'YY') end;
  insert into number_series (tenant_id, doc_type, financial_year, last_number)
  values (p_tenant, 'receipt', fy, 1)
  on conflict (tenant_id, doc_type, financial_year) do update set last_number = number_series.last_number + 1
  returning last_number into n;
  receipt := 'RCT/' || fy || '/' || lpad(n::text, 4, '0');
  insert into payments (tenant_id, order_id, receipt_no, amount, mode, note)
  values (p_tenant, p_order, receipt, p_amount, 'online', 'Razorpay ' || p_ref);
  update orders set status = 'confirmed' where id = p_order and status = 'tentative';
  return receipt;
end;
$$;

revoke all on function public.record_online_payment(uuid, uuid, numeric, text) from public, anon, authenticated;
grant execute on function public.record_online_payment(uuid, uuid, numeric, text) to service_role;
