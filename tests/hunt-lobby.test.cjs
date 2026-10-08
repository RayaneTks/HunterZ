const test = require('node:test');
const assert = require('node:assert/strict');
const activeRoom = require('../lib/active-room.cjs');

function api(name) {
  assert.equal(typeof activeRoom[name], 'function', `${name} must be implemented`);
  return activeRoom[name];
}

const room = { id: 'room-123', code: 'AB12CD', owner_id: 'user-456' };

function memoryStorage(options = {}) {
  const values = new Map();
  return {
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) {
      if (options.failWrites) throw new Error('storage disabled');
      values.set(key, value);
    },
    removeItem(key) { values.delete(key); },
    values,
  };
}

test('creation_survives_unavailable_storage', async () => {
  const state = { room: null };
  const storage = memoryStorage({ failWrites: true });
  storage.setItem = () => {
    assert.deepEqual(state.room, room, 'in-memory lobby must be committed before storage is attempted');
    throw new Error('storage disabled');
  };
  const created = await api('createAndActivateRoom')(
    async () => ({ id: room.id, code: room.code }),
    room.owner_id,
    storage,
    (nextRoom) => { state.room = nextRoom; },
  );
  assert.deepEqual(state.room, room);
  assert.deepEqual(created, room);
  assert.equal(storage.values.has('hunt:active-room'), false);
});

test('join_rejects_invalid_code_without_calling_rpc', async () => {
  let called = false;
  await assert.rejects(
    api('joinAndActivateRoom')('bad!', async () => { called = true; return room; }, memoryStorage(), () => {}),
    /code/i,
  );
  assert.equal(called, false);
});

test('join_rejects_closed_lobby_and_keeps_join_retryable', async () => {
  let attempts = 0;
  const state = { room: null };
  const storage = memoryStorage();
  const join = async () => {
    attempts += 1;
    if (attempts === 1) throw new Error('Lobby introuvable ou fermé');
    return room;
  };
  const activate = () => api('joinAndActivateRoom')(' ab12cd ', join, storage, (nextRoom) => { state.room = nextRoom; });
  await assert.rejects(activate(), /fermé/);
  assert.equal(state.room, null);
  assert.equal(storage.values.has('hunt:active-room'), false);
  assert.deepEqual(await activate(), room);
  assert.equal(attempts, 2);
  assert.deepEqual(state.room, room);
});

test('join_survives_unavailable_storage', async () => {
  const state = { room: null };
  const storage = memoryStorage();
  storage.setItem = () => {
    assert.deepEqual(state.room, room, 'in-memory lobby must be committed before storage is attempted');
    throw new Error('storage disabled');
  };
  const joined = await api('joinAndActivateRoom')('AB12CD', async () => room, storage, (nextRoom) => { state.room = nextRoom; });
  assert.deepEqual(state.room, room);
  assert.deepEqual(joined, room);
});

test('rpc_error_is_recoverable_without_saving_room', async () => {
  const state = { room: null };
  const storage = memoryStorage();
  let attempts = 0;
  const create = async () => {
    attempts += 1;
    if (attempts === 1) throw new Error('Temporary network error');
    return { id: room.id, code: room.code };
  };
  const activate = () => api('createAndActivateRoom')(create, room.owner_id, storage, (nextRoom) => { state.room = nextRoom; });
  await assert.rejects(activate(), /Temporary/);
  assert.equal(state.room, null);
  assert.equal(storage.values.has('hunt:active-room'), false);
  assert.deepEqual(await activate(), room);
  assert.equal(attempts, 2);
  assert.deepEqual(state.room, room);
});
