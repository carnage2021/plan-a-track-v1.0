-- Referral codes, per-order raw material changes and per-quotation dish prices. Run after 0013. Safe to run again.

-- Raw material for one order, changed by hand: { "<ingredient id>": quantity }. A quantity of 0 removes
-- the ingredient; an ingredient no recipe uses is added. Empty means the recipes decide.
alter table public.orders add column if not exists raw_overrides jsonb not null default '{}'::jsonb;

-- A dish's per-plate price on this quotation or order only, when it was changed from the menu price.
alter table public.function_items add column if not exists price_override numeric(10, 2);

-- Referrals: every client has a code to share; a new client can come in on someone's code; the referrer
-- earns credit once that booking is confirmed and spends it on a later quotation.
alter table public.clients add column if not exists referral_code text;
alter table public.clients add column if not exists referred_by uuid references public.clients (id) on delete set null;
alter table public.clients add column if not exists credit numeric(12, 2) not null default 0;
create unique index if not exists clients_referral_code_key on public.clients (tenant_id, upper(referral_code)) where referral_code is not null;

alter table public.quotations add column if not exists referral_code text;
alter table public.quotations add column if not exists credit_used numeric(12, 2) not null default 0;
alter table public.orders add column if not exists referral_code text;
alter table public.orders add column if not exists credit_used numeric(12, 2) not null default 0;
-- Set once the referrer has been credited for this booking, so it happens only once.
alter table public.orders add column if not exists referral_rewarded boolean not null default false;

-- The owner's offer: { "enabled": true, "type": "percent" | "amount", "value": 5, "max": 5000, "reward": 2000 }
alter table public.tenants add column if not exists referral_settings jsonb;

-- What a public menu link with ?ref=CODE may show: the offer and the referrer's first name, nothing else.
create or replace function public.public_referral(p_slug text, p_code text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object('name', split_part(c.name, ' ', 1), 'code', c.referral_code, 'offer', t.referral_settings - 'reward')
  from tenants t
  join clients c on c.tenant_id = t.id and upper(c.referral_code) = upper(p_code)
  where t.public_slug = lower(p_slug) and t.public_menu and coalesce((t.referral_settings ->> 'enabled')::boolean, false);
$$;
revoke all on function public.public_referral(text, text) from public;
grant execute on function public.public_referral(text, text) to anon, authenticated;

-- The public catalogue leaves out packages that were removed from offer.
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
      from packages p where p.tenant_id = t.id and not p.archived), '[]')
  )
  from tenants t
  where t.public_slug = lower(p_slug) and t.public_menu;
$$;
revoke all on function public.public_catalogue(text) from public;
grant execute on function public.public_catalogue(text) to anon, authenticated;
