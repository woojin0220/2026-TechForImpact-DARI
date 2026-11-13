import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { accountErrorKind, consentVersions, isValidCode, isValidEmail, isValidNickname, missingConsents, normalizeNickname, onboardingNeeds, primaryRole } from '../src/platform/account.ts';
import { accountCopies, accountCopyFor } from '../src/platform/accountCopy.ts';
import { readPlatformConfig } from '../src/platform/config.ts';
import { intakeLanguages } from '../src/intakeCopy.ts';

const profile = { user_id: 'u1', nickname: null, preferred_language: 'ko', age_confirmed_at: null, status: 'active' };
const current = Object.entries(consentVersions).map(([document, version]) => ({ document, version, withdrawn_at: null }));

test('onboarding asks for age, every current consent and a nickname', () => {
  assert.deepEqual(onboardingNeeds({ profile, consents: [] }), ['age', 'consent', 'nickname']);
  const done = { ...profile, nickname: 'alpha', age_confirmed_at: '2026-11-13T00:00:00Z' };
  assert.deepEqual(onboardingNeeds({ profile: done, consents: current }), []);
  const outdated = current.map(item => item.document === 'privacy' ? { ...item, version: '2020-01' } : item);
  assert.deepEqual(missingConsents(outdated), ['privacy']);
  const withdrawn = current.map(item => item.document === 'terms' ? { ...item, withdrawn_at: '2026-11-13T00:00:00Z' } : item);
  assert.deepEqual(onboardingNeeds({ profile: done, consents: withdrawn }), ['consent']);
});

test('nicknames allow any script but not symbols or blank names', () => {
  for (const ok of ['alpha', '다리 사용자', 'مستخدم_1', 'Ива-н', 'کاربر']) assert.ok(isValidNickname(ok), ok);
  for (const bad of ['a', '   ', '<script>', 'x'.repeat(21), '__', 'name@mail']) assert.ok(!isValidNickname(bad), bad);
  assert.equal(normalizeNickname('  two   words '), 'two words');
});

test('email and code checks', () => {
  assert.ok(isValidEmail(' person@example.org '));
  assert.ok(!isValidEmail('person@'));
  assert.ok(isValidCode('123456'));
  assert.ok(!isValidCode('12a456'));
});

test('roles resolve to the highest one and server errors to message keys', () => {
  assert.equal(primaryRole(['user', 'moderator']), 'moderator');
  assert.equal(primaryRole([]), 'user');
  assert.equal(accountErrorKind({ status: 429 }), 'rateLimit');
  assert.equal(accountErrorKind({ code: 'otp_expired', status: 403 }), 'code');
  assert.equal(accountErrorKind({ code: '23505' }), 'nicknameTaken');
  assert.equal(accountErrorKind(new Error('network')), 'generic');
});

test('platform settings are optional and must be https', () => {
  assert.equal(readPlatformConfig({}), null);
  assert.equal(readPlatformConfig({ VITE_SUPABASE_URL: 'http://x.supabase.co', VITE_SUPABASE_ANON_KEY: 'k' }), null);
  assert.deepEqual(readPlatformConfig({ VITE_SUPABASE_URL: 'https://x.supabase.co/', VITE_SUPABASE_ANON_KEY: ' k ' }), { url: 'https://x.supabase.co', anonKey: 'k' });
});

test('account copy is complete in every intake language', () => {
  const keys = Object.keys(accountCopies.en).sort();
  for (const { code } of intakeLanguages) {
    assert.deepEqual(Object.keys(accountCopies[code] ?? {}).sort(), keys, code);
    for (const key of keys) {
      assert.ok(accountCopies[code][key].trim(), `${code}.${key}`);
      assert.deepEqual(accountCopies[code][key].match(/\{\w+\}/g) ?? [], accountCopies.en[key].match(/\{\w+\}/g) ?? [], `${code}.${key} placeholders`);
    }
  }
  assert.equal(accountCopyFor('xx'), accountCopies.en);
});

const project = fileURLToPath(new URL('..', import.meta.url));
const require = createRequire(import.meta.url);
const compiled = await build({
  absWorkingDir: project,
  stdin: { loader: 'tsx', resolveDir: project, sourcefile: 'tests/platform-account.fixture.tsx', contents: `
    import { renderToStaticMarkup } from 'react-dom/server';
    import { AccountScreen, AuthGate, OnboardingScreen, SignInScreen } from './src/platform/AccountScreens';
    import { accountCopyFor } from './src/platform/accountCopy';
    const api = new Proxy({}, { get: () => async () => {} });
    const account = (overrides = {}) => ({ email: 'member@example.org', roles: ['user', 'supporter'], consents: [],
      profile: { user_id: 'u1', nickname: 'alpha', preferred_language: 'ko', age_confirmed_at: null, status: 'active', ...overrides } });
    export const signIn = language => renderToStaticMarkup(<SignInScreen copy={accountCopyFor(language)} api={api} />);
    export const onboarding = language => renderToStaticMarkup(<OnboardingScreen copy={accountCopyFor(language)} account={account()} api={api} language={language} onDone={() => {}} />);
    export const accountPage = language => renderToStaticMarkup(<AccountScreen copy={accountCopyFor(language)} account={account()} api={api} onBack={() => {}} onChanged={() => {}} />);
    export const gate = language => renderToStaticMarkup(<AuthGate copy={accountCopyFor(language)} language={language}>{() => <p>secret</p>}</AuthGate>);
  ` },
  bundle: true, platform: 'node', format: 'cjs', jsx: 'automatic', write: false,
  external: ['react', 'react-dom', 'react-dom/server', 'react/jsx-runtime', '@supabase/supabase-js'], loader: { '.css': 'empty' },
});
const mod = { exports: {} };
new Function('require', 'module', 'exports', compiled.outputFiles[0].text)(require, mod, mod.exports);

test('sign-in starts with the email step and says the application is not linked', () => {
  const html = mod.exports.signIn('ko');
  assert.match(html, /<h1>로그인<\/h1>/);
  assert.match(html, /type="email"/);
  assert.match(html, /계정과 연결되지 않아요/);
  assert.doesNotMatch(html, /one-time-code/);
});

test('onboarding lists age and all three consents with the start button disabled', () => {
  const html = mod.exports.onboarding('ar');
  assert.equal((html.match(/type="checkbox"/g) ?? []).length, 4);
  assert.match(html, /عمري 14 سنة أو أكثر/);
  assert.match(html, /<button class="primary full" disabled="">ابدأ<\/button>/);
});

test('account page shows email, highest role, sign out and delete', () => {
  const html = mod.exports.accountPage('en');
  assert.match(html, /Signed in as member@example.org/);
  assert.match(html, /<dd>Support organization<\/dd>/);
  assert.match(html, /Sign out/);
  assert.match(html, /Delete account/);
});

test('without platform settings the gate never shows protected content', () => {
  const html = mod.exports.gate('ko');
  assert.match(html, /로그인이 설정되지 않았어요/);
  assert.doesNotMatch(html, /secret/);
});
