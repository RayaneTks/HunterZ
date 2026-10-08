const test = require('node:test');
const assert = require('node:assert/strict');
const { canInstallPwa, isStandaloneMode } = require('../lib/pwa-install.js');

test('offers installation only when the browser exposes an install prompt', () => {
  assert.equal(canInstallPwa({ prompt() {} }), true);
  assert.equal(canInstallPwa(null), false);
  assert.equal(canInstallPwa({}), false);
});

test('detects standalone display mode and iOS standalone mode', () => {
  assert.equal(isStandaloneMode('standalone', false), true);
  assert.equal(isStandaloneMode('browser', true), true);
  assert.equal(isStandaloneMode('browser', false), false);
});
