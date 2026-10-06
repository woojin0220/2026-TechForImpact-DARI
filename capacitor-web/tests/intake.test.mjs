import assert from 'node:assert/strict';
import test from 'node:test';
import { applicationSteps } from '../src/form/schema.ts';
import { createSession, advanceConversation, continueConversation, generateDraft, getActiveFacts, getProgress, requirementCatalog, calculateCoverage, IntakeError, exportSession, confirmFacts } from '../src/intake/index.ts';

function fact(requirementId, value, quote, overrides = {}) {
  return { requirementId, value, sourceIds: ['message-2'], sourceQuotes: [{ sourceId: 'message-2', quote }], status: 'answered', certainty: 'exact', knowledge: 'direct', ...overrides };
}
function response(facts, reply = '그때 어떤 일이 있었나요?') { return JSON.stringify({ reply, facts }); }
function reviewed(session) {
  const conflicts = new Set(calculateCoverage(session).filter(item => item.status === 'conflict').map(item => item.requirementId));
  return confirmFacts(session, getActiveFacts(session).filter(fact => fact.status !== 'conflict' && !conflicts.has(fact.requirementId)).map(fact => fact.id));
}
async function sessionWith(facts, source = '경찰이 왔지만 날짜는 기억나지 않습니다.') {
  return advanceConversation(createSession('ko'), source, async () => response(facts));
}

test('catalog covers every official schema field and every repeating table column', () => {
  const ids = new Set(requirementCatalog.map(item => item.id));
  assert.equal(ids.size, requirementCatalog.length);
  for (const field of applicationSteps.flatMap(step => step.fields)) {
    assert.ok(ids.has(field.id), field.id);
    for (const column of field.columns ?? []) assert.ok(ids.has(`${field.id}.${column.id}`));
  }
  assert.equal(requirementCatalog.find(item => item.id === 'submission.signature').collection, 'personal_confirmation');
});

test('model errors preserve immutable source and retry does not duplicate the answer', async () => {
  const original = createSession('ko');
  let saved;
  await assert.rejects(advanceConversation(original, '날짜는 기억나지 않습니다.', async () => 'not JSON'), error => {
    assert.ok(error instanceof IntakeError);
    saved = error.session;
    assert.equal(saved.messages.at(-1).content, '날짜는 기억나지 않습니다.');
    return true;
  });
  assert.equal(original.messages.length, 1);
  const retried = await continueConversation(saved, async () => response([]));
  assert.equal(retried.messages.filter(item => item.role === 'user').length, 1);
});

test('assistant text and invented quote cannot become applicant facts', async () => {
  await assert.rejects(sessionWith([fact('14.1-detail', 'fabricated', '경찰이 체포했습니다.')]), /원문/);
  await assert.rejects(sessionWith([fact('14.1-detail', 'fabricated', '신청서', { sourceIds: ['message-1'], sourceQuotes: [{ sourceId: 'message-1', quote: '신청서' }] })]), /원문/);
});

test('conditional details do not become applicable before an explicit yes and unknown is not complete', async () => {
  const initial = createSession('ko');
  assert.equal(initial.coverage.find(item => item.requirementId === '14.2-detail').status, 'blocked');
  const session = await sessionWith([fact('14.2', 'no', '박해받은 적 없습니다.')], '박해받은 적 없습니다.');
  assert.equal(session.coverage.find(item => item.requirementId === '14.2-detail.time').status, 'not_applicable');
  const unknown = await sessionWith([fact('14.1-detail', '기억나지 않습니다', '기억나지 않습니다', { status: 'unknown' })]);
  assert.equal(unknown.coverage.find(item => item.requirementId === '14.1-detail').status, 'unknown');
  assert.equal(getProgress(unknown).complete, false);
});

test('explicit correction creates history; contradictory answer without correction needs clarification', async () => {
  const first = await sessionWith([fact('14.1-detail', '경찰이 왔습니다.', '경찰이 왔')]);
  const latest = fact('14.1-detail', '경찰이 아니었습니다.', '경찰이 아니었습니다.', { sourceIds: ['message-4'], sourceQuotes: [{ sourceId: 'message-4', quote: '경찰이 아니었습니다.' }] });
  const conflict = await advanceConversation(first, '경찰이 아니었습니다.', async () => response([latest]));
  assert.equal(conflict.coverage.find(item => item.requirementId === '14.1-detail').status, 'conflict');
  const corrected = await advanceConversation(first, '경찰이 아니었습니다.', async () => response([{ ...latest, supersedes: ['fact-1'] }]));
  assert.equal(corrected.facts.length, 2);
  assert.equal(getActiveFacts(corrected).length, 1);
  assert.equal(corrected.facts[0].value, '경찰이 왔습니다.');
  assert.equal(getActiveFacts(corrected)[0].value, '경찰이 아니었습니다.');
});

test('repeated identical extraction does not inflate metadata', async () => {
  const first = await sessionWith([fact('14.1-detail', '경찰이 왔습니다.', '경찰이 왔')]);
  const next = await advanceConversation(first, '네.', async () => response([fact('14.1-detail', '경찰이 왔습니다.', '경찰이 왔')]));
  assert.equal(next.facts.length, 1);
  assert.equal(next.messages.filter(item => item.role === 'user').length, 2);
});

test('each distinct incident needs its own metadata fields', async () => {
  const session = await sessionWith([
    fact('14.2', 'yes', '경찰이 왔'),
    fact('14.2-detail.event', '첫 사건', '경찰이 왔', { eventId: 'incident-1' }),
    fact('14.2-detail.event', '둘째 사건', '경찰이 왔', { eventId: 'incident-2' }),
    fact('14.2-detail.time', '날짜는 기억나지 않습니다.', '날짜는 기억나지 않습니다.', { eventId: 'incident-1' }),
  ]);
  assert.equal(calculateCoverage(session).find(item => item.requirementId === '14.2-detail.time').status, 'missing');
});

test('a broad no with substantive conditional detail is flagged, not silently discarded', async () => {
  const session = await sessionWith([
    fact('14.2', 'no', '경찰이 왔'),
    fact('14.2-detail.event', '경찰이 왔습니다.', '경찰이 왔', { eventId: 'incident-1' }),
  ]);
  assert.equal(session.coverage.find(item => item.requirementId === '14.2').status, 'conflict');
  assert.throws(() => confirmFacts(session, ['fact-1']), /현재 확인/);
  assert.equal(session.coverage.find(item => item.requirementId === '14.2-detail.event').status, 'blocked');
  const drafted = await generateDraft(reviewed(session), async request => {
    const input = JSON.parse(request.prompt);
    assert.ok(input.facts.some(item => item.requirementId === '14.2-detail.event'));
    assert.ok(!input.facts.some(item => item.requirementId === '14.2'));
    return JSON.stringify({ sections: [{ questionId: '14.2', sentences: [{ text: '경찰이 왔습니다.', factIds: ['fact-2'], sourceIds: ['message-2'] }] }] });
  });
  assert.equal(drafted.draft.length, 1);
});

test('not-mentioned placeholder is left missing instead of attributed to applicant uncertainty', async () => {
  const session = await sessionWith([
    fact('14.3', 'yes', '돌아가면 조사가 두렵습니다.'),
    fact('14.3-detail.actor', '(미언급)', '돌아가면 조사가 두렵습니다.', { status: 'unknown', certainty: 'uncertain', knowledge: 'unspecified' }),
  ], '돌아가면 조사가 두렵습니다.');
  assert.equal(session.coverage.find(item => item.requirementId === '14.3-detail.actor').status, 'missing');
  assert.equal(getActiveFacts(session).length, 1);
});

test('unknown dates remain draftable as explicit uncertainty, with source/fact links', async () => {
  const session = await sessionWith([
    fact('14.2', 'yes', '경찰이 왔'),
    fact('14.2-detail.time', '날짜는 기억나지 않습니다.', '날짜는 기억나지 않습니다.', { eventId: 'incident-1', status: 'unknown', certainty: 'uncertain' }),
  ]);
  const drafted = await generateDraft(reviewed(session), async request => {
    const input = JSON.parse(request.prompt);
    assert.ok(input.facts.some(item => item.status === 'unknown'));
    return JSON.stringify({ sections: [{ questionId: '14.2', sentences: [{ text: '경찰이 왔지만 정확한 날짜는 기억나지 않습니다.', factIds: ['fact-2', 'fact-1'], sourceIds: ['message-2'] }] }] });
  });
  assert.equal(drafted.draft[0].sentences[0].factIds[0], 'fact-2');
  const exported = JSON.parse(exportSession(drafted));
  assert.equal(exported.source[1].content, session.messages[1].content);
  assert.equal(exported.draft.language, 'ko');
});

test('draft rejects invented fact IDs and cross-question references', async () => {
  const session = await sessionWith([fact('14.1-detail', '경찰이 왔습니다.', '경찰이 왔')]);
  await assert.rejects(generateDraft(reviewed(session), async () => JSON.stringify({ sections: [{ questionId: '14.1', sentences: [{ text: '경찰이 왔습니다.', factIds: ['fact-99'], sourceIds: ['message-2'] }] }] })), /근거/);
});

test('draft rejects a bare yes and omission of confirmed narrative facts', async () => {
  const session = reviewed(await sessionWith([
    fact('14.2', 'yes', '경찰이 왔'),
    fact('14.2-detail.event', '경찰이 왔습니다.', '경찰이 왔', { eventId: 'incident-1' }),
  ]));
  await assert.rejects(generateDraft(session, async () => JSON.stringify({ sections: [{ questionId: '14.2', sentences: [{ text: '예', factIds: ['fact-1', 'fact-2'], sourceIds: ['message-2'] }] }] })), /선택형 답변/);
  await assert.rejects(generateDraft(session, async () => JSON.stringify({ sections: [{ questionId: '14.2', sentences: [{ text: '경찰이 왔습니다.', factIds: ['fact-1'], sourceIds: ['message-2'] }] }] })), /누락/);
});

test('draft repair is bounded and fixes missing provenance through the model, not invented links', async () => {
  const session = reviewed(await sessionWith([
    fact('14.2', 'yes', '경찰이 왔'),
    fact('14.2-detail.event', '경찰이 왔습니다.', '경찰이 왔', { eventId: 'incident-1' }),
  ]));
  let calls = 0;
  const draft = await generateDraft(session, async request => {
    calls += 1;
    if (calls === 2) assert.match(JSON.parse(request.prompt).correction, /fact-2/);
    return JSON.stringify({ sections: [{ questionId: '14.2', sentences: [{ text: '경찰이 왔습니다.', factIds: calls === 1 ? ['fact-1'] : ['fact-1', 'fact-2'], sourceIds: ['message-2'] }] }] });
  });
  assert.equal(calls, 2);
  assert.equal(draft.draft[0].factIds.length, 2);
  calls = 0;
  await assert.rejects(generateDraft(session, async () => { calls += 1; return '{}'; }), /문항 목록/);
  assert.equal(calls, 2);
});

test('draft generation requires explicit review and newly corrected facts need review again', async () => {
  const session = await sessionWith([fact('14.1-detail', '경찰이 왔습니다.', '경찰이 왔')]);
  let called = false;
  await assert.rejects(generateDraft(session, async () => { called = true; return ''; }), /먼저 확인/);
  assert.equal(called, false);
  assert.equal(getActiveFacts(reviewed(session))[0].confirmed, true);
  const corrected = await advanceConversation(reviewed(session), '경찰이 아니었습니다.', async () => response([fact('14.1-detail', '경찰이 아니었습니다.', '경찰이 아니었습니다.', { sourceIds: ['message-4'], sourceQuotes: [{ sourceId: 'message-4', quote: '경찰이 아니었습니다.' }], supersedes: ['fact-1'] })]));
  assert.equal(getActiveFacts(corrected)[0].confirmed, false);
});

test('full scope routes dynamically and passes a focused schema within the prompt budget', async () => {
  let calls = 0;
  const session = await advanceConversation(createSession('ko', 'full'), '현재 직업은 교사입니다.', async request => {
    calls += 1;
    assert.ok(request.prompt.length <= 26000);
    if (calls === 1) {
      assert.ok(JSON.parse(request.prompt).catalog.some(item => item[0] === '1.8'));
      return JSON.stringify({ requirementIds: ['1.8'] });
    }
    assert.deepEqual(JSON.parse(request.prompt).requirements.map(item => item.id), ['1.8']);
    return response([fact('1.8', '교사', '교사')]);
  });
  assert.equal(calls, 2);
  assert.equal(getActiveFacts(session)[0].requirementId, '1.8');
});
