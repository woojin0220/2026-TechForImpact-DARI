import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createSession, appendAssistantMessage, answerScripted, applyFormAnswers, getActiveFacts,
  buildQuestion14Answers, formatFormAnswer,
} from '../src/intake/index.ts';
import { takesOtherText, koreanChoiceText } from '../src/form/otherChoice.ts';
import { applicationSteps } from '../src/form/schema.ts';
import { buildApplicationPlan } from '../src/export/plan.ts';

const field = id => applicationSteps.flatMap(step => step.fields).find(item => item.id === id);

test('기타 free text is offered only where the form has no separate box for it', () => {
  assert.equal(takesOtherText('1.6', field('1.6').options), true);
  assert.equal(takesOtherText('11.8', field('11.8').options), true);
  // 1.13-other, 7.5-other and 9.10-other are their own boxes on the form.
  assert.equal(takesOtherText('1.13-fluent', field('1.13-fluent').options), false);
  assert.equal(takesOtherText('7.5', field('7.5').options), false);
  assert.equal(takesOtherText('1.1', field('1.1').options), false);
});

test('form choice keeps the applicant’s 기타 wording verbatim and a change supersedes the fact', () => {
  let session = applyFormAnswers(createSession('ko'), { '11.8': { kind: 'choice', values: ['savings', 'other'], other: '교회 지원' } });
  let fact = getActiveFacts(session).find(item => item.requirementId === '11.8');
  assert.deepEqual(fact.value, ['savings', 'other']);
  assert.equal(fact.otherText, '교회 지원');
  assert.match(fact.sourceQuotes[0].quote, /기타\(교회 지원\)/);
  session = applyFormAnswers(session, { '11.8': { kind: 'choice', values: ['savings', 'other'], other: '친구 도움' } });
  const next = getActiveFacts(session).find(item => item.requirementId === '11.8');
  assert.notEqual(next.id, fact.id);
  assert.deepEqual(next.supersedes, [fact.id]);
  assert.equal(next.otherText, '친구 도움');
  // Deselecting 기타 drops its text; clearing the choice withdraws the fact.
  session = applyFormAnswers(session, { '11.8': { kind: 'choice', values: ['savings'], other: '친구 도움' } });
  assert.equal(getActiveFacts(session).find(item => item.requirementId === '11.8').otherText, undefined);
  session = applyFormAnswers(session, {});
  assert.equal(getActiveFacts(session).some(item => item.requirementId === '11.8'), false);
});

test('chat choice with 기타 reaches question 14 and the exported text', () => {
  let session = appendAssistantMessage(createSession('ko'), '신청 사유는?', { kind: 'field', requirementId: 'grounds.category' });
  session = answerScripted(session, { text: '정치적 의견, 기타: 성적 지향', status: 'answered', value: ['political', 'other'], other: ' 성적 지향 ' });
  const fact = getActiveFacts(session).find(item => item.requirementId === 'grounds.category');
  assert.equal(fact.otherText, '성적 지향');
  const answers = buildQuestion14Answers(session);
  assert.deepEqual(answers['14.1'], { kind: 'choice', values: ['political', 'other'], other: '성적 지향' });
  assert.equal(formatFormAnswer(field('14.1'), answers['14.1']), koreanChoiceText(field('14.1').options, ['political', 'other'], '성적 지향'));
  assert.match(formatFormAnswer(field('14.1'), answers['14.1']), /기타\(성적 지향\)$/);
  const plan = buildApplicationPlan({ ...session, question14: answers }, true);
  assert.match(plan.entries.find(entry => entry.field.id === '14.1').text, /기타\(성적 지향\)/);
});

test('a choice can be answered again: the new choice supersedes and an invalid choice is rejected', () => {
  let session = appendAssistantMessage(createSession('ko'), '신청 사유는?', { kind: 'field', requirementId: 'grounds.category' });
  session = answerScripted(session, { text: '종교', status: 'answered', value: ['religion'] });
  const first = getActiveFacts(session).find(item => item.requirementId === 'grounds.category');
  session = appendAssistantMessage(session, '신청 사유는?', { kind: 'field', requirementId: 'grounds.category' });
  session = answerScripted(session, { text: '정치적 의견', status: 'answered', value: ['political'], other: '무시됨' });
  const second = getActiveFacts(session).find(item => item.requirementId === 'grounds.category');
  assert.deepEqual(second.supersedes, [first.id]);
  assert.equal(second.otherText, undefined, '기타 text without the 기타 option is not stored');
  session = appendAssistantMessage(session, '신청 사유는?', { kind: 'field', requirementId: 'grounds.category' });
  assert.throws(() => answerScripted(session, { text: '?', status: 'answered', value: ['made-up'] }));
});
