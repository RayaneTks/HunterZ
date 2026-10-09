const test = require('node:test');
const assert = require('node:assert/strict');
const { isPositionFresh } = require('../lib/location-freshness.cjs');

test('position is fresh until 45 seconds, then expires', () => {
  const now = Date.parse('2026-10-09T12:00:00.000Z');
  assert.equal(isPositionFresh('2026-10-09T11:59:15.001Z', now), true);
  assert.equal(isPositionFresh('2026-10-09T11:59:15.000Z', now), false);
});

test('invalid and future positions are not fresh', () => {
  const now = Date.parse('2026-10-09T12:00:00.000Z');
  assert.equal(isPositionFresh('not-a-date', now), false);
  assert.equal(isPositionFresh('2026-10-09T12:00:00.001Z', now), false);
});
