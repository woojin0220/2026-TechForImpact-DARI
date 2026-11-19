import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { detectSensitive, excerpt, isValidBody, isValidTitle, relativeTime, writableBoards } from '../src/community/model.ts';
import { communityCopies, communityCopyFor } from '../src/community/copy.ts';
import { intakeLanguages } from '../src/intakeCopy.ts';

test('sensitive text is flagged before posting', () => {
  assert.deepEqual(detectSensitive('010-1234-5678로 연락 주세요'), ['phone']);
  assert.deepEqual(detectSensitive('+82 10 1234 5678'), ['phone']);
  assert.deepEqual(detectSensitive('mail me: someone@example.org'), ['email']);
  assert.deepEqual(detectSensitive('번호는 900101-5123456 입니다'), ['idNumber']);
  assert.deepEqual(detectSensitive('passport M12345678'), ['idNumber']);
  assert.deepEqual(detectSensitive('هاتفي ٠١٠١٢٣٤٥٦٧٨'), ['phone']);
  assert.deepEqual(detectSensitive('출입국사무소는 9시에 열어요. 2026년 11월 19일, 버스 7016번'), []);
});

test('titles, bodies and excerpts', () => {
  assert.ok(isValidTitle('질문'));
  assert.ok(!isValidTitle(' a '));
  assert.ok(!isValidTitle('x'.repeat(101)));
  assert.ok(isValidBody('ok'));
  assert.ok(!isValidBody('   '));
  assert.equal(excerpt('a  b\n\nc'), 'a b c');
  assert.equal(excerpt('x'.repeat(200)).length, 90);
});

test('only support organizations may write notices', () => {
  assert.deepEqual(writableBoards(false), ['qna', 'life']);
  assert.deepEqual(writableBoards(true), ['qna', 'life', 'notice']);
});

test('relative time uses the reader language', () => {
  const now = Date.parse('2026-11-19T06:00:00Z');
  assert.equal(relativeTime('2026-11-19T05:57:00Z', 'en', now), '3 minutes ago');
  assert.equal(relativeTime('2026-11-19T03:00:00Z', 'ko', now), '3시간 전');
  assert.match(relativeTime('2026-10-01T00:00:00Z', 'en', now), /2026/);
});

test('community copy is complete in every intake language', () => {
  const keys = Object.keys(communityCopies.en).sort();
  for (const { code } of intakeLanguages) {
    assert.deepEqual(Object.keys(communityCopies[code] ?? {}).sort(), keys, code);
    for (const key of keys) assert.deepEqual(communityCopies[code][key].match(/\{\w+\}/g) ?? [], communityCopies.en[key].match(/\{\w+\}/g) ?? [], `${code}.${key}`);
  }
  assert.equal(communityCopyFor('xx'), communityCopies.en);
});

const project = fileURLToPath(new URL('..', import.meta.url));
const require = createRequire(import.meta.url);
const compiled = await build({
  absWorkingDir: project,
  stdin: { loader: 'tsx', resolveDir: project, sourcefile: 'tests/community.fixture.tsx', contents: `
    import { renderToStaticMarkup } from 'react-dom/server';
    import { CommunityHome, PostComposer } from './src/community/CommunityScreens';
    import { communityCopyFor } from './src/community/copy';
    import { accountCopyFor } from './src/platform/accountCopy';
    const api = new Proxy({}, { get: () => async () => [] });
    const account = roles => ({ email: 'm@example.org', roles, consents: [], badges: [],
      profile: { user_id: 'u1', nickname: 'alpha', preferred_language: 'ko', age_confirmed_at: 'x', status: 'active' } });
    const shared = (language, roles = ['user']) => ({ copy: communityCopyFor(language), accountCopy: accountCopyFor(language), api, account: account(roles), language });
    export const home = language => renderToStaticMarkup(<CommunityHome {...shared(language)} board="all" onBoard={() => {}} onOpenPost={() => {}} onWrite={() => {}} onAccount={() => {}} />);
    export const composer = (language, roles) => renderToStaticMarkup(<PostComposer {...shared(language, roles)} initialBoard="notice" onDone={() => {}} onCancel={() => {}} />);
  ` },
  bundle: true, platform: 'node', format: 'cjs', jsx: 'automatic', write: false,
  external: ['react', 'react-dom', 'react-dom/server', 'react/jsx-runtime', '@supabase/supabase-js'], loader: { '.css': 'empty' },
});
const mod = { exports: {} };
new Function('require', 'module', 'exports', compiled.outputFiles[0].text)(require, mod, mod.exports);

test('home shows board tabs, the safety reminder and a write button', () => {
  const html = mod.exports.home('ko');
  for (const label of ['전체', '질문과 답변', '생활 정보', '기관 공지']) assert.ok(html.includes(`>${label}</button>`), label);
  assert.match(html, /aria-selected="true"[^>]*>전체/);
  assert.match(html, /이름, 연락처, 사건 내용은 올리지 마세요/);
  assert.match(html, /글쓰기/);
  assert.match(html, /내 정보/);
});

test('members cannot pick the notice board; support organizations can', () => {
  const member = mod.exports.composer('en', ['user']);
  assert.doesNotMatch(member, /Notices/);
  assert.match(member, /<input type="radio" name="board" checked=""\/><span>Questions/);
  const supporter = mod.exports.composer('ar', ['user', 'supporter']);
  assert.match(supporter, /<input type="radio" name="board" checked=""\/><span>إعلانات/);
});
