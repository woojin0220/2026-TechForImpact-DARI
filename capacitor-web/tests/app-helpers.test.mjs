import test from 'node:test';
import assert from 'node:assert/strict';
import { appendUserMessage, createSession, formPageOf, metadataGroups, nextStep } from '../src/intake/index.ts';
import { scriptedCopy } from '../src/intakeCopy.ts';
import { factValue, isDraftFieldShown, koreanValue, pickedText, questionText, requirementLabel } from '../src/app/labels.ts';
import { factGroups, sentenceOrigins, syncConversation, topicOf } from '../src/app/review.ts';

const sc = scriptedCopy.ko;
const fact = (id, requirementId, value, extra = {}) => ({ id, requirementId, value, sourceIds: [], sourceQuotes: [], status: 'answered', certainty: 'certain', knowledge: 'direct', confirmed: false, ...extra });

test('labels fall back to the id and keep 기타 text verbatim', () => {
  assert.equal(requirementLabel('no-such-requirement', 'ko'), 'no-such-requirement');
  assert.equal(factValue('11.3', ['other'], 'ko', '직접 쓴 내용'), '기타: 직접 쓴 내용');
  assert.equal(factValue('11.3', 'free text', 'ko'), 'free text');
  const options = [{ value: 'a', ko: '가', en: 'A' }, { value: 'other', ko: '기타', en: 'Other' }];
  assert.equal(pickedText(options, ['a', 'other'], 'en', '  mine  '), 'A, Other: mine');
  assert.equal(pickedText(options, ['other'], 'en'), 'Other');
});

test('a Korean value carries its status unless it is a plain answer', () => {
  assert.equal(koreanValue(fact('f', '1.2', '홍')), '홍');
  assert.match(koreanValue(fact('f', '1.2', '홍', { status: 'unknown' })), /^.+ \(홍\)$/);
});

test('scripted questions name the row and the table prompt', () => {
  const label = requirementLabel('2-table', 'ko');
  assert.equal(questionText({ kind: 'table', requirementId: '2-table' }, 'ko', sc), `${label} — ${sc.tableAsk}`);
  assert.equal(questionText({ kind: 'field', requirementId: '1.2' }, 'ko', sc, 2), `${sc.row.replace('{n}', '2')} · ${requirementLabel('1.2', 'ko')}`);
});

test('the short test only drafts question 14.1 to 14.3', () => {
  const field = id => ({ id, ko: '', en: '', type: 'text' });
  assert.equal(isDraftFieldShown(field('14.4'), {}, 'test'), false);
  assert.equal(isDraftFieldShown(field('14.2'), {}, 'test'), true);
  assert.equal(isDraftFieldShown(field('14.4'), {}, 'full'), true);
});

test('fact groups put story topics before form pages and split incidents', () => {
  const topic = metadataGroups.find(group => group.id === 'harm');
  const groups = factGroups([
    fact('a', '1.2', '홍'),
    fact('b', `${topic.id}.event`, '첫 사건', { eventId: 'e1' }),
    fact('c', `${topic.id}.event`, '둘째 사건', { eventId: 'e2' }),
  ], 'ko');
  assert.equal(groups[0].key, topic.id);
  assert.equal(groups[0].story, true);
  assert.deepEqual(groups[0].events.map(event => event.eventId), ['e1', 'e2']);
  assert.equal(groups[1].key, `form-${formPageOf('1.2')}`);
  assert.equal(topicOf(`${topic.id}.event`)?.id, topic.id);
});

test('sentence origins quote only the applicant, never form entries', () => {
  let session = appendUserMessage(createSession('ko', 'full'), '제가 겪은 일입니다.');
  const message = session.messages.at(-1);
  session = { ...session, facts: [fact('q', '1.2', 'x', { sourceQuotes: [{ sourceId: message.id, quote: '제가 겪은 일' }, { sourceId: 'form', quote: '양식' }] })] };
  assert.deepEqual(sentenceOrigins(session, { sentences: [{ text: '문장', factIds: ['q'], sourceIds: [] }] }), [{ text: '문장', quotes: ['제가 겪은 일'] }]);
});

test('syncing the conversation opens the story once and does not repeat it', () => {
  const session = createSession('ko', 'full');
  assert.equal(nextStep(session).kind, 'narrative');
  const opened = syncConversation(session, 'ko', sc);
  assert.equal(opened.messages.at(-1).ask.kind, 'narrative');
  assert.equal(syncConversation(opened, 'ko', sc), opened);
  const answered = appendUserMessage(opened, '이야기');
  assert.equal(syncConversation(answered, 'ko', sc).messages.at(-1).content, sc.resume);
});
