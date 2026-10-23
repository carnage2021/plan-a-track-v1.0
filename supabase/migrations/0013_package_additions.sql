-- Packages: special additions and removing a package. Run after 0012. Safe to run again.

-- Extra lines a package includes beyond the dish choices, such as a paan counter or 2 farsan:
-- [{ "id": "...", "name": "Paan counter", "count": 0 }]
alter table public.packages add column if not exists additions jsonb not null default '[]'::jsonb;

-- A package already used on a quotation or order is archived rather than deleted, so those keep their price.
alter table public.packages add column if not exists archived boolean not null default false;
