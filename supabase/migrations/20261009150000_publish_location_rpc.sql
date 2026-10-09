-- Location writes are bound to the authenticated member of the requested room.
create or replace function public.publish_location(
  p_room_id uuid,
  p_latitude double precision,
  p_longitude double precision,
  p_accuracy double precision default null
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
  if p_latitude is null or p_longitude is null
     or p_latitude < -90 or p_latitude > 90
     or p_longitude < -180 or p_longitude > 180 then
    raise exception 'Invalid location coordinates' using errcode = '22023';
  end if;
  if p_accuracy is not null and (p_accuracy < 0 or p_accuracy > 100000) then
    raise exception 'Invalid location accuracy' using errcode = '22023';
  end if;
  if p_room_id is null or not exists (
    select 1 from public.room_members as membership
    where membership.room_id = p_room_id and membership.user_id = current_user_id
  ) then
    raise exception 'Not a member of this hunt' using errcode = '42501';
  end if;
  insert into public.positions (room_id, user_id, latitude, longitude, accuracy, updated_at)
  values (p_room_id, current_user_id, p_latitude, p_longitude, p_accuracy, pg_catalog.now())
  on conflict (room_id, user_id) do update set
    latitude = excluded.latitude,
    longitude = excluded.longitude,
    accuracy = excluded.accuracy,
    updated_at = pg_catalog.now();
end;
$$;

revoke all on function public.publish_location(uuid, double precision, double precision, double precision) from public;
grant execute on function public.publish_location(uuid, double precision, double precision, double precision) to authenticated;
