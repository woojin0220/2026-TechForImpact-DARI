import test from 'node:test';
import assert from 'node:assert/strict';
import { createSession, appendAssistantMessage, appendUserMessage } from '../src/intake/index.ts';
import { createDocument } from '../src/revision/state.mjs';
import { WORKING_COPY_KEY, readWorkingCopy, writeWorkingCopy, clearWorkingCopy } from '../src/workingCopy.ts';

function storage() {
  const values = new Map();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
}
function workingCopy() {
  let session = createSession('en', 'test');
  session = appendAssistantMessage(session, 'Tell us your story.', { kind: 'narrative' });
  session = appendUserMessage(session, 'I am not certain who they were.');
  return { version: 1, session, language: 'en', stage: 'conversation', formPage: 0, input: 'An unsent answer', picked: [], demo: false, finalReviewedText: '', output: 'draft', pendingTask: null };
}

test('refresh restores original messages, unsent text, form edits and approved wording history', () => {
  const saved = workingCopy();
  saved.session.form['1.1'] = { kind: 'text', text: 'My name' };
  saved.session.question14 = { '14.1-detail': { kind: 'text', text: '사용자가 수정한 한국어 문장.' } };
  saved.session.draftReviews = { '14.1-detail': createDocument('사용자가 수정한 한국어 문장.') };
  saved.picked = ['one', 'two'];
  saved.finalReviewedText = 'exact review key';
  const db = storage();
  assert.equal(writeWorkingCopy(saved, () => db), true);
  const loaded = readWorkingCopy(() => db);
  assert.deepEqual(loaded.work, saved);
  assert.equal(loaded.problem, undefined);
});

test('an interrupted model request is retained as pending data for explicit resumption', () => {
  const saved = { ...workingCopy(), pendingTask: 'intake' };
  const db = storage();
  writeWorkingCopy(saved, () => db);
  assert.equal(readWorkingCopy(() => db).work.pendingTask, 'intake');
  assert.equal(readWorkingCopy(() => db).work.session.messages.at(-1).role, 'user');
});

test('bad JSON, unsupported versions and malformed nested messages are rejected without deleting the record', () => {
  const db = storage();
  for (const raw of ['{broken', JSON.stringify({ ...workingCopy(), version: 99 }), JSON.stringify({ ...workingCopy(), session: { ...workingCopy().session, messages: [null] } })]) {
    db.setItem(WORKING_COPY_KEY, raw);
    assert.deepEqual(readWorkingCopy(() => db), { work: null, problem: 'invalid' });
    assert.equal(db.getItem(WORKING_COPY_KEY), raw);
  }
});

test('missing optional workflow fields are populated without changing existing answers', () => {
  const saved = workingCopy();
  delete saved.session.topicAttempts;
  delete saved.session.guidedDone;
  const db = storage();
  writeWorkingCopy(saved, () => db);
  const loaded = readWorkingCopy(() => db).work;
  assert.deepEqual(loaded.session.messages, saved.session.messages);
  assert.deepEqual(loaded.session.topicAttempts, {});
  assert.equal(loaded.session.guidedDone, false);
});

test('unavailable storage and quota errors are reported while existing data remains intact', () => {
  const blocked = () => { throw new Error('Storage blocked'); };
  assert.deepEqual(readWorkingCopy(blocked), { work: null, problem: 'unavailable' });
  assert.equal(writeWorkingCopy(workingCopy(), blocked), false);
  assert.equal(clearWorkingCopy(blocked), false);
  const db = storage();
  db.setItem(WORKING_COPY_KEY, 'previous');
  db.setItem = () => { throw new Error('QuotaExceededError'); };
  assert.equal(writeWorkingCopy(workingCopy(), () => db), false);
  assert.equal(db.getItem(WORKING_COPY_KEY), 'previous');
});

test('new-session reset removes the working copy and draft navigation requires a draft', () => {
  const db = storage();
  writeWorkingCopy({ ...workingCopy(), stage: 'draft' }, () => db);
  assert.equal(readWorkingCopy(() => db).work.stage, 'facts');
  assert.equal(clearWorkingCopy(() => db), true);
  assert.deepEqual(readWorkingCopy(() => db), { work: null });
});
