import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const compiled = await build({
  entryPoints: [fileURLToPath(new URL('../src/shell/AccountShell.tsx', import.meta.url))],
  bundle: true, platform: 'node', format: 'cjs', jsx: 'automatic', write: false,
  external: ['react', 'react-dom', 'react/jsx-runtime', '@supabase/supabase-js'], loader: { '.css': 'empty' },
});
const mod = { exports: {} };
new Function('require', 'module', 'exports', compiled.outputFiles[0].text)(require, mod, mod.exports);
const { needsSignIn } = mod.exports;

const account = (overrides = {}) => ({
  email: 'm@example.org', roles: ['user'], badges: [],
  consents: ['terms', 'privacy', 'community'].map(document => ({ document, version: '2026-11', withdrawn_at: null })),
  profile: { user_id: 'u1', nickname: 'alpha', preferred_language: 'ko', age_confirmed_at: '2026-11-19T00:00:00Z', status: 'active', member_type: 'general' },
  ...overrides,
});

test('every tab waits for sign-in and a finished profile', () => {
  assert.equal(needsSignIn({ status: 'unconfigured' }), false);
  assert.equal(needsSignIn({ status: 'loading' }), true);
  assert.equal(needsSignIn({ status: 'signedOut' }), true);
  assert.equal(needsSignIn({ status: 'error', session: {} }), true);
  assert.equal(needsSignIn({ status: 'signedIn', session: {}, account: account() }), false);
  assert.equal(needsSignIn({ status: 'signedIn', session: {}, account: account({ profile: { ...account().profile, nickname: null } }) }), true);
  assert.equal(needsSignIn({ status: 'signedIn', session: {}, account: account({ consents: [] }) }), true);
  assert.equal(needsSignIn({ status: 'signedIn', session: {}, account: account({ profile: { ...account().profile, member_type: null } }) }), true);
  assert.equal(needsSignIn({ status: 'signedIn', session: {}, account: account({ profile: { ...account().profile, status: 'suspended' } }) }), true);
});
