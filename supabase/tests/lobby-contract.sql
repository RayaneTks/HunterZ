-- Transaction-scoped integration contract for the private GPS lobby.
-- Run only against the linked Hunt Supabase project with:
--   npx supabase@latest db query --linked -f supabase/tests/lobby-contract.sql
-- This script never applies migrations and explicitly rolls back all fixtures.

begin;
set local statement_timeout = '30s';
set local lock_timeout = '3s';

-- Exercise the migration without persisting it to the linked project. Keep this
-- CREATE OR REPLACE body byte-for-byte aligned with the forward migration above.
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

-- Fixed, distinct fixture identities let the post-rollback assertion prove
-- cleanup. Stop instead of risking collisions with any real account.
do $$
begin
  if exists (
    select 1 from auth.users
    where id in (
      'd7197a3a-0d0a-4dc0-9dc2-000000000001'::uuid,
      'd7197a3a-0d0a-4dc0-9dc2-000000000002'::uuid,
      'd7197a3a-0d0a-4dc0-9dc2-000000000003'::uuid,
      'd7197a3a-0d0a-4dc0-9dc2-000000000004'::uuid,
      'd7197a3a-0d0a-4dc0-9dc2-000000000005'::uuid
    )
  ) then
    raise exception 'Hunt contract fixture UUID already exists; refusing to continue';
  end if;
end;
$$;

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at)
values
  ('d7197a3a-0d0a-4dc0-9dc2-000000000001', 'authenticated', 'authenticated', 'hunt-contract-owner@example.invalid', '', now()),
  ('d7197a3a-0d0a-4dc0-9dc2-000000000002', 'authenticated', 'authenticated', 'hunt-contract-retry@example.invalid', '', now()),
  ('d7197a3a-0d0a-4dc0-9dc2-000000000003', 'authenticated', 'authenticated', 'hunt-contract-joiner@example.invalid', '', now()),
  ('d7197a3a-0d0a-4dc0-9dc2-000000000004', 'authenticated', 'authenticated', 'hunt-contract-outsider@example.invalid', '', now()),
  ('d7197a3a-0d0a-4dc0-9dc2-000000000005', 'authenticated', 'authenticated', 'hunt-contract-seed@example.invalid', '', now());

insert into public.profiles (id, nickname)
values
  ('d7197a3a-0d0a-4dc0-9dc2-000000000001', 'Contract Owner'),
  ('d7197a3a-0d0a-4dc0-9dc2-000000000002', 'Contract Retry'),
  ('d7197a3a-0d0a-4dc0-9dc2-000000000003', 'Contract Joiner'),
  ('d7197a3a-0d0a-4dc0-9dc2-000000000004', 'Contract Outsider'),
  ('d7197a3a-0d0a-4dc0-9dc2-000000000005', 'Contract Seed');

create temporary table hunt_contract_results (
  test_name text primary key,
  passed boolean not null,
  detail text not null
);
create temporary table hunt_contract_fixtures (
  fixture_name text primary key,
  room_id uuid,
  room_code text
);
create temporary sequence hunt_contract_collision_attempt_seq start with 1;
grant all on table pg_temp.hunt_contract_results, pg_temp.hunt_contract_fixtures to authenticated;
grant usage, select on sequence pg_temp.hunt_contract_collision_attempt_seq to authenticated;

create function pg_temp.hunt_contract_set_identity(p_user_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
begin
  perform pg_catalog.set_config('request.jwt.claim.sub', p_user_id::text, true);
  perform pg_catalog.set_config(
    'request.jwt.claims',
    pg_catalog.json_build_object('sub', p_user_id::text, 'role', 'authenticated')::text,
    true
  );
end;
$$;
grant execute on function pg_temp.hunt_contract_set_identity(uuid) to authenticated;

-- Reserve a code for a real unique-constraint collision, then force exactly
-- one create_room() insert to use it. Sequence increments survive a caught
-- unique_violation subtransaction, unlike ordinary table/GUC writes.
do $$
declare
  v_collision_code text;
  v_join_code text;
  v_join_room uuid := 'd7197a3a-0d0a-4dc0-9dc2-100000000001'::uuid;
begin
  loop
    v_collision_code := pg_catalog.upper(pg_catalog.substr(pg_catalog.replace(pg_catalog.gen_random_uuid()::text, '-', ''), 1, 6));
    exit when not exists (select 1 from public.rooms where code = v_collision_code);
  end loop;
  loop
    v_join_code := pg_catalog.upper(pg_catalog.substr(pg_catalog.replace(pg_catalog.gen_random_uuid()::text, '-', ''), 1, 6));
    exit when v_join_code <> v_collision_code
      and not exists (select 1 from public.rooms where code = v_join_code);
  end loop;

  insert into public.rooms (id, code, owner_id)
  values (v_join_room, v_join_code, 'd7197a3a-0d0a-4dc0-9dc2-000000000005');
  insert into public.room_members (room_id, user_id)
  values (v_join_room, 'd7197a3a-0d0a-4dc0-9dc2-000000000005');
  insert into public.positions (room_id, user_id, latitude, longitude, accuracy)
  values (v_join_room, 'd7197a3a-0d0a-4dc0-9dc2-000000000005', 43.2965, 5.3698, 4.5);
  insert into pg_temp.hunt_contract_fixtures (fixture_name, room_id, room_code)
  values ('join_room', v_join_room, v_join_code);

  insert into public.rooms (code, owner_id)
  values (v_collision_code, 'd7197a3a-0d0a-4dc0-9dc2-000000000005');
  insert into pg_temp.hunt_contract_fixtures (fixture_name, room_code)
  values ('collision', v_collision_code);
  perform pg_catalog.set_config('hunt.contract.collision_code', v_collision_code, true);
end;
$$;

create function public.hunt_contract_force_collision()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if pg_catalog.current_setting('hunt.contract.force_collision', true) = 'on'
     and pg_catalog.nextval('pg_temp.hunt_contract_collision_attempt_seq'::regclass) = 1 then
    new.code := pg_catalog.current_setting('hunt.contract.collision_code', true);
  end if;
  return new;
end;
$$;
create trigger hunt_contract_force_collision_before_insert
before insert on public.rooms
for each row execute function public.hunt_contract_force_collision();

set local role authenticated;

-- 1. Owner receives existing shape (room_id, room_code) and membership atomically.
select pg_temp.hunt_contract_set_identity('d7197a3a-0d0a-4dc0-9dc2-000000000001');
do $$
declare
  v_room_id uuid;
  v_room_code text;
begin
  begin
    select created.room_id, created.room_code into v_room_id, v_room_code
    from public.create_room() as created;
    if v_room_id is null or v_room_code !~ '^[A-Z0-9]{6}$' then
      raise exception 'create_room returned an invalid room id or six-character code';
    end if;
    if not exists (
      select 1 from public.room_members
      where room_id = v_room_id and user_id = auth.uid()
    ) then
      raise exception 'create_room did not add its caller as owner-member';
    end if;
    insert into pg_temp.hunt_contract_fixtures (fixture_name, room_id, room_code)
    values ('created_room', v_room_id, v_room_code);
    insert into pg_temp.hunt_contract_results values ('create_room_returns_code_and_adds_owner', true, 'returned six-character uppercase code and owner membership');
  exception when others then
    insert into pg_temp.hunt_contract_results values ('create_room_returns_code_and_adds_owner', false, sqlerrm);
  end;
end;
$$;

-- 2. One uniqueness collision must retry rather than fail the RPC.
select pg_catalog.set_config('hunt.contract.force_collision', 'on', true);
select pg_temp.hunt_contract_set_identity('d7197a3a-0d0a-4dc0-9dc2-000000000002');
do $$
declare
  v_room_id uuid;
  v_room_code text;
  v_attempts bigint;
begin
  begin
    select created.room_id, created.room_code into v_room_id, v_room_code
    from public.create_room() as created;
    select last_value into v_attempts from pg_temp.hunt_contract_collision_attempt_seq;
    if v_attempts <> 2 then
      raise exception 'expected one collision retry (2 inserts), observed %', v_attempts;
    end if;
    if v_room_code = (select room_code from pg_temp.hunt_contract_fixtures where fixture_name = 'collision') then
      raise exception 'create_room reused colliding code';
    end if;
    if not exists (
      select 1 from public.room_members
      where room_id = v_room_id and user_id = auth.uid()
    ) then
      raise exception 'retry did not add caller as owner-member';
    end if;
    insert into pg_temp.hunt_contract_results values ('create_room_retries_code_collision', true, 'first insert collided; second insert succeeded with owner membership');
  exception when others then
    insert into pg_temp.hunt_contract_results values ('create_room_retries_code_collision', false, sqlerrm);
  end;
end;
$$;
select pg_catalog.set_config('hunt.contract.force_collision', 'off', true);

-- 3. Joiner can join fixture room by its six-character code.
select pg_temp.hunt_contract_set_identity('d7197a3a-0d0a-4dc0-9dc2-000000000003');
do $$
declare
  v_room_id uuid := (select room_id from pg_temp.hunt_contract_fixtures where fixture_name = 'join_room');
  v_room_code text := (select room_code from pg_temp.hunt_contract_fixtures where fixture_name = 'join_room');
  v_returned_room uuid;
begin
  begin
    v_returned_room := public.join_room(v_room_code);
    if v_returned_room <> v_room_id or not exists (
      select 1 from public.room_members where room_id = v_room_id and user_id = auth.uid()
    ) then
      raise exception 'join_room did not add caller to requested room';
    end if;
    insert into pg_temp.hunt_contract_results values ('join_room_adds_second_member', true, 'join_room returned fixture id and inserted second member');
  exception when others then
    insert into pg_temp.hunt_contract_results values ('join_room_adds_second_member', false, sqlerrm);
  end;
end;
$$;

-- 4. Profile visibility is limited to self and members of the same active room.
select pg_temp.hunt_contract_set_identity('d7197a3a-0d0a-4dc0-9dc2-000000000003');
do $$
declare
  v_own_profiles bigint;
  v_squad_profiles bigint;
  v_outside_profiles bigint;
begin
  begin
    select count(*) into v_own_profiles from public.profiles where id = auth.uid();
    select count(*) into v_squad_profiles from public.profiles
      where id = 'd7197a3a-0d0a-4dc0-9dc2-000000000005'::uuid;
    select count(*) into v_outside_profiles from public.profiles
      where id in (
        'd7197a3a-0d0a-4dc0-9dc2-000000000001'::uuid,
        'd7197a3a-0d0a-4dc0-9dc2-000000000004'::uuid
      );
    if v_own_profiles <> 1 or v_squad_profiles <> 1 or v_outside_profiles <> 0 then
      raise exception 'unexpected profile visibility: own %, squad %, outside %',
        v_own_profiles, v_squad_profiles, v_outside_profiles;
    end if;
    insert into pg_temp.hunt_contract_results values ('profile_reads_limited_to_self_and_squad', true, 'self and squad visible; non-member profiles hidden');
  exception when others then
    insert into pg_temp.hunt_contract_results values ('profile_reads_limited_to_self_and_squad', false, sqlerrm);
  end;
end;
$$;

-- 5. Outsider must not see positions from another room.
select pg_temp.hunt_contract_set_identity('d7197a3a-0d0a-4dc0-9dc2-000000000004');
do $$
declare
  v_room_id uuid := (select room_id from pg_temp.hunt_contract_fixtures where fixture_name = 'join_room');
  v_visible_positions bigint;
begin
  begin
    select count(*) into v_visible_positions from public.positions where room_id = v_room_id;
    if v_visible_positions <> 0 then
      raise exception 'non-member saw % room positions', v_visible_positions;
    end if;
    insert into pg_temp.hunt_contract_results values ('non_member_cannot_read_room_positions', true, 'outsider saw zero positions');
  exception when others then
    insert into pg_temp.hunt_contract_results values ('non_member_cannot_read_room_positions', false, sqlerrm);
  end;
end;
$$;

reset role;
select test_name, passed, detail from pg_temp.hunt_contract_results order by test_name;
do $$
declare
  v_failures text;
begin
  select pg_catalog.string_agg(test_name || ': ' || detail, '; ' order by test_name)
  into v_failures
  from pg_temp.hunt_contract_results
  where not passed;
  if v_failures is not null then
    raise exception 'Hunt lobby contract failures: %', v_failures;
  end if;
  if (select count(*) from pg_temp.hunt_contract_results) <> 5 then
    raise exception 'Expected five contract assertions';
  end if;
end;
$$;

rollback;

-- This check runs only after the explicit rollback. If cleanup did not happen,
-- fail without deleting or repairing anything in the linked database.
do $$
begin
  if exists (
    select 1 from auth.users
    where id in (
      'd7197a3a-0d0a-4dc0-9dc2-000000000001'::uuid,
      'd7197a3a-0d0a-4dc0-9dc2-000000000002'::uuid,
      'd7197a3a-0d0a-4dc0-9dc2-000000000003'::uuid,
      'd7197a3a-0d0a-4dc0-9dc2-000000000004'::uuid,
      'd7197a3a-0d0a-4dc0-9dc2-000000000005'::uuid
    )
  ) or exists (
    select 1 from public.profiles
    where id in (
      'd7197a3a-0d0a-4dc0-9dc2-000000000001'::uuid,
      'd7197a3a-0d0a-4dc0-9dc2-000000000002'::uuid,
      'd7197a3a-0d0a-4dc0-9dc2-000000000003'::uuid,
      'd7197a3a-0d0a-4dc0-9dc2-000000000004'::uuid,
      'd7197a3a-0d0a-4dc0-9dc2-000000000005'::uuid
    )
  ) or exists (
    select 1 from public.rooms
    where owner_id in (
      'd7197a3a-0d0a-4dc0-9dc2-000000000001'::uuid,
      'd7197a3a-0d0a-4dc0-9dc2-000000000002'::uuid,
      'd7197a3a-0d0a-4dc0-9dc2-000000000003'::uuid,
      'd7197a3a-0d0a-4dc0-9dc2-000000000004'::uuid,
      'd7197a3a-0d0a-4dc0-9dc2-000000000005'::uuid
    )
  ) then
    raise exception 'Hunt contract rollback left fixture rows behind';
  end if;
  raise notice 'Hunt contract rollback verified: no fixture rows remain';
end;
$$;
