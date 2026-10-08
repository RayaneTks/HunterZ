const test = require('node:test');
const assert = require('node:assert/strict');
const { messageFromError } = require('../lib/error-message.cjs');

test('exposes a useful message from a Supabase-style error object', () => {
  assert.equal(
    messageFromError({ message: 'Tu es déjà dans une chasse', code: '23505' }),
    'Tu es déjà dans une chasse',
  );
});

test('uses a safe fallback for unknown errors', () => {
  assert.equal(messageFromError({ detail: 'internal detail' }), 'Une erreur inattendue est survenue.');
});
