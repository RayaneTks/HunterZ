alter table public.rooms
  add column if not exists zone_center_lat double precision,
  add column if not exists zone_center_lng double precision,
  add column if not exists zone_radius_m integer;

alter table public.rooms
  drop constraint if exists rooms_zone_center_lat_range,
  add constraint rooms_zone_center_lat_range check (zone_center_lat is null or zone_center_lat between -90 and 90),
  drop constraint if exists rooms_zone_center_lng_range,
  add constraint rooms_zone_center_lng_range check (zone_center_lng is null or zone_center_lng between -180 and 180),
  drop constraint if exists rooms_zone_radius_allowed,
  add constraint rooms_zone_radius_allowed check (zone_radius_m is null or zone_radius_m in (250, 500, 800, 1200)),
  drop constraint if exists rooms_zone_complete,
  add constraint rooms_zone_complete check (
    (zone_center_lat is null and zone_center_lng is null and zone_radius_m is null)
    or (zone_center_lat is not null and zone_center_lng is not null and zone_radius_m is not null)
  );

create or replace function public.set_hunt_zone(
  p_room_id uuid,
  p_center_lat double precision default null,
  p_center_lng double precision default null,
  p_radius_m integer default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if p_room_id is null then
    raise exception 'A lobby is required' using errcode = '22023';
  end if;
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

revoke all on function public.set_hunt_zone(uuid, double precision, double precision, integer) from public;
grant execute on function public.set_hunt_zone(uuid, double precision, double precision, integer) to authenticated;

alter table public.rooms replica identity full;
do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'rooms'
  ) then
    alter publication supabase_realtime add table public.rooms;
  end if;
end;
$$;
