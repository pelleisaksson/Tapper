-- Tapper: tillåt kommentarer (kind = 'note') i en databas som skapades före november 2026.
-- Kör en gång i Supabase → SQL Editor. Det är ofarligt att köra flera gånger.
alter table public.items drop constraint if exists items_kind_check;
alter table public.items add constraint items_kind_check
  check (kind in ('customer', 'project', 'tap', 'note', 'settings'));
