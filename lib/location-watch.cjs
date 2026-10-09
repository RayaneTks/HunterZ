const WATCH_OPTIONS = { enableHighAccuracy: true, maximumAge: 0, timeout: 12_000 };

function createLocationWatch({ geolocation, writePosition, removePosition, onUpdate, now = Date.now }) {
  let generation = 0;
  let current = null;
  let operations = Promise.resolve();

  function publish(state, extra = {}) {
    onUpdate({ state, accuracy: null, lastUpdate: null, errorMessage: null, ...extra });
  }

  function enqueue(operation) {
    const result = operations.then(operation, operation);
    operations = result.catch(() => {});
    return result;
  }

  async function disposeCurrent() {
    const previous = current;
    current = null;
    if (!previous) return null;

    if (previous.watchId !== null) geolocation.clearWatch(previous.watchId);
    await Promise.all(previous.pendingWrites);
    try {
      await removePosition(previous.roomId);
      return null;
    } catch {
      return 'Le dernier signal n’a pas pu être retiré du lobby. Il expirera automatiquement.';
    }
  }

  function start(roomId, userId) {
    if (current?.roomId === roomId && current?.userId === userId && current.watching && current.generation === generation) {
      return Promise.resolve(true);
    }
    const requestGeneration = ++generation;
    return enqueue(async () => {
      if (current?.roomId === roomId && current?.userId === userId && current.watching && current.generation === requestGeneration) return true;
      const cleanupError = await disposeCurrent();
      if (requestGeneration !== generation) return false;
      if (!roomId || !userId || !geolocation || typeof geolocation.watchPosition !== 'function') {
        publish('unavailable', { errorMessage: 'La localisation n’est pas disponible sur cet appareil.' });
        return false;
      }

      const record = {
        generation: requestGeneration,
        roomId,
        userId,
        watchId: null,
        watching: true,
        lastAttemptAt: null,
        pendingWrites: new Set(),
        writeQueue: Promise.resolve(),
        cleanupError,
        errorMessage: cleanupError,
      };
      current = record;
      publish('requesting', { errorMessage: cleanupError });

      try {
        record.watchId = geolocation.watchPosition(
          (position) => {
            if (generation !== record.generation || current !== record || !record.watching) return;
            const receivedAt = now();
            const fixAt = Number.isFinite(position.timestamp) && Math.abs(receivedAt - position.timestamp) < 60_000
              ? position.timestamp
              : receivedAt;
            record.errorMessage = record.errorMessage && !record.errorMessage.startsWith('Signal non transmis')
              ? record.errorMessage
              : null;
            publish('active', {
              accuracy: position.coords.accuracy,
              lastUpdate: fixAt,
              errorMessage: record.errorMessage,
            });

            const attemptedAt = receivedAt;
            if (record.lastAttemptAt !== null && attemptedAt - record.lastAttemptAt < 2_500) return;
            record.lastAttemptAt = attemptedAt;
            const payload = {
              room_id: record.roomId,
              user_id: record.userId,
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracy: position.coords.accuracy,
              updated_at: new Date(fixAt).toISOString(),
            };
            const write = record.writeQueue.then(() => writePosition(payload)).then(() => {
              if (generation !== record.generation || current !== record) return;
              record.errorMessage = record.cleanupError;
              publish('active', {
                accuracy: position.coords.accuracy,
                lastUpdate: fixAt,
                errorMessage: record.errorMessage,
              });
            }).catch(() => {
              if (generation !== record.generation || current !== record) return;
              record.errorMessage = 'Signal non transmis. Nouvelle tentative au prochain point GPS.';
              publish('active', {
                accuracy: position.coords.accuracy,
                lastUpdate: fixAt,
                errorMessage: record.errorMessage,
              });
            }).finally(() => record.pendingWrites.delete(write));
            record.pendingWrites.add(write);
            record.writeQueue = write;
          },
          (error) => {
            if (generation !== record.generation || current !== record) return;
            if (record.watchId !== null) geolocation.clearWatch(record.watchId);
            record.watchId = null;
            record.watching = false;
            if (error.code === 1) {
              publish('denied', { errorMessage: 'Autorisation refusée. Tu peux réessayer depuis le bouton ci-dessous.' });
            } else {
              publish('unavailable', { errorMessage: error.message || 'Signal GPS indisponible pour le moment. Tu peux réessayer.' });
            }
          },
          WATCH_OPTIONS,
        );
        return true;
      } catch {
        record.watching = false;
        publish('unavailable', { errorMessage: 'Signal GPS indisponible pour le moment. Tu peux réessayer.' });
        return false;
      }
    });
  }

  function stop() {
    const stopGeneration = ++generation;
    return enqueue(async () => {
      const cleanupError = await disposeCurrent();
      if (stopGeneration === generation) publish('off', { errorMessage: cleanupError });
    });
  }

  return { start, stop };
}

module.exports = { createLocationWatch };
