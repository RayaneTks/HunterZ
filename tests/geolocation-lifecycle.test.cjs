const test = require('node:test');
const assert = require('node:assert/strict');
const { createLocationWatch } = require('../lib/location-watch.cjs');

function fakeGeolocation() {
  const watches = [];
  return {
    watches,
    watchPosition(success, error, options) {
      watches.push({ success, error, options });
      return watches.length;
    },
    clearWatch(id) {
      this.cleared = [...(this.cleared ?? []), id];
    },
  };
}

function position(timestamp = 1_000, latitude = 43.2965) {
  return { coords: { latitude, longitude: 5.3698, accuracy: 7 }, timestamp };
}

test('permission denial leaves watch retryable', async () => {
  const geolocation = fakeGeolocation();
  const states = [];
  const watch = createLocationWatch({ geolocation, writePosition: async () => {}, removePosition: async () => {}, onUpdate: (state) => states.push(state) });

  await watch.start('room-a', 'user-a');
  geolocation.watches[0].error({ code: 1, PERMISSION_DENIED: 1, message: 'denied' });
  await watch.start('room-a', 'user-a');

  assert.equal(states.some((state) => state.state === 'denied'), true);
  assert.equal(states.at(-1).state, 'requesting');
  assert.equal(geolocation.watches.length, 2);
});

test('missing geolocation reports unavailable', async () => {
  const states = [];
  const watch = createLocationWatch({ geolocation: null, writePosition: async () => {}, removePosition: async () => {}, onUpdate: (state) => states.push(state) });

  const started = await watch.start('room-a', 'user-a');

  assert.equal(started, false);
  assert.equal(states.at(-1).state, 'unavailable');
});

test('restarting an active watch does not invalidate its callbacks', async () => {
  const geolocation = fakeGeolocation();
  const writes = [];
  const watch = createLocationWatch({
    geolocation,
    writePosition: async (value) => { writes.push(value); },
    removePosition: async () => {},
    onUpdate: () => {},
  });

  await watch.start('room-a', 'user-a');
  await watch.start('room-a', 'user-a');
  geolocation.watches[0].success(position());
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(geolocation.watches.length, 1);
  assert.equal(writes.length, 1);
});

test('watch requests fresh high-accuracy fixes and retries transient write failures', async () => {
  const geolocation = fakeGeolocation();
  const states = [];
  const writes = [];
  let now = 10_000;
  const watch = createLocationWatch({
    geolocation,
    now: () => now,
    writePosition: async (value) => {
      writes.push(value);
      if (writes.length === 1) throw new Error('offline');
    },
    removePosition: async () => {},
    onUpdate: (state) => states.push(state),
  });

  await watch.start('room-a', 'user-a');
  assert.deepEqual(geolocation.watches[0].options, { enableHighAccuracy: true, maximumAge: 0, timeout: 12000 });
  geolocation.watches[0].success(position(9_500));
  await new Promise((resolve) => setImmediate(resolve));
  assert.match(states.at(-1).errorMessage, /réessayer|tentative/i);

  now += 2499;
  geolocation.watches[0].success(position(11_999));
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(writes.length, 1);

  now += 1;
  geolocation.watches[0].success(position(12_000));
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(writes.length, 2);
  assert.equal(writes[1].updated_at, new Date(12_000).toISOString());
  assert.equal(writes[1].accuracy, 7);
  assert.equal(writes[1].latitude, 43.2965);
  assert.equal(states.at(-1).lastUpdate, 12_000);
  assert.equal(states.at(-1).errorMessage, null);
});

test('invalid browser GPS timestamp cannot make position invisible or reject its database write', async () => {
  const geolocation = fakeGeolocation();
  const writes = [];
  const states = [];
  const now = Date.UTC(2026, 9, 9, 12);
  const watch = createLocationWatch({
    geolocation,
    now: () => now,
    writePosition: async (value) => { writes.push(value); },
    removePosition: async () => {},
    onUpdate: (state) => states.push(state),
  });

  await watch.start('room-a', 'user-a');
  geolocation.watches[0].success(position(Date.UTC(58741, 2, 9, 12)));
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(writes[0].updated_at, '2026-10-09T12:00:00.000Z');
  assert.equal(states.at(-1).lastUpdate, now);
});

test('location writes stay ordered when network is slower than the GPS throttle', async () => {
  const geolocation = fakeGeolocation();
  const writes = [];
  let persistedLatitude = null;
  let now = 10_000;
  const watch = createLocationWatch({
    geolocation,
    now: () => now,
    writePosition: (value) => new Promise((resolve) => writes.push({
      value,
      finish: () => { persistedLatitude = value.latitude; resolve(); },
    })),
    removePosition: async () => {},
    onUpdate: () => {},
  });

  await watch.start('room-a', 'user-a');
  geolocation.watches[0].success(position(10_000, 43.2965));
  await new Promise((resolve) => setImmediate(resolve));
  now += 2_500;
  geolocation.watches[0].success(position(12_500, 43.3));
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(writes.length, 1);
  writes[0].finish();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(writes.length, 2);
  writes[1].finish();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(persistedLatitude, 43.3);
});

test('stop invalidates callbacks, waits for in-flight upsert, then removes position', async () => {
  const geolocation = fakeGeolocation();
  const events = [];
  let finishWrite;
  const write = new Promise((resolve) => { finishWrite = resolve; });
  const watch = createLocationWatch({
    geolocation,
    writePosition: async () => { events.push('write:start'); await write; events.push('write:end'); },
    removePosition: async (roomId) => { events.push(`remove:${roomId}`); },
    onUpdate: () => {},
  });

  await watch.start('room-a', 'user-a');
  geolocation.watches[0].success(position());
  await new Promise((resolve) => setImmediate(resolve));
  const stopping = watch.stop();
  geolocation.watches[0].success(position(2_000, 43.3));
  await new Promise((resolve) => setImmediate(resolve));

  assert.deepEqual(events, ['write:start']);
  finishWrite();
  await stopping;

  assert.deepEqual(events, ['write:start', 'write:end', 'remove:room-a']);
  assert.deepEqual(geolocation.cleared, [1]);
});

test('room change drains old writes and removes old position before starting new watch', async () => {
  const geolocation = fakeGeolocation();
  const events = [];
  let finishWrite;
  const write = new Promise((resolve) => { finishWrite = resolve; });
  const watch = createLocationWatch({
    geolocation,
    writePosition: async (value) => {
      events.push(`write:${value.room_id}:start`);
      if (value.room_id === 'room-a') await write;
      events.push(`write:${value.room_id}:end`);
    },
    removePosition: async (roomId) => { events.push(`remove:${roomId}`); },
    onUpdate: () => {},
  });

  await watch.start('room-a', 'user-a');
  geolocation.watches[0].success(position());
  await new Promise((resolve) => setImmediate(resolve));
  const switching = watch.start('room-b', 'user-a');
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(geolocation.watches.length, 1);
  finishWrite();
  await switching;

  assert.deepEqual(events, ['write:room-a:start', 'write:room-a:end', 'remove:room-a']);
  assert.equal(geolocation.watches.length, 2);
});

test('failed old-room removal remains visible after new-room write succeeds', async () => {
  const geolocation = fakeGeolocation();
  const states = [];
  const watch = createLocationWatch({
    geolocation,
    writePosition: async () => {},
    removePosition: async () => { throw new Error('offline'); },
    onUpdate: (state) => states.push(state),
  });

  await watch.start('room-a', 'user-a');
  await watch.start('room-b', 'user-a');
  geolocation.watches[1].success(position());
  await new Promise((resolve) => setImmediate(resolve));

  assert.match(states.at(-1).errorMessage, /expirera/i);
});
