-- Recipes page: every uploaded recipe is kept here, even for a dish that is not on the menu yet or that uses a raw
-- material not in the inventory yet. Each line keeps the name, quantity and unit as the sheet gave them; a line
-- whose raw material is in the inventory is matched to it (ingredientId, or the same name). Linked to a dish
-- (item_id), the recipe becomes that dish's recipe (recipe_lines) once all its raw materials are in.
-- Run after 0025. Safe to run again.

create table if not exists public.recipe_book (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id) on delete cascade,
  name text not null,
  item_id uuid references public.menu_items (id) on delete set null,
  recipe_base integer not null default 100 check (recipe_base > 0),
  buffer_pct numeric(5, 2) not null default 5,
  -- [{ "name": "Fine Besan", "qty": 500, "unit": "g", "ingredientId": "…" }]
  lines jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists recipe_book_tenant on public.recipe_book (tenant_id);
-- A dish has one recipe.
create unique index if not exists recipe_book_item on public.recipe_book (item_id) where item_id is not null;

alter table public.recipe_book enable row level security;
drop policy if exists "tenant members read" on public.recipe_book;
create policy "tenant members read" on public.recipe_book for select using (tenant_id = public.current_tenant_id());
drop policy if exists "allowed roles write" on public.recipe_book;
create policy "allowed roles write" on public.recipe_book
  for all using (tenant_id = public.current_tenant_id() and public.current_role_is('owner', 'store', 'kitchen', 'sales'))
  with check (tenant_id = public.current_tenant_id());
