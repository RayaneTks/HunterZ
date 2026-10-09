const MAX_POSITION_AGE_MS = 45_000;

function isPositionFresh(updatedAt, nowMs = Date.now()) {
  if (typeof updatedAt !== 'string' || !Number.isFinite(nowMs)) return false;
  const timestamp = Date.parse(updatedAt);
  if (!Number.isFinite(timestamp)) return false;
  const age = nowMs - timestamp;
  return age >= 0 && age < MAX_POSITION_AGE_MS;
}

module.exports = { isPositionFresh };
