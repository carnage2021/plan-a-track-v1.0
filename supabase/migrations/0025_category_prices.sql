-- One price per plate for a whole menu category on one booking.
-- In Step 3 each category (Welcome drinks, Starters, Breads ...) shows its dishes under it and one price box that
-- starts at the total of their menu prices. A price typed there is kept here, by top-level category id, and replaces
-- the dishes' own prices for that event. The main course keeps its own rate (main_rate, 0022).
-- Run after 0024. Safe to run again.

alter table public.event_functions add column if not exists category_prices jsonb;
