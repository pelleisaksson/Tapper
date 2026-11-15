-- Tapper: schema för synk. Kör en gång i Supabase → SQL Editor.
-- En generisk tabell där varje kund, projekt, tryck och inställning är en rad.
-- Radnivåsäkerhet (RLS) gör att varje användare bara ser sina egna rader.

create table if not exists public.items (
  user_id    uuid        not null default auth.uid() references auth.users on delete cascade,
  kind       text        not null check (kind in ('customer', 'project', 'tap', 'note', 'settings')),
  id         text        not null,
  data       jsonb,
  sort       integer     not null default 0,
  deleted    boolean     not null default false,
  updated_at timestamptz not null default clock_timestamp(),
  primary key (user_id, kind, id)
);

create index if not exists items_user_updated on public.items (user_id, updated_at);

alter table public.items enable row level security;

drop policy if exists "Egna rader" on public.items;
create policy "Egna rader" on public.items
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Servern sätter alltid tidsstämpeln, så att klientens klocka inte spelar roll.
create or replace function public.items_touch() returns trigger
language plpgsql as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end $$;

drop trigger if exists items_touch on public.items;
create trigger items_touch before insert or update on public.items
  for each row execute function public.items_touch();

-- Realtid: andra enheter får besked direkt när något ändras.
do $$ begin
  alter publication supabase_realtime add table public.items;
exception when duplicate_object then null;
end $$;
