const test = require('node:test');
const assert = require('node:assert/strict');
const activeRoom = require('../lib/active-room.cjs');

function api(name) {
  assert.equal(typeof activeRoom[name], 'function', `${name} must be implemented`);
  return activeRoom[name];
}

const key = 'hunt:active-room';
const room = { id: 'room-123', code: 'AB12CD', owner_id: 'user-456' };

test('valid_saved_room_restores_after_membership_lookup', async () => {
  let restoredRoom = null;
  let lookedUp = '';
  const storage = { getItem: () => JSON.stringify(room), removeItem() {} };
  const restored = await api('restoreActiveRoom')(storage, async (id) => {
    lookedUp = id;
    return room;
  }, (nextRoom) => { restoredRoom = nextRoom; });
  assert.deepEqual(restoredRoom, room);
  assert.deepEqual(restored, room);
  assert.equal(lookedUp, room.id);
});

test('saved_room_without_membership_is_cleared', async () => {
  let removed = false;
  let restoredRoom = null;
  const storage = { getItem: () => JSON.stringify(room), removeItem: () => { removed = true; } };
  const restored = await api('restoreActiveRoom')(storage, async () => null, (nextRoom) => { restoredRoom = nextRoom; });
  assert.equal(restored, null);
  assert.equal(restoredRoom, null);
  assert.equal(removed, true);
});

test('malformed_saved_room_is_removed', () => {
  let removed = false;
  const storage = { getItem: () => '{bad json', removeItem: (name) => { removed = name === key; } };
  assert.equal(api('readActiveRoom')(storage), null);
  assert.equal(removed, true);
});

test('empty_saved_room_is_removed', () => {
  let removed = false;
  const storage = { getItem: () => '', removeItem: () => { removed = true; } };
  assert.equal(api('readActiveRoom')(storage), null);
  assert.equal(removed, true);
});

test('incomplete_saved_room_is_removed', () => {
  let removed = false;
  const storage = { getItem: () => JSON.stringify({ id: room.id }), removeItem: () => { removed = true; } };
  assert.equal(api('readActiveRoom')(storage), null);
  assert.equal(removed, true);
});

test('storage_access_failures_do_not_escape', () => {
  const storage = {
    getItem() { throw new Error('blocked'); },
    setItem() { throw new Error('quota'); },
    removeItem() { throw new Error('blocked'); },
  };
  assert.equal(api('readActiveRoom')(storage), null);
  assert.equal(api('saveActiveRoom')(storage, room), false);
  assert.doesNotThrow(() => api('clearActiveRoom')(storage));
});
