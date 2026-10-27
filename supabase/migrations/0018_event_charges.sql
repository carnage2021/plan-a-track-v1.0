-- Charges per event: service staff by role, cutlery by the piece, and other charges, each priced on its own event.
-- Run after 0017. Safe to run again.

-- Each event (function) of a quotation or booking carries its own charges:
-- [{ "id", "kind": "worker" | "cutlery" | "other", "ref": role name or cutlery item id, "label", "qty", "rate" }]
alter table public.event_functions add column if not exists charges jsonb not null default '[]'::jsonb;

-- What the client is charged per event for each staff role, e.g. [{ "name": "Waiter", "rate": 600 }].
-- Kept apart from the wages in Staff, so the margin stays the caterer's own.
alter table public.tenants add column if not exists staff_rates jsonb not null default '[]'::jsonb;

-- What the client is charged per piece of each cutlery item for one event.
alter table public.assets add column if not exists rent_rate numeric(12, 2) not null default 0;
