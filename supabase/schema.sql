-- HUNT V0.1 — run in Supabase SQL Editor after enabling Anonymous sign-ins.
-- No service_role key is needed by the browser.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nickname text not null check (char_length(nickname) between 2 and 24),
  created_at timestamptz not null default now()
);

create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  code text unique not null check (code ~ '^[A-Z0-9]{6}$'),
  owner_id uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  zone_center_lat double precision check (zone_center_lat is null or zone_center_lat between -90 and 90),
  zone_center_lng double precision check (zone_center_lng is null or zone_center_lng between -180 and 180),
  zone_radius_m integer check (zone_radius_m is null or zone_radius_m in (250, 500, 800, 1200)),
  check (
    (zone_center_lat is null and zone_center_lng is null and zone_radius_m is null)
    or (zone_center_lat is not null and zone_center_lng is not null and zone_radius_m is not null)
  )
);

create table if not exists public.room_members (
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

create table if not exists public.positions (
  room_id uuid not null,
  user_id uuid not null,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  accuracy double precision check (accuracy >= 0 and accuracy <= 100000),
  updated_at timestamptz not null default now(),
  primary key (room_id, user_id),
  foreign key (room_id, user_id) references public.room_members(room_id, user_id) on delete cascade
);

create index if not exists profiles_nickname_idx on public.profiles (lower(nickname));
create index if not exists room_members_user_idx on public.room_members (user_id);
create index if not exists positions_room_idx on public.positions (room_id);
create unique index if not exists one_active_room_per_user_idx on public.room_members (user_id);

-- Native background location uploads authenticate with the Supabase JWT and
-- derive identity and active lobby on the server, without trusting web payload IDs.
create or replace function public.publish_location(
  p_room_id uuid,
  p_latitude double precision,
  p_longitude double precision,
  p_accuracy double precision default null
)
returns void language plpgsql security definer set search_path = '' as $$
declare
  current_user_id uuid := (select auth.uid());
begin
  if current_user_id is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if p_latitude is null or p_longitude is null or p_latitude < -90 or p_latitude > 90 or p_longitude < -180 or p_longitude > 180 then
    raise exception 'Invalid location coordinates' using errcode = '22023';
  end if;
  if p_accuracy is not null and (p_accuracy < 0 or p_accuracy > 100000) then raise exception 'Invalid location accuracy' using errcode = '22023'; end if;
  if p_room_id is null or not exists (select 1 from public.room_members as membership where membership.room_id = p_room_id and membership.user_id = current_user_id) then
    raise exception 'Not a member of this hunt' using errcode = '42501';
  end if;
  insert into public.positions (room_id, user_id, latitude, longitude, accuracy, updated_at)
  values (p_room_id, current_user_id, p_latitude, p_longitude, p_accuracy, pg_catalog.now())
  on conflict (room_id, user_id) do update set latitude = excluded.latitude, longitude = excluded.longitude,
    accuracy = excluded.accuracy, updated_at = pg_catalog.now();
end;
$$;
revoke all on function public.publish_location(uuid, double precision, double precision, double precision) from public;
grant execute on function public.publish_location(uuid, double precision, double precision, double precision) to authenticated;

alter table public.profiles enable row level security;
alter table public.rooms enable row level security;
alter table public.room_members enable row level security;
alter table public.positions enable row level security;
alter table public.room_members replica identity full;
alter table public.positions replica identity full;

drop policy if exists profiles_read on public.profiles;
drop policy if exists profiles_insert on public.profiles;
drop policy if exists profiles_update on public.profiles;
drop policy if exists rooms_read on public.rooms;
drop policy if exists members_read on public.room_members;
drop policy if exists members_delete on public.room_members;
drop policy if exists positions_read on public.positions;
drop policy if exists positions_insert on public.positions;
drop policy if exists positions_update on public.positions;
drop policy if exists positions_delete on public.positions;

create or replace function public.can_read_profile(target_profile_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select target_profile_id = (select auth.uid()) or exists (
    select 1
    from public.room_members as viewer
    join public.room_members as target using (room_id)
    where viewer.user_id = (select auth.uid())
      and target.user_id = target_profile_id
  );
$$;
revoke all on function public.can_read_profile(uuid) from public;
grant execute on function public.can_read_profile(uuid) to authenticated;

create policy profiles_read on public.profiles for select to authenticated using (public.can_read_profile(id));
create policy profiles_insert on public.profiles for insert to authenticated with check (id = (select auth.uid()));
create policy profiles_update on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

create or replace function public.is_room_member(p_room uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.room_members
    where room_id = p_room and user_id = (select auth.uid())
  );
$$;
revoke all on function public.is_room_member(uuid) from public;
grant execute on function public.is_room_member(uuid) to authenticated;

create policy rooms_read on public.rooms for select to authenticated using (public.is_room_member(id));
create policy members_read on public.room_members for select to authenticated using (public.is_room_member(room_id));
create policy members_delete on public.room_members for delete to authenticated using (user_id = (select auth.uid()));
create policy positions_read on public.positions for select to authenticated using (public.is_room_member(room_id));
create policy positions_insert on public.positions for insert to authenticated with check (user_id = (select auth.uid()) and public.is_room_member(room_id));
create policy positions_update on public.positions for update to authenticated using (user_id = (select auth.uid()) and public.is_room_member(room_id)) with check (user_id = (select auth.uid()) and public.is_room_member(room_id));
create policy positions_delete on public.positions for delete to authenticated using (user_id = (select auth.uid()) and public.is_room_member(room_id));

grant select, insert, update on public.profiles to authenticated;
grant select on public.rooms to authenticated;
grant select, delete on public.room_members to authenticated;
grant select, insert, update, delete on public.positions to authenticated;

drop function if exists public.create_room();
drop function if exists public.join_room(text);
drop function if exists public.stop_sharing(uuid);
drop function if exists public.leave_room(uuid);
drop function if exists public.close_room(uuid);

create function public.create_room()
returns table(room_id uuid, room_code text)
language plpgsql security definer set search_path = '' as $$
declare
  rid uuid;
  generated_code text;
  attempt integer;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if exists (select 1 from public.room_members where user_id = (select auth.uid())) then
    raise exception 'Tu es déjà dans un lobby';
  end if;

  for attempt in 1..8 loop
    generated_code := pg_catalog.upper(pg_catalog.substr(pg_catalog.replace(pg_catalog.gen_random_uuid()::text, '-', ''), 1, 6));
    begin
      insert into public.rooms(code, owner_id) values (generated_code, (select auth.uid())) returning id into rid;
      exit;
    exception when unique_violation then
      rid := null;
    end;
  end loop;
  if rid is null then raise exception 'Impossible de générer un code de lobby'; end if;
  insert into public.room_members(room_id, user_id) values (rid, (select auth.uid()));
  return query select rid, generated_code;
end;
$$;

create function public.join_room(p_code text)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  rid uuid;
  normalized_code text := upper(trim(p_code));
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if normalized_code !~ '^[A-Z0-9]{6}$' then raise exception 'Code de lobby invalide'; end if;
  if exists (select 1 from public.room_members where user_id = (select auth.uid())) then
    raise exception 'Tu es déjà dans un lobby';
  end if;
  select id into rid from public.rooms where code = normalized_code;
  if rid is null then raise exception 'Lobby introuvable ou fermé'; end if;
  insert into public.room_members(room_id, user_id) values (rid, (select auth.uid()));
  return rid;
end;
$$;

create function public.stop_sharing(p_room uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  delete from public.positions where room_id = p_room and user_id = (select auth.uid());
end;
$$;

create function public.leave_room(p_room uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.room_members where room_id = p_room and user_id = (select auth.uid())) then
    raise exception 'Tu ne fais pas partie de ce lobby';
  end if;
  if exists (select 1 from public.rooms where id = p_room and owner_id = (select auth.uid())) then
    raise exception 'L’hôte doit fermer le lobby';
  end if;
  delete from public.positions where room_id = p_room and user_id = (select auth.uid());
  delete from public.room_members where room_id = p_room and user_id = (select auth.uid());
end;
$$;

create function public.close_room(p_room uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.rooms where id = p_room and owner_id = (select auth.uid())) then
    raise exception 'Seul l’hôte peut fermer ce lobby';
  end if;
  delete from public.rooms where id = p_room;
end;
$$;

create or replace function public.set_hunt_zone(
  p_room_id uuid,
  p_center_lat double precision default null,
  p_center_lng double precision default null,
  p_radius_m integer default null
)
returns void language plpgsql security definer set search_path = '' as $$
declare
  current_user_id uuid := (select auth.uid());
begin
  if current_user_id is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if p_room_id is null then raise exception 'A lobby is required' using errcode = '22023'; end if;
  if not exists (
    select 1 from public.rooms as room
    join public.room_members as member on member.room_id = room.id
    where room.id = p_room_id and room.owner_id = current_user_id and member.user_id = current_user_id
  ) then
    raise exception 'Seul l’hôte peut définir le terrain' using errcode = '42501';
  end if;
  if p_center_lat is null and p_center_lng is null and p_radius_m is null then
    update public.rooms set zone_center_lat = null, zone_center_lng = null, zone_radius_m = null where id = p_room_id;
    return;
  end if;
  if p_center_lat is null or p_center_lng is null or p_radius_m is null
     or p_center_lat < -90 or p_center_lat > 90
     or p_center_lng < -180 or p_center_lng > 180
     or p_radius_m not in (250, 500, 800, 1200) then
    raise exception 'Terrain invalide' using errcode = '22023';
  end if;
  update public.rooms
  set zone_center_lat = p_center_lat, zone_center_lng = p_center_lng, zone_radius_m = p_radius_m
  where id = p_room_id;
end;
$$;

revoke all on function public.create_room() from public;
revoke all on function public.join_room(text) from public;
revoke all on function public.stop_sharing(uuid) from public;
revoke all on function public.leave_room(uuid) from public;
revoke all on function public.close_room(uuid) from public;
revoke all on function public.set_hunt_zone(uuid, double precision, double precision, integer) from public;
grant execute on function public.create_room() to authenticated;
grant execute on function public.join_room(text) to authenticated;
grant execute on function public.stop_sharing(uuid) to authenticated;
grant execute on function public.leave_room(uuid) to authenticated;
grant execute on function public.close_room(uuid) to authenticated;
grant execute on function public.set_hunt_zone(uuid, double precision, double precision, integer) to authenticated;

do $$ begin
  alter publication supabase_realtime add table public.room_members;
exception when duplicate_object then null;
end $$;
do $$ begin
  alter publication supabase_realtime add table public.positions;
exception when duplicate_object then null;
end $$;
do $$ begin
  alter publication supabase_realtime add table public.rooms;
exception when duplicate_object then null;
end $$;
