const ROOM_STORAGE_KEY = 'hunt:active-room';

function isRoom(value) {
  return Boolean(
    value &&
    typeof value.id === 'string' && value.id.trim() &&
    typeof value.code === 'string' && /^[A-Z0-9]{6}$/.test(value.code) &&
    (value.owner_id === null || (typeof value.owner_id === 'string' && value.owner_id.trim())),
  );
}

function hasOwnerMetadata(room) {
  return isRoom(room) && typeof room.owner_id === 'string' && Boolean(room.owner_id.trim());
}

function normalizeRoomCode(code) {
  return typeof code === 'string' ? code.trim().toUpperCase() : '';
}

function clearActiveRoom(storage) {
  try {
    storage?.removeItem(ROOM_STORAGE_KEY);
  } catch {
    // Storage can be disabled by browser privacy settings.
  }
}

function readActiveRoom(storage) {
  let serialized;
  try {
    serialized = storage?.getItem(ROOM_STORAGE_KEY);
  } catch {
    return null;
  }
  if (serialized == null) return null;

  try {
    const room = JSON.parse(serialized);
    if (isRoom(room)) return room;
  } catch {
    // Invalid JSON is discarded below.
  }
  clearActiveRoom(storage);
  return null;
}

function saveActiveRoom(storage, room) {
  if (!storage || !isRoom(room)) return false;
  try {
    storage.setItem(ROOM_STORAGE_KEY, JSON.stringify(room));
    return true;
  } catch {
    return false;
  }
}

async function restoreActiveRoom(storage, getRoom, setRoom, isCurrent = () => true) {
  const savedRoom = readActiveRoom(storage);
  if (!savedRoom) return null;

  const verifiedRoom = await getRoom(savedRoom.id);
  if (!isCurrent()) return null;
  if (!isRoom(verifiedRoom) || verifiedRoom.id !== savedRoom.id) {
    clearActiveRoom(storage);
    return null;
  }
  setRoom(verifiedRoom);
  saveActiveRoom(storage, verifiedRoom);
  return verifiedRoom;
}

function activateRoom(storage, room, setRoom) {
  setRoom(room);
  saveActiveRoom(storage, room);
  return room;
}

async function createAndActivateRoom(createRoom, ownerId, storage, setRoom) {
  const created = await createRoom();
  const room = { ...created, owner_id: ownerId };
  if (!isRoom(room)) throw new Error('Le lobby n’a pas pu être créé.');
  return activateRoom(storage, room, setRoom);
}

async function joinAndActivateRoom(code, joinRoom, storage, setRoom) {
  const normalizedCode = normalizeRoomCode(code);
  if (!/^[A-Z0-9]{6}$/.test(normalizedCode)) throw new Error('Entre un code de chasse valide à six caractères.');
  const room = await joinRoom(normalizedCode);
  if (!isRoom(room)) throw new Error('Ce lobby est fermé ou inaccessible.');
  return activateRoom(storage, room, setRoom);
}

async function joinRoomWithMetadata(code, joinRoomRpc, getRoom) {
  const normalizedCode = normalizeRoomCode(code);
  if (!/^[A-Z0-9]{6}$/.test(normalizedCode)) throw new Error('Entre un code de chasse valide à six caractères.');

  const roomId = await joinRoomRpc(normalizedCode);
  if (typeof roomId !== 'string' || !roomId.trim()) throw new Error('Lobby introuvable.');

  const joinedRoom = { id: roomId, code: normalizedCode, owner_id: null };
  try {
    const room = await getRoom(roomId);
    if (hasOwnerMetadata(room) && room.id === roomId && room.code === normalizedCode) return room;
  } catch {
    // Membership is already committed; keep the identity and retry metadata separately.
  }
  return joinedRoom;
}

async function refreshRoomMetadata(room, getRoom) {
  if (hasOwnerMetadata(room)) return room;
  const metadata = await getRoom(room.id);
  if (!hasOwnerMetadata(metadata) || metadata.id !== room.id || metadata.code !== room.code) return room;
  return metadata;
}

module.exports = {
  clearActiveRoom,
  createAndActivateRoom,
  joinAndActivateRoom,
  normalizeRoomCode,
  readActiveRoom,
  refreshRoomMetadata,
  restoreActiveRoom,
  saveActiveRoom,
  joinRoomWithMetadata,
};
