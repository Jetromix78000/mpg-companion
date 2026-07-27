-- Favoris joueurs. player_id reprend le slug utilisé côté app (ex: "mbappe").
-- player_name est un instantané dénormalisé : la liste reste lisible même si le
-- catalogue joueurs change de source.
create table if not exists public.favorites (
  user_id     uuid        not null references auth.users (id) on delete cascade,
  player_id   text        not null,
  player_name text        not null,
  created_at  timestamptz not null default now(),
  primary key (user_id, player_id)
);

create index if not exists favorites_user_id_created_at_idx
  on public.favorites (user_id, created_at desc);

alter table public.favorites enable row level security;

-- Chaque utilisateur ne voit et ne modifie que ses propres lignes.
-- auth.uid() provient du JWT porté par la requête, jamais du corps de celle-ci.
drop policy if exists "favorites_select_own" on public.favorites;
create policy "favorites_select_own"
  on public.favorites for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "favorites_insert_own" on public.favorites;
create policy "favorites_insert_own"
  on public.favorites for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "favorites_update_own" on public.favorites;
create policy "favorites_update_own"
  on public.favorites for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "favorites_delete_own" on public.favorites;
create policy "favorites_delete_own"
  on public.favorites for delete
  to authenticated
  using (auth.uid() = user_id);
