-- Sample photos to show the client while choosing extras: staff uniforms (the dress, not the people), cutlery and
-- decoration setups. Added by import (a sheet with photo links) or in Settings. Run after 0020. Safe to run again.

create table if not exists public.sample_photos (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id) on delete cascade,
  kind text not null check (kind in ('staff', 'cutlery', 'decor')),
  name text not null,
  photo_url text not null,
  note text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists sample_photos_tenant_idx on public.sample_photos (tenant_id, kind);

alter table public.sample_photos enable row level security;
drop policy if exists "tenant members read" on public.sample_photos;
drop policy if exists "owner writes" on public.sample_photos;
create policy "tenant members read" on public.sample_photos for select using (tenant_id = public.current_tenant_id());
create policy "owner writes" on public.sample_photos for all
  using (tenant_id = public.current_tenant_id() and public.current_role_is('owner'))
  with check (tenant_id = public.current_tenant_id());
