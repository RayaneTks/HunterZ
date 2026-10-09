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

-- La Piste atomic migration
-- La Piste: atomic server authority. Deploy as one migration before enabling the UI.
create table public.hunt_matches (
 id uuid primary key default gen_random_uuid(), room_id uuid not null references public.rooms(id) on delete cascade,
 target_id uuid not null references public.profiles(id), state text not null check(state in ('briefing','running','paused','finished','cancelled')),
 revision integer not null default 1, terrain jsonb not null, roster jsonb not null,
 elapsed_seconds double precision not null default 0, segment_started_at timestamptz,
 pause_reason text, clue jsonb, clue_slot integer not null default 0, capture jsonb, result jsonb,
 created_at timestamptz not null default now()
);
create unique index one_live_match_per_room on public.hunt_matches(room_id) where state in ('briefing','running','paused');
create table public.match_players (
 match_id uuid references public.hunt_matches(id) on delete cascade, user_id uuid references public.profiles(id), ready boolean not null default false,
 primary key(match_id,user_id)
);
create table public.match_positions (
 match_id uuid not null, user_id uuid not null, latitude double precision not null, longitude double precision not null,
 accuracy double precision, updated_at timestamptz not null, last_good_at timestamptz, extraction_since timestamptz, extraction_confirmed boolean not null default false,
 primary key(match_id,user_id), foreign key(match_id,user_id) references public.match_players(match_id,user_id) on delete cascade
);
create table public.match_actions (
 user_id uuid not null references public.profiles(id), action_id uuid not null, match_id uuid references public.hunt_matches(id) on delete cascade,
 action text not null, request_payload jsonb not null, primary key(user_id,action_id)
);
alter table public.hunt_matches enable row level security;
alter table public.match_players enable row level security;
alter table public.match_positions enable row level security;
alter table public.match_actions enable row level security;
revoke all on public.hunt_matches, public.match_players, public.match_positions, public.match_actions from anon, authenticated;

create or replace function public.has_live_match(p_room uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.hunt_matches where room_id=p_room and state in ('briefing','running','paused'));
$$;
create or replace function public.can_read_match_position(p_match uuid,p_user uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.hunt_matches m join public.room_members r on r.room_id=m.room_id and r.user_id=auth.uid()
 where m.id=p_match and m.state in ('briefing','running','paused') and (p_user=auth.uid() or (m.target_id<>auth.uid() and p_user<>m.target_id)));
$$;
create policy private_match_positions_read on public.match_positions for select to authenticated using(public.can_read_match_position(match_id,user_id));
grant select on public.match_positions to authenticated;
drop policy if exists positions_read on public.positions;
drop policy if exists positions_insert on public.positions;
drop policy if exists positions_update on public.positions;
create policy positions_read on public.positions for select to authenticated using(public.is_room_member(room_id) and not public.has_live_match(room_id));
create policy positions_insert on public.positions for insert to authenticated with check(user_id=auth.uid() and public.is_room_member(room_id) and not public.has_live_match(room_id));
create policy positions_update on public.positions for update to authenticated using(user_id=auth.uid() and public.is_room_member(room_id) and not public.has_live_match(room_id)) with check(user_id=auth.uid() and public.is_room_member(room_id) and not public.has_live_match(room_id));

create function public.match_elapsed(p_match public.hunt_matches) returns double precision language sql stable set search_path='' as $$
 select p_match.elapsed_seconds + case when p_match.state='running' then greatest(0,extract(epoch from now()-p_match.segment_started_at)) else 0 end;
$$;
create function public.match_finish(p_match uuid,p_winner text,p_reason text) returns void language plpgsql security definer set search_path='' as $$
begin
 update public.hunt_matches set state='finished', result=jsonb_build_object('winner',p_winner,'reason',p_reason,'duration',least(900,public.match_elapsed(hunt_matches))),
 elapsed_seconds=least(900,public.match_elapsed(hunt_matches)), segment_started_at=null, clue=null,capture=null,revision=revision+1 where id=p_match and state in ('running','paused');
 delete from public.match_positions where match_id=p_match;
end; $$;
create function public.match_tick(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare m public.hunt_matches; pos public.match_positions; elapsed double precision; slot integer; x double precision; y double precision; origin_lat double precision; origin_lng double precision; scale_x double precision;
begin
 select * into m from public.hunt_matches where id=p_id for update;
 if m.state<>'running' then return; end if;
 elapsed:=public.match_elapsed(m);
 select * into pos from public.match_positions where match_id=m.id and user_id=m.target_id;
 if pos.last_good_at is null or now()-pos.last_good_at>=interval '90 seconds' then
  elapsed:=greatest(m.elapsed_seconds,elapsed-greatest(0,extract(epoch from now()-coalesce(pos.last_good_at,m.segment_started_at)-interval '90 seconds')));
  if elapsed<900 then
   update public.hunt_matches set state='paused',pause_reason='Signal de la cible perdu',elapsed_seconds=elapsed,segment_started_at=null,revision=revision+1 where id=m.id;return;
  end if;
 end if;
 if elapsed>=900 then perform public.match_finish(m.id,'hunters','timeout');return;end if;
 slot:=floor((elapsed-30)/90);
 if slot>m.clue_slot and slot>0 and now()-pos.updated_at<=interval '45 seconds' and pos.accuracy<=30 then
  origin_lat:=(m.terrain->>'latitude')::double precision;origin_lng:=(m.terrain->>'longitude')::double precision;
  scale_x:=111320*cos(radians(origin_lat));
  x:=(pos.longitude-origin_lng)*scale_x;y:=(pos.latitude-origin_lat)*111320;
  update public.hunt_matches set clue=jsonb_build_object('cellSize',200,'west',origin_lng+floor((x-pos.accuracy)/200)*200/scale_x,
   'east',origin_lng+(floor((x+pos.accuracy)/200)+1)*200/scale_x,'south',origin_lat+floor((y-pos.accuracy)/200)*200/111320,
   'north',origin_lat+(floor((y+pos.accuracy)/200)+1)*200/111320,'generatedAt',now()),clue_slot=slot,revision=revision+1 where id=m.id;
 end if;
end; $$;

create function public.get_match(p_room uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare m public.hunt_matches; elapsed double precision; projected jsonb;
begin
 if not public.is_room_member(p_room) then raise exception 'Salon privé' using errcode='42501';end if;
 select * into m from public.hunt_matches where room_id=p_room order by created_at desc,id desc limit 1 for update;
 if m.id is null then return null;end if;
 perform public.match_tick(m.id);select * into m from public.hunt_matches where id=m.id;
 elapsed:=public.match_elapsed(m);
 select coalesce(jsonb_agg(jsonb_build_object('user_id',p.user_id,'nickname',pr.nickname,'role',case when p.user_id=m.target_id then 'target' else 'hunter' end,'ready',p.ready,
 'gpsReady',coalesce(loc.updated_at>=now()-interval '45 seconds' and loc.accuracy<=30,false)) order by p.user_id),'[]') into projected
 from public.match_players p join public.profiles pr on pr.id=p.user_id left join public.match_positions loc on loc.match_id=p.match_id and loc.user_id=p.user_id where p.match_id=m.id;
 return jsonb_build_object('id',m.id,'roomId',m.room_id,'revision',m.revision,'state',m.state,'role',case when auth.uid()=m.target_id then 'target' else 'hunter' end,
 'roster',projected,'terrain',m.terrain,'serverNow',now(),'elapsedSeconds',elapsed,'remainingSeconds',greatest(0,900-elapsed),'pauseReason',m.pause_reason,'result',m.result,
 'clue',case when auth.uid()<>m.target_id and m.clue is not null then m.clue||jsonb_build_object('ageBucket',case when now()-(m.clue->>'generatedAt')::timestamptz<interval '90 seconds' then 'recent' else 'old' end) else null end,
 'capture',case when m.capture is not null and (m.capture->>'expiresAt')::timestamptz>now() then m.capture else null end,
 'locations',(select coalesce(jsonb_agg(jsonb_build_object('user_id',p.user_id,'latitude',p.latitude,'longitude',p.longitude,'accuracy',p.accuracy,'updated_at',p.updated_at,'nickname',pr.nickname)),'[]')
 from public.match_positions p join public.profiles pr on pr.id=p.user_id where p.match_id=m.id and p.updated_at>=now()-interval '45 seconds' and (p.user_id=auth.uid() or (auth.uid()<>m.target_id and p.user_id<>m.target_id))));
end; $$;

create function public.hunt_match_action(p_room uuid,p_action text,p_target uuid default null,p_ready boolean default null,p_request uuid default null,p_action_id uuid default null,p_match_id uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare m public.hunt_matches; r public.rooms; uid uuid:=auth.uid(); count_players integer; previous_action public.match_actions; capture_id uuid; payload jsonb:=jsonb_build_object('matchId',p_match_id,'target',p_target,'ready',p_ready,'request',p_request);
begin
 if uid is null or not public.is_room_member(p_room) then raise exception 'Salon privé' using errcode='42501';end if;
 if p_action_id is null then raise exception 'Identifiant action requis';end if;
 select * into r from public.rooms where id=p_room for update;
 select * into previous_action from public.match_actions where user_id=uid and action_id=p_action_id;
 if previous_action.action_id is not null then
  if previous_action.action<>p_action or previous_action.request_payload<>payload or not exists(select 1 from public.hunt_matches where id=previous_action.match_id and room_id=p_room) then raise exception 'Action déjà utilisée';end if;
  return public.get_match(p_room);
 end if;
 select * into m from public.hunt_matches where room_id=p_room order by created_at desc,id desc limit 1 for update;
 if p_action='create' then
  if uid<>r.owner_id then raise exception 'Seul l’hôte choisit la manche';end if;
  if m.state in ('briefing','running','paused') then raise exception 'Une manche est déjà en cours';end if;
  select count(*) into count_players from public.room_members where room_id=p_room;
  if count_players<4 or count_players>10 then raise exception 'La Piste se joue à 4–10 joueurs';end if;
  if r.zone_radius_m is null or abs(r.zone_center_lat)>85 then raise exception 'Définis un terrain entre -85° et 85° de latitude';end if;
  if p_target is null or not exists(select 1 from public.room_members where room_id=p_room and user_id=p_target) then raise exception 'Choisis une cible présente';end if;
  insert into public.hunt_matches(room_id,target_id,state,terrain,roster) values(p_room,p_target,'briefing',
   jsonb_build_object('latitude',r.zone_center_lat,'longitude',r.zone_center_lng,'radius_m',r.zone_radius_m,'extractionLatitude',r.zone_center_lat,'extractionLongitude',r.zone_center_lng),
   (select jsonb_agg(user_id order by user_id) from public.room_members where room_id=p_room)) returning * into m;
  insert into public.match_players(match_id,user_id) select m.id,user_id from public.room_members where room_id=p_room;
  delete from public.positions where room_id=p_room;
 else
  if m.id is null then raise exception 'Aucune manche';end if;
  if p_match_id is null or p_match_id<>m.id then raise exception 'Manche remplacée. Consulte le nouveau briefing.';end if;
  perform public.match_tick(m.id);select * into m from public.hunt_matches where id=m.id;
  if m.state in ('finished','cancelled') then raise exception 'Manche terminée';end if;
  if p_action='ready' then
   if m.state<>'briefing' then raise exception 'Briefing terminé';end if;
   if p_ready is null then raise exception 'Confirmation requise';end if;
   update public.match_players set ready=p_ready where match_id=m.id and user_id=uid;
  elsif p_action in ('start','pause','resume','cancel') then
   if uid<>r.owner_id then raise exception 'Seul l’hôte contrôle la manche';end if;
   if p_action in ('start','resume') then
    if (p_action='start' and m.state<>'briefing') or (p_action='resume' and m.state<>'paused') then raise exception 'Transition indisponible';end if;
    if exists(select 1 from public.match_players p left join public.match_positions pos on pos.match_id=p.match_id and pos.user_id=p.user_id where p.match_id=m.id and (not p.ready or pos.updated_at is null or pos.updated_at<now()-interval '45 seconds' or pos.accuracy is null or pos.accuracy>30)) then raise exception 'Tous doivent être prêts avec un GPS récent et précis';end if;
    update public.hunt_matches set state='running',segment_started_at=now(),pause_reason=null where id=m.id;
   elsif p_action='pause' then
    if m.state<>'running' then raise exception 'Transition indisponible';end if;
    update public.hunt_matches set state='paused',elapsed_seconds=public.match_elapsed(m),segment_started_at=null,pause_reason='Pause de l’équipe' where id=m.id;
   else
    update public.hunt_matches set state='cancelled',segment_started_at=null,clue=null,capture=null where id=m.id;
    delete from public.match_positions where match_id=m.id;
   end if;
  elsif p_action in ('capture','confirm','extract') then
   if m.state<>'running' or public.match_elapsed(m)<30 then raise exception 'Attends la fin de l’avance';end if;
   if not exists(select 1 from public.match_positions where match_id=m.id and user_id=uid and updated_at>=now()-interval '45 seconds' and accuracy<=30) then raise exception 'GPS récent et précis requis';end if;
   if p_action='capture' then
    if uid=m.target_id then raise exception 'Seuls les chasseurs demandent une interception';end if;
    if m.capture is not null and (m.capture->>'expiresAt')::timestamptz>now() then raise exception 'Une rencontre attend déjà confirmation';end if;
    capture_id:=gen_random_uuid();update public.hunt_matches set capture=jsonb_build_object('id',capture_id,'hunterId',uid,'expiresAt',now()+interval '30 seconds') where id=m.id;
   elsif p_action='confirm' then
    if uid<>m.target_id then raise exception 'Seule la cible confirme la rencontre';end if;
    if p_request is null or m.capture is null or (m.capture->>'id')::uuid<>p_request or (m.capture->>'expiresAt')::timestamptz<=now() then raise exception 'Rencontre expirée';end if;
    perform public.match_finish(m.id,'hunters','interception');
   else
    if uid<>m.target_id then raise exception 'Seule la cible peut s’extraire';end if;
    if public.match_elapsed(m)<600 then raise exception 'Extraction après dix minutes';end if;
    if not exists(select 1 from public.match_positions where match_id=m.id and user_id=uid and extraction_confirmed and updated_at>=now()-interval '45 seconds') then raise exception 'Reste dans le cercle au moins cinq secondes avec un GPS précis';end if;
    perform public.match_finish(m.id,'target','extraction');
   end if;
  else raise exception 'Action inconnue';end if;
  update public.hunt_matches set revision=revision+1 where id=m.id;
 end if;
 insert into public.match_actions(user_id,action_id,match_id,action,request_payload) values(uid,p_action_id,m.id,p_action,payload);
 return public.get_match(p_room);
end; $$;

create or replace function public.publish_location(p_room_id uuid,p_latitude double precision,p_longitude double precision,p_accuracy double precision default null)
returns void language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid();m public.hunt_matches; previous public.match_positions; inside_extraction boolean; distance_m double precision;
begin
 if uid is null or not public.is_room_member(p_room_id) then raise exception 'Not a member of this hunt' using errcode='42501';end if;
 if p_latitude is null or p_longitude is null or p_latitude not between -90 and 90 or p_longitude not between -180 and 180 or (p_accuracy is not null and p_accuracy not between 0 and 100000) then raise exception 'Invalid location coordinates';end if;
 -- Lock same room as match creation; no write can slip into public table during briefing.
 perform 1 from public.rooms where id=p_room_id for update;
 select * into m from public.hunt_matches where room_id=p_room_id and state in ('briefing','running','paused') for update;
 if m.id is null then
  if exists(select 1 from public.hunt_matches where room_id=p_room_id) then return;end if;
  insert into public.positions values(p_room_id,uid,p_latitude,p_longitude,p_accuracy,now()) on conflict(room_id,user_id) do update set latitude=excluded.latitude,longitude=excluded.longitude,accuracy=excluded.accuracy,updated_at=now();return;
 end if;
 perform public.match_tick(m.id);select * into m from public.hunt_matches where id=m.id;
 if m.state not in ('briefing','running','paused') then return;end if;
 select * into previous from public.match_positions where match_id=m.id and user_id=uid;
 distance_m:=6371000*2*asin(least(1,sqrt(power(sin(radians(p_latitude-(m.terrain->>'extractionLatitude')::double precision)/2),2)+cos(radians(p_latitude))*cos(radians((m.terrain->>'extractionLatitude')::double precision))*power(sin(radians(p_longitude-(m.terrain->>'extractionLongitude')::double precision)/2),2))));
 inside_extraction:=uid=m.target_id and m.state='running' and public.match_elapsed(m)>=600 and p_accuracy<=30 and distance_m+p_accuracy<=50;
 insert into public.match_positions(match_id,user_id,latitude,longitude,accuracy,updated_at,last_good_at,extraction_since,extraction_confirmed)
 values(m.id,uid,p_latitude,p_longitude,p_accuracy,now(),case when p_accuracy<=30 then now() else previous.last_good_at end,case when inside_extraction then coalesce(previous.extraction_since,now()) else null end,
 coalesce(inside_extraction and previous.extraction_since is not null and now()-previous.extraction_since>=interval '5 seconds' and now()-previous.updated_at<=interval '45 seconds',false))
 on conflict(match_id,user_id) do update set latitude=excluded.latitude,longitude=excluded.longitude,accuracy=excluded.accuracy,updated_at=excluded.updated_at,last_good_at=excluded.last_good_at,extraction_since=excluded.extraction_since,extraction_confirmed=excluded.extraction_confirmed;
end; $$;
create or replace function public.stop_sharing(p_room uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 delete from public.positions where room_id=p_room and user_id=auth.uid();
 update public.hunt_matches set state='paused',elapsed_seconds=public.match_elapsed(hunt_matches),segment_started_at=null,pause_reason='Balise de la cible arrêtée',revision=revision+1 where room_id=p_room and target_id=auth.uid() and state='running';
 delete from public.match_positions where user_id=auth.uid() and match_id in(select id from public.hunt_matches where room_id=p_room);
 update public.match_players set ready=false where user_id=auth.uid() and match_id in(select id from public.hunt_matches where room_id=p_room and state='briefing');
end; $$;
create function public.guard_match_roster() returns trigger language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.rooms where id=case when tg_op='DELETE' then old.room_id else new.room_id end for update;
 if tg_op='INSERT' and public.has_live_match(new.room_id) then raise exception 'Une manche est en cours. Attends la prochaine.';end if;
 if tg_op='DELETE' then
  update public.hunt_matches set state='cancelled',clue=null,capture=null,segment_started_at=null,pause_reason='L’escouade a changé',revision=revision+1 where room_id=old.room_id and state in ('briefing','running','paused');
  delete from public.match_positions where match_id in(select id from public.hunt_matches where room_id=old.room_id);
 end if;
 return coalesce(new,old);
end; $$;
create trigger match_roster_guard before insert or delete on public.room_members for each row execute function public.guard_match_roster();
create function public.guard_match_terrain() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if public.has_live_match(old.id) and (new.zone_center_lat,new.zone_center_lng,new.zone_radius_m) is distinct from (old.zone_center_lat,old.zone_center_lng,old.zone_radius_m) then raise exception 'Terrain figé pendant la manche';end if;
 return new;
end; $$;
create trigger match_terrain_guard before update on public.rooms for each row execute function public.guard_match_terrain();
-- Private helpers are not PostgREST APIs.
revoke all on function public.has_live_match(uuid), public.can_read_match_position(uuid,uuid), public.match_elapsed(public.hunt_matches), public.match_finish(uuid,text,text),public.match_tick(uuid),public.guard_match_roster(),public.guard_match_terrain(),public.get_match(uuid),public.hunt_match_action(uuid,text,uuid,boolean,uuid,uuid,uuid) from public;
grant execute on function public.has_live_match(uuid),public.can_read_match_position(uuid,uuid),public.get_match(uuid),public.hunt_match_action(uuid,text,uuid,boolean,uuid,uuid,uuid) to authenticated;

-- Serialize legacy REST writes against match creation and block them after play too.
create function public.guard_public_position() returns trigger language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.rooms where id=new.room_id for update;
 if exists(select 1 from public.hunt_matches where room_id=new.room_id) then raise exception 'Match GPS must use publish_location' using errcode='42501';end if;
 return new;
end; $$;
create trigger public_position_guard before insert or update on public.positions for each row execute function public.guard_public_position();
revoke all on function public.guard_public_position() from public;
