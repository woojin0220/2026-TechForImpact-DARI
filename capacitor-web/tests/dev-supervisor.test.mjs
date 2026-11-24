import test from 'node:test';
import assert from 'node:assert/strict';
import { createDevSupervisor, SUPERVISOR_ID, SUPERVISOR_DATA_KEY } from '../src/platform/devSupervisor.ts';
import { onboardingNeeds, canVerifyBadges } from '../src/platform/account.ts';

function setup() {
  const values = new Map([['dari.auth.v1', 'untouched-real-session'], ['dari.question-translations.v1', 'untouched-guest-draft']]);
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
  let exits = 0;
  const options = { development: true, language: 'ko', storage, onExit: () => exits++ };
  return { values, options, get exits() { return exits; }, sandbox: createDevSupervisor(options) };
}

test('the fixed supervisor is a ready local administrator, never a production session', () => {
  const { options, sandbox, values } = setup();
  assert.throws(() => createDevSupervisor({ ...options, development: false }), /disabled/);
  assert.equal(sandbox.account().profile.user_id, SUPERVISOR_ID);
  assert.equal(sandbox.account().profile.nickname, 'Supervisor');
  assert.deepEqual(onboardingNeeds(sandbox.account()), []);
  assert.ok(canVerifyBadges(sandbox.account().roles));
  assert.equal(values.get('dari.auth.v1'), 'untouched-real-session');
});

test('community posts, comments and reactions persist only in the local test store', async () => {
  const { options, sandbox, values } = setup(); const api = sandbox.community;
  const sample = (await api.listPosts('qna'))[0];
  await api.createComment(SUPERVISOR_ID, sample.id, '가상 테스트 댓글', 'ko');
  assert.equal((await api.getPost(sample.id)).comment_count, 2);
  await api.setHelpful(SUPERVISOR_ID, sample.id, true);
  assert.equal((await api.getPost(sample.id)).helpful_count, 1);
  await api.setHelpful(SUPERVISOR_ID, sample.id, false);
  assert.equal((await api.getPost(sample.id)).helpful_count, 0);
  const id = await api.createPost(SUPERVISOR_ID, { board: 'notice', title: '테스트 공지', body: '가상 공지 내용', language: 'ko' });
  const restored = createDevSupervisor(options);
  assert.equal((await restored.community.getPost(id)).title, '테스트 공지');
  assert.equal((await restored.community.listComments(sample.id)).length, 2);
  assert.ok(values.has(SUPERVISOR_DATA_KEY));
  assert.equal(values.get('dari.auth.v1'), 'untouched-real-session');
  assert.equal(values.get('dari.question-translations.v1'), 'untouched-guest-draft');
});

test('report, blocking and own-content deletion behave without granting authority over other authors', async () => {
  const { sandbox } = setup(); const api = sandbox.community;
  const sample = (await api.listPosts('qna'))[0];
  await assert.rejects(api.deleteOwn('post', sample.id), /another member/);
  await assert.rejects(api.createPost('spoofed-user', { board: 'notice', title: 'test', body: 'test', language: 'en' }), /identity/);
  await api.report(SUPERVISOR_ID, 'post', sample.id, 'spam', '테스트 신고');
  await assert.rejects(api.report(SUPERVISOR_ID, 'post', sample.id, 'spam', ''), { code: '23505' });
  const own = await api.createPost(SUPERVISOR_ID, { board: 'qna', title: '테스트 글', body: '테스트 본문', language: 'ko' });
  await api.deleteOwn('post', own); assert.equal(await api.getPost(own), null);
  await api.block(SUPERVISOR_ID, sample.author_id); assert.equal(await api.getPost(sample.id), null);
  assert.deepEqual(await api.listPosts('qna'), []);
});

test('profile changes, sample badge verification and logout stay inside the test account', async () => {
  const fixture = setup(); const api = fixture.sandbox.platform;
  await api.updateNickname(SUPERVISOR_ID, '테스트 운영자');
  assert.equal((await api.loadAccount(SUPERVISOR_ID, '')).profile.nickname, '테스트 운영자');
  await assert.rejects(api.loadAccount('another-account', ''), /identity/);
  assert.equal((await api.requestBadgeCode('recognized_refugee')).code, '654321');
  await assert.rejects(api.grantBadge('654321'), /yourself/);
  await assert.rejects(api.grantBadge('999999'), /invalid/);
  assert.equal(await api.grantBadge('123456'), '가상 회원');
  assert.deepEqual((await fixture.sandbox.community.getPost('sample-question')).author_badges, ['recognized_refugee']);
  await api.signOut(); assert.equal(fixture.exits, 1);
  await api.deleteAccount(); assert.equal(fixture.exits, 2);
  assert.equal(fixture.values.has(SUPERVISOR_DATA_KEY), false);
  assert.equal(fixture.values.get('dari.auth.v1'), 'untouched-real-session');
});
