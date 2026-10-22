import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createSession, advanceConversation, getActiveFacts, calculateCoverage,
  deriveQuestion14, buildQuestion14Answers, appendUserMessage, applyFormAnswers,
  exportSession, appendAssistantMessage, answerScripted, setAuxiliaryPasses, setExtractionFormat,
} from '../src/intake/index.ts';

// These tests mock full-format model output and the always-on auxiliary passes; the compact
// default is expanded into the same facts before the same validation (see the compact tests).
setExtractionFormat('full');
setAuxiliaryPasses('on');

const fact = (requirementId, value, quote, sourceId = 'message-2', eventId) => ({
  requirementId, value, sourceIds: [sourceId], sourceQuotes: [{ sourceId, quote }],
  status: 'answered', certainty: 'exact', knowledge: 'direct', supersedes: [], eventId,
});
const adapter = facts => async () => JSON.stringify({ reply: '알겠습니다.', facts });
const drafted = session => ({ ...session, draftRevision: 1,
  draft: [{ questionId: '14.2', text: '정정 전 초안', sentences: [], factIds: [], sourceIds: [] }],
  question14: { '14.2-detail': { kind: 'text', text: '직접 편집한 이전 초안' } },
});

test('P1 conflicting yes/no stays unresolved in derived and editable application', async () => {
  for (const values of [['yes', 'no'], ['no', 'yes']]) {
    let session = await advanceConversation(createSession('ko'), '첫 답변', adapter([fact('harm', values[0], '첫 답변')]));
    session = await advanceConversation(session, '다른 답변', adapter([fact('harm', values[1], '다른 답변', 'message-4')]));
    assert.equal(calculateCoverage(session).find(item => item.requirementId === 'harm').status, 'conflict');
    assert.equal(deriveQuestion14(session).find(item => item.id === '14.2').needsReview, true);
    assert.equal(buildQuestion14Answers(session)['14.2'], undefined);
  }
});

test('P1 explicit multi-choice correction removes denied harm without model supersedes', async () => {
  let session = await advanceConversation(createSession('ko'), '폭행과 위협을 받았습니다', adapter([
    fact('harm.type', ['assault', 'threat'], '폭행과 위협을 받았습니다', 'message-2', 'e1'),
  ]));
  const old = getActiveFacts(session).find(item => item.requirementId === 'harm.type');
  session = await advanceConversation(session, '폭행은 아니고 위협만 받았습니다', adapter([
    fact('harm.type', ['threat'], '폭행은 아니고 위협만 받았습니다', 'message-4', 'e1'),
  ]));
  const active = getActiveFacts(session).filter(item => item.requirementId === 'harm.type');
  assert.equal(active.length, 1);
  assert.deepEqual(active[0].value, ['threat']);
  assert.deepEqual(active[0].supersedes, [old.id]);
  assert.equal(active[0].confirmed, false);
  assert.ok(session.facts.includes(old));
});

test('P1 same-turn refinements and subsequent writers never reuse a stored fact ID', async () => {
  let session = await advanceConversation(createSession('ko'), '정치적 의견. 3월. 정치적 의견 때문에 신청합니다.', adapter([
    fact('grounds.summary', '정치적 의견', '정치적 의견'),
    fact('harm.time', '3월', '3월', 'message-2', 'e1'),
    fact('grounds.summary', '정치적 의견 때문에 신청합니다.', '정치적 의견 때문에 신청합니다.'),
  ]));
  assert.equal(new Set(session.facts.map(item => item.id)).size, session.facts.length);
  session = applyFormAnswers(session, { '1.2': { kind: 'text', text: '가상' } });
  session = appendAssistantMessage(session, '출국 날짜는?', { kind: 'field', requirementId: 'departure.date' });
  session = answerScripted(session, { text: '2025/04/01', status: 'answered' });
  assert.equal(new Set(session.facts.map(item => item.id)).size, session.facts.length);
  const byId = new Map(session.facts.map(item => [item.id, item]));
  for (const entry of calculateCoverage(session)) {
    for (const id of entry.factIds) assert.equal(byId.get(id).requirementId, entry.requirementId);
  }
});

test('P1 new source invalidates generated and editable drafts before inference, including errors', async () => {
  const original = drafted(createSession('ko'));
  const next = appendUserMessage(original, '날짜를 4월로 정정합니다');
  assert.deepEqual(next.draft, []);
  assert.equal(next.question14, undefined);
  assert.equal(next.draftRevision, 0);
  const saved = JSON.parse(exportSession(next));
  assert.equal(saved.question14, undefined);
  assert.deepEqual(saved.draft.sections, []);
  await assert.rejects(advanceConversation(original, '정정합니다', async () => { throw new Error('offline'); }), error => {
    assert.equal(error.session.question14, undefined);
    assert.equal(error.session.draftRevision, 0);
    return true;
  });
  assert.equal(original.draftRevision, 1);
});

test('P1 changed or cleared form answers invalidate drafts; unchanged form preserves them', () => {
  const initial = { '1.2': { kind: 'text', text: '가상' } };
  const session = drafted(applyFormAnswers(createSession('ko', 'full'), initial));
  assert.equal(applyFormAnswers(session, initial).draftRevision, 1);
  for (const answers of [{ '1.2': { kind: 'text', text: '수정' } }, {}]) {
    const next = applyFormAnswers(session, answers);
    assert.equal(next.question14, undefined);
    assert.equal(next.draftRevision, 0);
    assert.deepEqual(next.draft, []);
  }
});
