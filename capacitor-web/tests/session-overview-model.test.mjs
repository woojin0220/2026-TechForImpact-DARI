import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSessionOverview } from '../src/sessionOverview/model.ts';
import { createSession } from '../src/intake/index.ts';
import { formSteps } from '../src/intake/form.ts';
import { createDocument, addUserMessage, addAssistantMessage } from '../src/revision/state.mjs';

const fact = (id, requirementId, value, extra = {}) => ({ id, requirementId, value,
  sourceIds: ['unlinked-source'], sourceQuotes: [{ sourceId: 'unlinked-source', quote: 'Original spelling and uncertainty.' }],
  status: 'answered', certainty: 'uncertain', knowledge: 'heard', confirmed: false, ...extra });
const message = (id, role, content, ask) => ({ id, role, content, createdAt: '2026-11-05T00:00:00Z', ...(ask ? { ask } : {}) });
const flattenFacts = groups => groups.flatMap(group => group.facts);
const flattenMessages = groups => groups.flatMap(group => group.messages);
function freeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(freeze);
  }
  return value;
}

test('all stored form values survive including hidden fields, empty tables, row cells and unknown future fields', () => {
  const session = createSession('ko', 'full');
  const hidden = formSteps.flatMap(step => step.fields).find(field => field.when?.length);
  assert.ok(hidden, 'fixture must use a real conditional form field');
  session.form = {
    '1.2': { kind: 'text', text: '  Original spelling  ' },
    [hidden.id]: { kind: 'text', text: 'Stored before the condition changed' },
    'future-table': { kind: 'table', rows: [{ place: 'First town', note: '' }, {}, { date: 'Unknown day' }] },
    'empty-table': { kind: 'table', rows: [] },
    'future-choice': { kind: 'choice', values: ['no', 'unknown-option'] },
    'future-status': { kind: 'status', status: 'not_applicable' },
    'future-unknown': { kind: 'status', status: 'unknown' },
    'future-empty-text': { kind: 'text', text: '' },
  };
  const result = buildSessionOverview(session);
  assert.equal(result.forms.length, Object.keys(session.form).length);
  assert.equal(result.counts.formValues, result.forms.length);
  for (const [id, answer] of Object.entries(session.form)) {
    const item = result.forms.find(item => item.fieldId === id);
    assert.ok(item, id);
    assert.deepEqual(item.value, answer, id);
    assert.deepEqual(item.target, { kind: 'form', fieldId: id });
  }
  assert.equal(result.forms.find(item => item.fieldId === hidden.id).visible, false);
  assert.equal(result.forms.find(item => item.fieldId === '1.2').page, 0);
});

test('current confirmations and conflicting answers remain distinct from superseded and withdrawn records', () => {
  const session = createSession('ar', 'priority');
  session.facts = [
    fact('old', 'harm.event', 'First wording', { confirmed: true }),
    fact('new', 'harm.event', 'Corrected wording', { supersedes: ['old'], eventId: 'incident-1' }),
    fact('confirmed', 'fear.harm', 'Return concern', { confirmed: true, eventId: 'incident-1' }),
    fact('conflict', 'harm.event', 'Unresolved competing answer', { status: 'conflict', eventId: 'incident-2' }),
    fact('withdrawn', '1.2', 'Cleared name', { confirmed: true }),
    fact('future', 'future.unrecognized', 'Unmapped entered answer'),
  ];
  session.withdrawnFacts = ['withdrawn'];
  const result = buildSessionOverview(session);
  assert.deepEqual(flattenFacts(result.facts).map(item => item.id).sort(), ['confirmed', 'conflict', 'future', 'new']);
  assert.deepEqual(flattenFacts(result.historyFacts).map(item => item.id).sort(), ['old', 'withdrawn']);
  const all = [...flattenFacts(result.facts), ...flattenFacts(result.historyFacts)];
  assert.equal(all.length, session.facts.length);
  assert.deepEqual(all.find(item => item.id === 'confirmed'), session.facts[2]);
  assert.equal(all.find(item => item.id === 'new').confirmed, false);
  assert.equal(all.find(item => item.id === 'conflict').status, 'conflict');
  assert.ok(result.facts.some(group => group.topicId === 'harm' && group.eventId === 'incident-2'));
  assert.equal(result.counts.facts, 4);
  assert.equal(result.counts.historyFacts, 2);
});

test('all transcript messages appear exactly once, including orphan, failed, repeated and post-closing messages', () => {
  const session = createSession('en', 'full');
  session.messages = [
    message('orphan', 'user', '  This answer failed before extraction.\nKeep the whole original.  '),
    message('q1', 'assistant', 'Name?', { kind: 'field', requirementId: '1.2' }),
    message('a1', 'user', 'Name given'),
    message('q2', 'assistant', 'What happened?', { kind: 'narrative', topics: ['harm'] }),
    message('a2', 'user', 'I do not remember the date.'),
    message('reply', 'assistant', 'Neutral reply without an ask object.'),
    message('q3', 'assistant', 'What happened?', { kind: 'narrative', topics: ['fear', 'harm'] }),
    message('a3', 'user', 'Repeated answer remains a separate message.'),
    message('done', 'assistant', 'Completed for now.', { kind: 'done' }),
    message('later', 'user', 'An additional correction after completion.'),
  ];
  session.facts = [fact('multi-context', 'fear.harm', 'Summary', { sourceIds: ['a2'] })];
  const result = buildSessionOverview(session);
  assert.deepEqual(flattenMessages(result.messages), session.messages);
  assert.equal(new Set(flattenMessages(result.messages).map(item => item.id)).size, session.messages.length);
  assert.equal(result.counts.messages, session.messages.length);
  assert.equal(result.messages.length, 5);
  const story = result.messages.find(group => group.messages.some(item => item.id === 'a2'));
  assert.ok(story.topicIds.includes('harm'));
  assert.ok(story.topicIds.includes('fear'));
  assert.ok(story.requirementIds.includes('fear.harm'));
  assert.deepEqual(result.messages[0].target, { kind: 'conversation', messageId: 'orphan' });
});

test('question14 edited values, generated drafts and sentence-review conversations remain separate records', () => {
  const session = createSession('ko', 'priority');
  session.question14 = {
    '14.5': { kind: 'choice', values: ['no'] },
    '14.5-yes': { kind: 'text', text: 'Earlier conditionally hidden Korean answer.' },
    '14.5-no': { kind: 'text', text: '직접 수정한 한국어 답변.' },
  };
  session.draft = [{ questionId: '14.5', text: '최초 생성한 문장.', factIds: ['f1'], sourceIds: ['s1'], sentences: [] }];
  let document = createDocument('최초 생성한 문장.', 'Synthetic review', 'ko');
  const sentence = document.pieces.find(piece => piece.kind === 'sentence');
  document = addUserMessage(document, sentence.id, '확실하지 않다는 표현을 유지해 주세요.');
  document = addAssistantMessage(document, sentence.id, { type: 'proposal', message: '검토용 설명', replacement: '확실하지 않은 문장.' }, 0);
  session.draftReviews = { '14.5-no': document };
  const result = buildSessionOverview(session);
  assert.equal(result.question14.length, 3);
  assert.equal(result.question14.find(item => item.fieldId === '14.5-yes').visible, false);
  assert.deepEqual(result.question14.find(item => item.fieldId === '14.5-no').target, { kind: 'draft', fieldId: '14.5-no' });
  assert.equal(result.drafts[0].fieldId, '14.5-no');
  assert.equal(result.drafts[0].section.text, '최초 생성한 문장.');
  assert.deepEqual(result.reviews[0].document, document);
  assert.equal(result.counts.reviewMessages, 2);
  assert.equal(result.counts.question14Values, 3);
});

test('building an overview neither mutates, confirms nor advances an immutable session', () => {
  const session = createSession('en', 'full');
  session.form = { '1.2': { kind: 'text', text: 'Synthetic name' } };
  session.messages = [message('input', 'user', 'Exact original text')];
  session.facts = [fact('one', 'harm.event', 'Candidate wording')];
  const snapshot = JSON.stringify(session);
  freeze(session);
  const result = buildSessionOverview(session);
  assert.equal(JSON.stringify(session), snapshot);
  assert.equal(result.facts[0].facts[0].confirmed, false);
  assert.notEqual(result.messages[0].messages, session.messages);
});
