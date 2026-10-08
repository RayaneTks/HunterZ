import { supabase } from './supabase';
import type { LobbySnapshot, Member, PlayerLocation, Profile, Room } from './types';
const { joinRoomWithMetadata } = require('./active-room.cjs') as {
  joinRoomWithMetadata: (code: string, joinRpc: (normalizedCode: string) => Promise<string | null>, lookupRoom: (roomId: string) => Promise<Room | null>) => Promise<Room>;
};

function requireClient() {
  if (!supabase) throw new Error('Supabase n’est pas configuré.');
  return supabase;
}

export async function ensureAnonymousSession() {
  const client = requireClient();
  const { data, error } = await client.auth.getSession();
  if (error) throw error;
  if (data.session?.user) return data.session.user;

  const { data: signedIn, error: signInError } = await client.auth.signInAnonymously();
  if (signInError) throw signInError;
  if (!signedIn.user) throw new Error('Session anonyme introuvable.');
  return signedIn.user;
}

export async function getProfile(userId: string) {
  const client = requireClient();
  const { data, error } = await client.from('profiles').select('id,nickname').eq('id', userId).maybeSingle();
  if (error) throw error;
  return data as Profile | null;
}

export async function saveProfile(userId: string, nickname: string) {
  const client = requireClient();
  const { data, error } = await client
    .from('profiles')
    .upsert({ id: userId, nickname }, { onConflict: 'id' })
    .select('id,nickname')
    .single();
  if (error) throw error;
  return data as Profile;
}

export async function getRoom(roomId: string) {
  const client = requireClient();
  const { data, error } = await client.from('rooms').select('id,code,owner_id').eq('id', roomId).maybeSingle();
  if (error) throw error;
  return data as Room | null;
}

export async function createRoom() {
  const client = requireClient();
  const { data, error } = await client.rpc('create_room');
  if (error) throw error;
  const created = Array.isArray(data) ? data[0] : data;
  if (!created?.room_id || !created?.room_code) throw new Error('Le lobby n’a pas pu être créé.');
  return { id: created.room_id, code: created.room_code };
}

export async function joinRoom(code: string) {
  const client = requireClient();
  return joinRoomWithMetadata(code, async (normalizedCode) => {
    const { data: roomId, error } = await client.rpc('join_room', { p_code: normalizedCode });
    if (error) throw error;
    return roomId as string | null;
  }, getRoom);
}

export async function leaveRoom(roomId: string) {
  const client = requireClient();
  const { error } = await client.rpc('leave_room', { p_room: roomId });
  if (error) throw error;
}

export async function closeRoom(roomId: string) {
  const client = requireClient();
  const { error } = await client.rpc('close_room', { p_room: roomId });
  if (error) throw error;
}

export async function stopSharing(roomId: string) {
  const client = requireClient();
  const { error } = await client.rpc('stop_sharing', { p_room: roomId });
  if (error) throw error;
}

export async function loadLobby(room: Room): Promise<LobbySnapshot> {
  const client = requireClient();
  const [{ data: memberRows, error: membersError }, { data: locationRows, error: locationsError }] = await Promise.all([
    client.from('room_members').select('user_id,profiles(nickname)').eq('room_id', room.id).order('joined_at'),
    client.from('positions').select('user_id,latitude,longitude,accuracy,updated_at').eq('room_id', room.id),
  ]);
  if (membersError) throw membersError;
  if (locationsError) throw locationsError;

  const members = (memberRows ?? []) as unknown as Member[];
  const locations = ((locationRows ?? []) as Omit<PlayerLocation, 'nickname'>[]).map((location) => ({
    ...location,
    nickname: members.find((member) => member.user_id === location.user_id)?.profiles?.nickname ?? 'Joueur',
  }));
  return { members, locations };
}

export async function searchProfiles(query: string) {
  const client = requireClient();
  const normalized = query.trim();
  const isId = /^[0-9a-f-]{36}$/i.test(normalized);
  const request = client.from('profiles').select('id,nickname').limit(12);
  const { data, error } = isId
    ? await request.eq('id', normalized)
    : await request.ilike('nickname', `%${normalized.replace(/[%_]/g, '')}%`);
  if (error) throw error;
  return (data ?? []) as Profile[];
}
