-- Package suggestions on the public menu: dishes the caterer picks to show what a package can hold (a Basic
-- package's "Starters 1" with Paneer Tikka and Hara Bhara Kabab as ideas). Only the public menu shows them; they do
-- not change what a booking includes or costs.
-- The public catalogue now also sends each package's courses ("Starters 2"), its extra lines and these suggestions.
-- Run after 0028. Safe to run again.

alter table public.packages add column if not exists public_suggestions uuid[] not null default '{}';

create or replace function public.public_catalogue(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'tenant', jsonb_build_object('name', t.name, 'tagline', t.tagline, 'city', t.city, 'phone', t.phone, 'logo', t.logo_path, 'brand', t.brand_color, 'prices', t.public_prices),
    'categories', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'parent', c.parent_id) order by c.sort_order) from menu_categories c where c.tenant_id = t.id), '[]'),
    'items', coalesce((select jsonb_agg(jsonb_build_object(
        'id', i.id, 'category', i.category_id, 'name', i.name, 'local', i.name_local, 'diet', i.diet, 'description', i.description,
        'photo', i.photo_paths[1], 'bestseller', i.bestseller, 'unit', i.pricing_type,
        'price', case when t.public_prices then i.price end) order by i.name)
      from menu_items i where i.tenant_id = t.id and i.active), '[]'),
    'packages', coalesce((select jsonb_agg(jsonb_build_object(
        'id', p.id, 'name', p.name, 'description', p.description, 'minPax', p.min_pax,
        'price', case when t.public_prices then p.price_per_plate end,
        'choices', coalesce((select jsonb_agg(jsonb_build_object('category', r.category_id, 'choose', r.choose)) from package_rules r where r.package_id = p.id), '[]'),
        'additions', coalesce(p.additions, '[]'),
        'suggested', coalesce((select jsonb_agg(s.id order by s.ord) from unnest(p.public_suggestions) with ordinality as s(id, ord)
          where exists (select 1 from menu_items i where i.id = s.id and i.active)), '[]')
      ) order by p.price_per_plate)
      from packages p where p.tenant_id = t.id and not p.archived), '[]')
  )
  from tenants t
  where t.public_slug = lower(p_slug) and t.public_menu;
$$;
revoke all on function public.public_catalogue(text) from public;
grant execute on function public.public_catalogue(text) to anon, authenticated;
