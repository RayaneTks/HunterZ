-- Restrict profile reads to the authenticated player and their active lobby.
-- SECURITY DEFINER avoids recursive RLS evaluation while inspecting membership.
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

drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select to authenticated using (public.can_read_profile(id));
