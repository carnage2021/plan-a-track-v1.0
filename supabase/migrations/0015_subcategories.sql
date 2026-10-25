-- Sub-categories: a menu category can sit inside another, to any depth (Main course > Sabji > Paneer sabji).
-- Run after 0014. Safe to run again.

alter table public.menu_categories add column if not exists parent_id uuid references public.menu_categories (id) on delete restrict;
create index if not exists menu_categories_parent_idx on public.menu_categories (parent_id);

-- The public catalogue sends each category's parent, so the public menu groups sub-categories under theirs.
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
    'packages', coalesce((select jsonb_agg(jsonb_build_object('name', p.name, 'description', p.description, 'minPax', p.min_pax,
        'price', case when t.public_prices then p.price_per_plate end) order by p.price_per_plate)
      from packages p where p.tenant_id = t.id and not p.archived), '[]')
  )
  from tenants t
  where t.public_slug = lower(p_slug) and t.public_menu;
$$;
revoke all on function public.public_catalogue(text) from public;
grant execute on function public.public_catalogue(text) to anon, authenticated;
