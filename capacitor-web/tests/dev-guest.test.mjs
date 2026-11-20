import test from 'node:test';
import assert from 'node:assert/strict';
import { canUseDevGuest, readDevGuest, writeDevGuest, DEV_GUEST_KEY, devGuestCopyFor } from '../src/shell/devGuest.ts';

test('only signed-out development sessions can skip the front login gate', () => {
  assert.equal(canUseDevGuest(true, 'signedOut'), true);
  for (const status of ['signedOut', 'signedIn', 'loading', 'error', 'unconfigured']) {
    assert.equal(canUseDevGuest(false, status), false);
    if (status !== 'signedOut') assert.equal(canUseDevGuest(true, status), false);
  }
});

test('the test choice survives a tab refresh but is ignored in a production build', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage');
  const data = new Map();
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: {
    getItem: key => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
    removeItem: key => data.delete(key),
  } });
  try {
    writeDevGuest(true);
    assert.equal(data.get(DEV_GUEST_KEY), '1');
    assert.equal(readDevGuest(true), true);
    assert.equal(readDevGuest(false), false);
    writeDevGuest(false);
    assert.equal(readDevGuest(true), false);
  } finally {
    if (original) Object.defineProperty(globalThis, 'sessionStorage', original);
    else delete globalThis.sessionStorage;
  }
});

test('all supported screen languages explain the development entry and return action', () => {
  for (const language of ['ko', 'en', 'fr', 'ru', 'ar', 'fa']) {
    const copy = devGuestCopyFor(language);
    for (const value of Object.values(copy)) assert.ok(value.trim().length > 0);
  }
});
