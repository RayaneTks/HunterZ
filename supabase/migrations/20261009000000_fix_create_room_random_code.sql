-- Forward-only repair: keep create_room's signature, security, and grants intact
-- while replacing pgcrypto lookup under an intentionally empty search_path.
create or replace function public.create_room()
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
    generated_code := pg_catalog.upper(
      pg_catalog.substr(
        pg_catalog.replace(pg_catalog.gen_random_uuid()::text, '-', ''),
        1,
        6
      )
    );
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
