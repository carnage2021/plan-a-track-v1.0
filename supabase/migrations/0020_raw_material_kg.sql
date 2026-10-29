-- Raw materials are kept in kg (weight) and litres (liquid), never grams or ml.
-- Every raw material saved in g or ml becomes kg or l: its rates are multiplied by 1000 and every quantity
-- (recipes, stock, purchase orders, labels, per-order changes) divided by 1000, so nothing changes in value.
-- Run after 0019. Safe to run again: the raw material's own unit is changed last, so a second run finds nothing
-- left in g or ml and changes nothing. No temporary tables, so it runs as is in the Supabase SQL editor.

-- Small amounts (2.5 g of saffron = 0.0025 kg) need more than three decimal places.
alter table public.ingredients alter column reorder_level type numeric(14, 6);
alter table public.recipe_lines alter column qty type numeric(14, 6);
alter table public.po_lines alter column qty type numeric(14, 6);
alter table public.po_lines alter column received_qty type numeric(14, 6);
alter table public.stock_movements alter column qty type numeric(14, 6);
alter table public.stock_labels alter column qty type numeric(14, 6);
alter table public.stock_labels alter column remaining type numeric(14, 6);

-- The raw materials still in g or ml (the same test in every statement below).
create or replace function public.pat_small_unit(u text) returns boolean language sql immutable as $$
  select lower(trim(coalesce(u, ''))) in ('g', 'gm', 'gms', 'gram', 'grams', 'gr', 'ml', 'millilitre', 'milliliter')
$$;

update public.recipe_lines set qty = qty / 1000
  where ingredient_id in (select id from public.ingredients where public.pat_small_unit(unit));
update public.vendor_rates set rate = rate * 1000
  where ingredient_id in (select id from public.ingredients where public.pat_small_unit(unit));
update public.po_lines set qty = qty / 1000, received_qty = received_qty / 1000, rate = rate * 1000, received_rate = received_rate * 1000
  where ingredient_id in (select id from public.ingredients where public.pat_small_unit(unit));
update public.stock_movements set qty = qty / 1000, rate = rate * 1000
  where ingredient_id in (select id from public.ingredients where public.pat_small_unit(unit));
update public.stock_labels set qty = qty / 1000, remaining = remaining / 1000
  where ingredient_id in (select id from public.ingredients where public.pat_small_unit(unit));

-- Per-order raw material changes are kept as { ingredient id: quantity }.
update public.orders o set raw_overrides = (
  select coalesce(jsonb_object_agg(e.key, case when i.id is not null then to_jsonb(round((e.value #>> '{}')::numeric / 1000, 6)) else e.value end), '{}'::jsonb)
  from jsonb_each(o.raw_overrides) e
  left join public.ingredients i on i.id::text = e.key and public.pat_small_unit(i.unit)
)
where o.raw_overrides <> '{}'::jsonb
  and exists (select 1 from jsonb_object_keys(o.raw_overrides) k join public.ingredients i on i.id::text = k where public.pat_small_unit(i.unit));

-- Last: the raw material itself, so every statement above still found it in g or ml.
update public.ingredients
  set unit = case when lower(trim(unit)) in ('ml', 'millilitre', 'milliliter') then 'l' else 'kg' end,
      last_rate = last_rate * 1000,
      reorder_level = reorder_level / 1000
  where public.pat_small_unit(unit);

drop function public.pat_small_unit(text);
