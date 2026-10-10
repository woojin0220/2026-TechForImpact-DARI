import assert from 'node:assert/strict';
import test from 'node:test';
import { applicationSteps } from '../src/form/schema.ts';
import { setExtractionFormat, createSession, advanceConversation, continueConversation, generateDraft, getActiveFacts, getProgress, requirementCatalog, calculateCoverage, IntakeError, exportSession, confirmFacts, nextStep, appendAssistantMessage, answerScripted, finishNarrative, reaskQuestion, applyFormAnswers, dummyFormAnswers, deriveQuestion14, openTopic, buildQuestion14Answers, narrativeFieldFor, guideConversation, appendUserMessage, needsTopicQuestion } from '../src/intake/index.ts';

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
  for (const field of applicationSteps.flatMap(step => step.fields).filter(field => !field.id.startsWith('14'))) {
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
  await assert.rejects(sessionWith([fact('grounds.summary', 'fabricated', '경찰이 체포했습니다.')]), /원문/);
  await assert.rejects(sessionWith([fact('grounds.summary', 'fabricated', '신청서', { sourceIds: ['message-1'], sourceQuotes: [{ sourceId: 'message-1', quote: '신청서' }] })]), /원문/);
});

test('conditional details do not become applicable before an explicit yes and unknown is not complete', async () => {
  const initial = createSession('ko');
  assert.equal(initial.coverage.find(item => item.requirementId === 'harm.event').status, 'blocked');
  const session = await sessionWith([fact('harm', 'no', '박해받은 적 없습니다.')], '박해받은 적 없습니다.');
  assert.equal(session.coverage.find(item => item.requirementId === 'harm.time').status, 'not_applicable');
  const unknown = await sessionWith([fact('grounds.summary', '기억나지 않습니다', '기억나지 않습니다', { status: 'unknown' })]);
  assert.equal(unknown.coverage.find(item => item.requirementId === 'grounds.summary').status, 'unknown');
  assert.equal(getProgress(unknown).complete, false);
});

test('explicit correction creates history; contradictory answer without correction needs clarification', async () => {
  const first = await sessionWith([fact('grounds.summary', '경찰이 왔습니다.', '경찰이 왔')]);
  const latest = fact('grounds.summary', '경찰이 아니었습니다.', '경찰이 아니었습니다.', { sourceIds: ['message-4'], sourceQuotes: [{ sourceId: 'message-4', quote: '경찰이 아니었습니다.' }] });
  const conflict = await advanceConversation(first, '경찰이 아니었습니다.', async () => response([latest]));
  assert.equal(conflict.coverage.find(item => item.requirementId === 'grounds.summary').status, 'conflict');
  const corrected = await advanceConversation(first, '경찰이 아니었습니다.', async () => response([{ ...latest, supersedes: ['fact-1'] }]));
  assert.equal(corrected.facts.length, 2);
  assert.equal(getActiveFacts(corrected).length, 1);
  assert.equal(corrected.facts[0].value, '경찰이 왔습니다.');
  assert.equal(getActiveFacts(corrected)[0].value, '경찰이 아니었습니다.');
});

test('self-corrections and "I don\'t remember" are recognized in every candidate language', async () => {
  const corrections = {
    en: 'Earlier I said March, but that was wrong. It was April.',
    fr: "Tout à l'heure j'ai dit mars, mais je me suis trompé. C'était en avril.",
    ru: 'Я сказал раньше, что это был март, но ошибся. Это был апрель.',
    ar: 'قلت قبل قليل مارس، لكنني أخطأت. كان ذلك في أبريل.',
    fa: 'قبلاً گفتم مارس، اما اشتباه گفتم. آوریل بود.',
  };
  for (const [lang, text] of Object.entries(corrections)) {
    const first = await advanceConversation(createSession(lang), 'March 2025.', async () => response([fact('grounds.summary', 'March 2025', 'March 2025')]));
    // The model omitted supersedes: the applicant's own correction still replaces the old value.
    const latest = fact('grounds.summary', 'April 2025', text, { sourceIds: ['message-4'], sourceQuotes: [{ sourceId: 'message-4', quote: text }] });
    const corrected = await advanceConversation(first, text, async () => response([latest]));
    assert.equal(corrected.coverage.find(item => item.requirementId === 'grounds.summary').status, 'answered', lang);
    assert.deepEqual(getActiveFacts(corrected).map(item => item.value), ['April 2025'], lang);
  }
  const forgotten = {
    en: "I don't remember exactly when it was.", fr: 'Je ne me souviens pas exactement quand.', ru: 'Я не помню, когда именно это было.',
    ar: 'لا أتذكر متى كان ذلك بالضبط.', fa: 'دقیقاً یادم نیست کی بود.',
  };
  for (const [lang, text] of Object.entries(forgotten)) {
    const session = await advanceConversation(createSession(lang), text, async () => response([fact('grounds.summary', text, text)]));
    assert.equal(getActiveFacts(session)[0].status, 'unknown', lang);
  }
});

function fullSession(lang = 'ko') {
  return appendAssistantMessage(createSession(lang, 'full'), 'Tell me what happened.', { kind: 'narrative' });
}
const withTopicCheck = (facts) => async (request) => request.system.startsWith('List every topic') ? '{"groups":[]}' : response(facts);

test('"I don\'t know who or why" is unknown at any length for who/why details, not for narratives', async () => {
  const text = "I don't know who they were or why they did it. They beat me but I don't remember who was there.";
  const session = await advanceConversation(fullSession('en'), text, withTopicCheck([
    fact('harm.reason', "I don't know who they were or why they did it.", "I don't know who they were or why they did it.", { eventId: 'harm-1' }),
    fact('harm.event', "They beat me but I don't remember who was there.", "They beat me but I don't remember who was there.", { eventId: 'harm-1' }),
  ]));
  const status = id => getActiveFacts(session).find(item => item.requirementId === id).status;
  assert.equal(status('harm.reason'), 'unknown');
  assert.equal(status('harm.event'), 'answered', 'a described event stays testimony');
});

test('"I could not ask the police" never silently becomes a protection request, and later testimony is kept', async () => {
  const text = '경찰이 위협한 당사자라서 경찰에 도움을 요청할 수 없었습니다. 그래서 다른 도시의 삼촌 집으로 피신했습니다.';
  const [noHelp, moved] = ['경찰이 위협한 당사자라서 경찰에 도움을 요청할 수 없었습니다.', '그래서 다른 도시의 삼촌 집으로 피신했습니다.'];
  const session = await advanceConversation(fullSession(), text, withTopicCheck([
    fact('protection.no_reason', noHelp, noHelp),
    // The model mixed the move into the "yes" branch of protection.
    fact('protection.place', '다른 도시의 삼촌 집', moved, { eventId: 'protection-1' }),
    fact('protection.result', '삼촌 집으로 피신함', moved, { eventId: 'protection-1' }),
    fact('relocation', 'yes', moved),
    fact('relocation.destination', '다른 도시의 삼촌 집', moved, { eventId: 'relocation-1' }),
  ]));
  const active = getActiveFacts(session);
  // The applicant's reason for not asking decides the yes/no; the mixed-in details stay for review.
  assert.equal(active.find(item => item.requirementId === 'protection').value, 'no');
  assert.ok(active.some(item => item.requirementId === 'protection.place'), 'testimony is never silently dropped');
  assert.ok(active.some(item => item.requirementId === 'relocation.destination'));
  const box = deriveQuestion14(session).find(item => item.id === '14.5');
  assert.notEqual(box.value, '예');
  assert.equal(box.needsReview, true);
  // Without the mixed-in details the box is a plain "no", even with no explicit gate answer.
  const clean = await advanceConversation(fullSession(), text, withTopicCheck([fact('protection.no_reason', noHelp, noHelp)]));
  assert.equal(deriveQuestion14(clean).find(item => item.id === '14.5').value, '아니요');

  // A "no" from an earlier answer does not silently drop testimony given later.
  const later = '그 뒤에 경찰서에 가서 도움을 요청한 적이 한 번 있습니다.';
  const next = await advanceConversation(session, later, withTopicCheck([fact('protection.authority', '경찰서', later, { eventId: 'protection-1', sourceIds: ['message-4'], sourceQuotes: [{ sourceId: 'message-4', quote: later }] })]));
  assert.ok(getActiveFacts(next).some(item => item.requirementId === 'protection.authority'));
  assert.equal(deriveQuestion14(next).find(item => item.id === '14.5').needsReview, true);
});

test('compact extraction cites sentences by ref and expands to the same validated facts', async () => {
  setExtractionFormat('compact');
  try {
    const text = 'In autumn 2024 the police came to my house. I do not know why they came.';
    let seen;
    const adapter = async request => {
      if (request.system.startsWith('List every topic')) return '{"groups":[]}';
      seen ??= request;
      return JSON.stringify({ reply: 'What happened then?', facts: [
        { r: 'harm', v: 'yes', q: ['2.1'] },
        { r: 'harm.time', v: 'autumn 2024', c: 'a', q: ['2.1'], e: 'harm-1' },
        { r: 'harm.reason', s: 'u', q: ['2.2'], e: 'harm-1' },
        { r: 'harm.place', v: 'somewhere', q: ['9.9'], e: 'harm-1' },
      ] });
    };
    const session = await advanceConversation(fullSession('en'), text, adapter);
    assert.match(seen.system, /"q":\["N\.i"\]/);
    assert.doesNotMatch(seen.system, /sourceQuotes|exact quote from a USER/);
    assert.deepEqual(JSON.parse(seen.prompt).recentMessages.find(item => item.role === 'user').sentences,
      [{ ref: '2.1', text: 'In autumn 2024 the police came to my house.' }, { ref: '2.2', text: 'I do not know why they came.' }]);
    assert.deepEqual(Object.keys(seen.responseSchema.properties.facts.items.properties), ['r', 'v', 's', 'c', 'k', 'q', 'e', 'x']);
    const facts = Object.fromEntries(getActiveFacts(session).map(item => [item.requirementId, item]));
    assert.equal(facts['harm.time'].certainty, 'approximate');
    assert.deepEqual(facts['harm.time'].sourceQuotes, [{ sourceId: 'message-2', quote: 'In autumn 2024 the police came to my house.' }]);
    assert.equal(facts['harm.reason'].status, 'unknown');
    assert.equal(facts['harm.reason'].value, 'I do not know why they came.', 'an omitted value is the cited sentence');
    assert.equal(facts['harm.place'], undefined, 'an invalid ref leaves a gap instead of failing the turn');

    const corrected = await advanceConversation(session, 'Sorry, I was wrong: it was spring 2024.', async request => request.system.startsWith('List every topic') ? '{"groups":[]}'
      : JSON.stringify({ reply: 'Thank you.', facts: [{ r: 'harm.time', v: 'spring 2024', q: ['4.1'], e: 'harm-1', x: [facts['harm.time'].id] }] }));
    assert.deepEqual(getActiveFacts(corrected).filter(item => item.requirementId === 'harm.time').map(item => item.value), ['spring 2024']);
  } finally { setExtractionFormat('full'); }
});

test('repeated identical extraction does not inflate metadata', async () => {
  const first = await sessionWith([fact('grounds.summary', '경찰이 왔습니다.', '경찰이 왔')]);
  const next = await advanceConversation(first, '네.', async () => response([fact('grounds.summary', '경찰이 왔습니다.', '경찰이 왔')]));
  assert.equal(next.facts.length, 1);
  assert.equal(next.messages.filter(item => item.role === 'user').length, 2);
});

test('each distinct incident needs its own metadata fields', async () => {
  const session = await sessionWith([
    fact('harm', 'yes', '경찰이 왔'),
    fact('harm.event', '첫 사건', '경찰이 왔', { eventId: 'incident-1' }),
    fact('harm.event', '둘째 사건', '경찰이 왔', { eventId: 'incident-2' }),
    fact('harm.time', '날짜는 기억나지 않습니다.', '날짜는 기억나지 않습니다.', { eventId: 'incident-1' }),
  ]);
  assert.equal(calculateCoverage(session).find(item => item.requirementId === 'harm.time').status, 'missing');
});

test('a broad no with substantive conditional detail is flagged, not silently discarded', async () => {
  const session = await sessionWith([
    fact('harm', 'no', '경찰이 왔'),
    fact('harm.event', '경찰이 왔습니다.', '경찰이 왔', { eventId: 'incident-1' }),
  ]);
  assert.equal(session.coverage.find(item => item.requirementId === 'harm').status, 'conflict');
  assert.throws(() => confirmFacts(session, ['fact-1']), /현재 확인/);
  assert.equal(session.coverage.find(item => item.requirementId === 'harm.event').status, 'blocked');
  const drafted = await generateDraft(reviewed(session), async request => {
    const input = JSON.parse(request.prompt);
    assert.ok(input.facts.some(item => item.requirementId === 'harm.event'));
    assert.ok(!input.facts.some(item => item.requirementId === 'harm'));
    return JSON.stringify({ sections: [{ questionId: '14.2', sentences: [{ text: '경찰이 왔습니다.', factIds: ['fact-2'], sourceIds: ['message-2'] }] }] });
  });
  assert.equal(drafted.draft.length, 1);
});

test('not-mentioned placeholder is left missing instead of attributed to applicant uncertainty', async () => {
  const session = await sessionWith([
    fact('fear', 'yes', '돌아가면 조사가 두렵습니다.'),
    fact('fear.actor', '(미언급)', '돌아가면 조사가 두렵습니다.', { status: 'unknown', certainty: 'uncertain', knowledge: 'unspecified' }),
  ], '돌아가면 조사가 두렵습니다.');
  assert.equal(session.coverage.find(item => item.requirementId === 'fear.actor').status, 'missing');
  assert.equal(getActiveFacts(session).length, 1);
});

test('unknown dates remain draftable as explicit uncertainty, with source/fact links', async () => {
  const session = await sessionWith([
    fact('harm', 'yes', '경찰이 왔'),
    fact('harm.time', '날짜는 기억나지 않습니다.', '날짜는 기억나지 않습니다.', { eventId: 'incident-1', status: 'unknown', certainty: 'uncertain' }),
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
  const session = await sessionWith([fact('grounds.summary', '경찰이 왔습니다.', '경찰이 왔')]);
  await assert.rejects(generateDraft(reviewed(session), async () => JSON.stringify({ sections: [{ questionId: '14.1', sentences: [{ text: '경찰이 왔습니다.', factIds: ['fact-99'], sourceIds: ['message-2'] }] }] })), /근거/);
});

test('draft rejects a bare yes and omission of confirmed narrative facts', async () => {
  const session = reviewed(await sessionWith([
    fact('harm', 'yes', '경찰이 왔'),
    fact('harm.event', '경찰이 왔습니다.', '경찰이 왔', { eventId: 'incident-1' }),
  ]));
  await assert.rejects(generateDraft(session, async () => JSON.stringify({ sections: [{ questionId: '14.2', sentences: [{ text: '예', factIds: ['fact-1', 'fact-2'], sourceIds: ['message-2'] }] }] })), /선택형 답변/);
  // An omission is repaired once; if it persists the section is kept and the facts are flagged.
  const flagged = await generateDraft(session, async () => JSON.stringify({ sections: [{ questionId: '14.2', sentences: [{ text: '경찰이 왔습니다.', factIds: ['fact-1'], sourceIds: ['message-2'] }] }] }));
  assert.deepEqual(flagged.draft[0].missingFactIds, ['fact-2']);
});

test('draft repair is bounded and fixes missing provenance through the model, not invented links', async () => {
  const session = reviewed(await sessionWith([
    fact('harm', 'yes', '경찰이 왔'),
    fact('harm.event', '경찰이 왔습니다.', '경찰이 왔', { eventId: 'incident-1' }),
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
  const session = await sessionWith([fact('grounds.summary', '경찰이 왔습니다.', '경찰이 왔')]);
  let called = false;
  await assert.rejects(generateDraft(session, async () => { called = true; return ''; }), /먼저 확인/);
  assert.equal(called, false);
  assert.equal(getActiveFacts(reviewed(session))[0].confirmed, true);
  const corrected = await advanceConversation(reviewed(session), '경찰이 아니었습니다.', async () => response([fact('grounds.summary', '경찰이 아니었습니다.', '경찰이 아니었습니다.', { sourceIds: ['message-4'], sourceQuotes: [{ sourceId: 'message-4', quote: '경찰이 아니었습니다.' }], supersedes: ['fact-1'] })]));
  assert.equal(getActiveFacts(corrected)[0].confirmed, false);
});

test('the conversation sends all question 14 metadata in one call, also during a guided topic', async () => {
  let calls = 0;
  const opened = appendAssistantMessage(createSession('ko', 'full'), '이야기를 들려주세요.', { kind: 'narrative' });
  const session = await advanceConversation(opened, '정치적 의견 때문에 신청합니다.', async request => {
    if (JSON.parse(request.prompt).topics) return JSON.stringify({ groups: ['grounds'] });
    calls += 1;
    const ids = JSON.parse(request.prompt).requirements.map(item => item.id);
    assert.ok(ids.includes('harm.time') && ids.includes('protection.no_reason') && !ids.includes('1.8'));
    assert.ok(request.prompt.length <= 26000);
    return response([fact('grounds.summary', '정치적 의견', '정치적 의견 때문에 신청합니다.')]);
  });
  assert.equal(calls, 1);
  assert.equal(getActiveFacts(session)[0].requirementId, 'grounds.summary');
  const focused = openTopic({ ...opened, narrativeDone: true }, ['protection'], '보호 요청에 대해 들려주세요.');
  await advanceConversation(focused, '경찰에 갈 수 없었습니다.', async request => {
    const prompt = JSON.parse(request.prompt);
    if (prompt.topics) return '{"groups":[]}';
    assert.ok(prompt.requirements.some(item => item.id === 'harm.time'));
    assert.match(prompt.focusTopic, /protection/);
    return response([]);
  });
});
test('multi-choice additions merge, restatements refine, and "I do not remember" is unknown', async () => {
  const first = await sessionWith([
    fact('harm.type', ['arrest'], '경찰이 왔', { eventId: 'harm-1' }),
    fact('harm.type', ['detention'], '경찰이 왔', { eventId: 'harm-1' }),
    fact('harm.place', '제 집', '경찰이 왔', { eventId: 'harm-1' }),
    fact('harm.time', '기억나지 않음', '날짜는 기억나지 않습니다.', { eventId: 'harm-1' }),
  ]);
  const value = id => getActiveFacts(first).filter(item => item.requirementId === id).map(item => [item.status, item.value]);
  assert.deepEqual(value('harm.type'), [['answered', ['arrest', 'detention']]]);
  assert.deepEqual(value('harm.time'), [['unknown', '기억나지 않음']]);
  const refined = await advanceConversation(first, '도시 A에 있는 제 집이었습니다.', async () => response([
    fact('harm.place', '도시 A에 있는 제 집', '도시 A에 있는 제 집이었습니다.', { eventId: 'harm-1', sourceIds: ['message-4'], sourceQuotes: [{ sourceId: 'message-4', quote: '도시 A에 있는 제 집이었습니다.' }] }),
    fact('harm.type', ['assault'], '도시 A에 있는 제 집이었습니다.', { eventId: 'harm-1', sourceIds: ['message-4'], sourceQuotes: [{ sourceId: 'message-4', quote: '도시 A에 있는 제 집이었습니다.' }] }),
  ]));
  const after = id => getActiveFacts(refined).filter(item => item.requirementId === id).map(item => [item.status, item.value]);
  assert.deepEqual(after('harm.place'), [['answered', '도시 A에 있는 제 집']]);
  assert.deepEqual(after('harm.type'), [['answered', ['arrest', 'detention', 'assault']]]);
});

test('questions 1-13 come from the form, so the chat starts with question 14', () => {
  const session = createSession('ko', 'full');
  assert.equal(nextStep(session).kind, 'narrative');
  const filled = applyFormAnswers(session, {
    '1.1': { kind: 'choice', values: ['principal'] },
    '1.2': { kind: 'text', text: 'Kim' },
    '1.4': { kind: 'status', status: 'not_applicable' },
    '2': { kind: 'choice', values: ['no'] },
    '2-table': { kind: 'table', rows: [{ country: 'hidden because 2 is no' }] },
    '4': { kind: 'table', rows: [{ relationship: '어머니', name: '가상' }, {}] },
    '5': { kind: 'table', rows: [] },
  });
  const active = getActiveFacts(filled);
  const value = id => active.filter(item => item.requirementId === id).map(item => item.value);
  assert.deepEqual(value('1.1'), ['principal']);
  assert.deepEqual(active.find(item => item.requirementId === '1.4').status, 'not_applicable');
  assert.deepEqual(value('2-table.country'), []);
  assert.deepEqual(value('4'), ['1']);
  assert.deepEqual(active.filter(item => item.requirementId === '4.name').map(item => item.eventId), ['row-1']);
  assert.equal(calculateCoverage(filled).find(item => item.requirementId === '5.school').status, 'not_applicable');
  assert.equal(nextStep(filled).kind, 'narrative');

  const again = applyFormAnswers(filled, { ...filled.form });
  assert.equal(again.facts.length, filled.facts.length);
  const changed = applyFormAnswers(filled, { ...filled.form, '1.2': { kind: 'text', text: 'Park' }, '1.4': undefined });
  delete changed.form['1.4'];
  assert.deepEqual(getActiveFacts(changed).filter(item => item.requirementId === '1.2').map(item => item.value), ['Park']);
  assert.ok(!getActiveFacts(changed).some(item => item.requirementId === '1.4'));
  assert.ok(changed.facts.some(item => item.value === 'Kim'));
});

test('dummy form data fills every visible form field and stays out of the chat', () => {
  const session = applyFormAnswers(createSession('ko', 'full'), dummyFormAnswers());
  assert.ok(getActiveFacts(session).length > 50);
  assert.ok(getActiveFacts(session).every(item => item.sourceIds[0] === 'form'));
  assert.equal(session.messages.length, 0);
});

test('re-asking a chat question supersedes the earlier answer', () => {
  const ask = { kind: 'field', requirementId: 'grounds.category' };
  const first = answerScripted(reaskQuestion(createSession('ko', 'full'), 'Q', ask), { text: '정치적 의견', status: 'answered', value: ['political'] });
  const corrected = answerScripted(reaskQuestion(first, 'Q', ask), { text: '종교', status: 'answered', value: ['religion'] });
  assert.deepEqual(getActiveFacts(corrected).filter(item => item.requirementId === 'grounds.category').map(item => item.value), [['religion']]);
});
test('after the free story, guided questions cover open gaps across all of question 14, never fixed questions', () => {
  let session = finishNarrative(createSession('ko', 'full'));
  const step = nextStep(session);
  assert.equal(step.kind, 'narrative');
  assert.ok(['grounds', 'harm', 'fear', 'family_harm', 'protection', 'relocation'].every(group => step.guided.includes(group)));
  session = openTopic(session, ['harm', 'fear'], '그 뒤에는 어떤 일이 있었고, 돌아가면 무엇이 걱정되시나요?');
  assert.deepEqual(session.topicAttempts, { harm: 1, fear: 1 });
  session = openTopic(appendUserMessage(session, '모르겠어요.'), ['harm'], '다시 여쭤볼게요?');
  assert.ok(!nextStep(session).guided.includes('harm'));
  assert.ok(nextStep(session).guided.includes('fear'));
  const ended = finishNarrative(session);
  assert.equal(nextStep(ended).ask?.requirementId, '15');
});
test('release details apply only to incidents with arrest or detention', async () => {
  const session = await sessionWith([
    fact('harm', 'yes', '경찰이 왔'),
    fact('harm.event', '경찰 조사', '경찰이 왔', { eventId: 'harm-1' }),
    fact('harm.type', ['questioning'], '경찰이 왔', { eventId: 'harm-1' }),
  ]);
  assert.equal(calculateCoverage(session).find(item => item.requirementId === 'harm.release').status, 'not_applicable');
  const detained = await advanceConversation(session, '구금됐습니다.', async request => JSON.parse(request.prompt).topics ? '{"groups":[]}'
    : response([fact('harm.type', ['detention'], '구금됐습니다.', { eventId: 'harm-1', sourceIds: ['message-4'], sourceQuotes: [{ sourceId: 'message-4', quote: '구금됐습니다.' }] })]));
  assert.equal(calculateCoverage(detained).find(item => item.requirementId === 'harm.release').status, 'missing');
});
test('question 14 boxes are derived from metadata, flagging a no that contradicts described incidents', async () => {
  const full = (facts, routed) => advanceConversation(appendAssistantMessage(createSession('ko', 'full'), '이야기를 들려주세요.', { kind: 'narrative' }), '경찰이 왔지만 날짜는 기억나지 않습니다.',
    async request => JSON.parse(request.prompt).catalog ? JSON.stringify({ requirementIds: routed }) : response(facts));
  const session = await full([
    fact('grounds.category', ['political'], '경찰이 왔'),
    fact('harm.event', '경찰 조사', '경찰이 왔', { eventId: 'harm-1' }),
    fact('fear', 'no', '경찰이 왔'),
    fact('org', 'yes', '경찰이 왔'),
    fact('org.org', '가상 단체', '경찰이 왔', { eventId: 'org-1' }),
  ], ['grounds.category', 'harm', 'fear', 'org']);
  const derived = Object.fromEntries(deriveQuestion14(session).map(item => [item.id, item]));
  assert.equal(derived['14.1'].value, '정치적 의견');
  assert.equal(derived['14.2'].value, '예');
  assert.equal(derived['14.3'].value, '아니요');
  assert.equal(derived['14.8-table'].rows[0].org, '가상 단체');
  const contradicted = await sessionWith([fact('harm', 'no', '경찰이 왔'), fact('harm.event', '경찰 조사', '경찰이 왔', { eventId: 'harm-1' })]);
  assert.ok(deriveQuestion14(contradicted).find(item => item.id === '14.2').needsReview);
});

test('the late-application gate is computed from the entry date in the form', () => {
  const recent = new Date(); recent.setMonth(recent.getMonth() - 2);
  const date = `${recent.getFullYear()}/${recent.getMonth() + 1}/${recent.getDate()}`;
  const onTime = applyFormAnswers(createSession('ko', 'full'), { '10.7': { kind: 'text', text: date } });
  assert.deepEqual(getActiveFacts(onTime).find(item => item.requirementId === 'late').value, 'no');
  const late = applyFormAnswers(onTime, { '10.7': { kind: 'text', text: '2019/01/01' } });
  assert.deepEqual(getActiveFacts(late).filter(item => item.requirementId === 'late').map(item => item.value), ['yes']);
  const unreadable = applyFormAnswers(late, { '10.7': { kind: 'text', text: '작년 봄' } });
  assert.ok(!getActiveFacts(unreadable).some(item => item.requirementId === 'late'));
});

test('a filled topic leaves the open gaps, and a no still asks its reason', () => {
  const session = finishNarrative(createSession('ko', 'full'));
  const said = (id, value) => ({ ...session, facts: [...session.facts, { id: `fact-${session.facts.length + 1}`, requirementId: id, value, sourceIds: ['message-1'], sourceQuotes: [], status: 'answered', certainty: 'exact', knowledge: 'direct', supersedes: [], confirmed: false }] });
  assert.ok(!nextStep(said('family_harm', 'no')).guided.includes('family_harm'));
  assert.ok(nextStep(said('protection', 'no')).guided.includes('protection'));
});
test('only questions with narrative answers are drafted by the model', async () => {
  let session = await sessionWith([fact('grounds.summary', '경찰이 왔습니다.', '경찰이 왔'), fact('grounds.category', ['political'], '경찰이 왔')]);
  session = reviewed(session);
  const drafted = await generateDraft(session, async request => {
    assert.equal(JSON.parse(request.prompt).questionId, '14.1');
    return JSON.stringify({ sections: [{ questionId: '14.1', sentences: [{ text: '경찰이 왔습니다.', factIds: ['fact-1', 'fact-2'], sourceIds: ['message-2'] }] }] });
  });
  assert.deepEqual(drafted.draft.map(item => item.questionId), ['14.1']);
  const formOnly = reviewed(applyFormAnswers(createSession('ko', 'full'), { '1.1': { kind: 'choice', values: ['principal'] } }));
  const result = await generateDraft(formOnly, async () => { throw new Error('model must not be called'); });
  assert.deepEqual(result.draft, []);
});

test('choice labels are mapped to option codes and unknown choices are left missing', async () => {
  const session = await sessionWith([
    fact('grounds.category', ['Political opinion', '종교'], '경찰이 왔'),
    fact('harm', '아마도', '경찰이 왔'),
  ]);
  assert.deepEqual(getActiveFacts(session).map(item => [item.requirementId, item.value]), [['grounds.category', ['political', 'religion']]]);
  assert.equal(session.coverage.find(item => item.requirementId === 'harm').status, 'missing');
});

test('an invalid correction link is dropped and the differing value becomes a conflict', async () => {
  const first = await sessionWith([
    fact('harm.time', '3월', '경찰이 왔', { eventId: 'incident-1' }),
    fact('harm.event', '경찰 방문', '경찰이 왔', { eventId: 'incident-1' }),
  ]);
  const latest = { sourceIds: ['message-4'], sourceQuotes: [{ sourceId: 'message-4', quote: '4월이었습니다.' }], eventId: 'incident-1' };
  const wrongField = await advanceConversation(first, '4월이었습니다.', async () => response([fact('harm.time', '4월', '4월이었습니다.', { ...latest, supersedes: ['fact-2'] })]));
  assert.equal(getActiveFacts(wrongField).filter(item => item.requirementId !== 'harm').length, 3);
  assert.equal(getActiveFacts(wrongField).find(item => item.requirementId === 'harm').value, 'yes');
  assert.equal(wrongField.coverage.find(item => item.requirementId === 'harm.time').status, 'conflict');
  const valid = await advanceConversation(first, '4월이었습니다.', async () => response([fact('harm.time', '4월', '4월이었습니다.', { ...latest, supersedes: ['fact-1'] })]));
  assert.deepEqual(getActiveFacts(valid).filter(item => item.requirementId === 'harm.time').map(item => item.value), ['4월']);
});

test('the app picks the next open gaps and the model only phrases the question; repeats are refused', async () => {
  const session = finishNarrative(appendAssistantMessage(createSession('ko', 'full'), '이야기를 들려주세요.', { kind: 'narrative' }));
  let calls = 0;
  const guided = await guideConversation(session, async request => {
    calls += 1;
    const prompt = JSON.parse(request.prompt);
    assert.equal(prompt.askAbout.length, 1);
    assert.match(prompt.askAbout[0].meaning, /Grounds/);
    return JSON.stringify({ reply: '어떤 이유로 보호를 신청하시게 되었나요?' });
  });
  assert.equal(calls, 1);
  assert.deepEqual(guided.messages.at(-1).ask, { kind: 'narrative', topics: ['grounds'] });
  assert.deepEqual(guided.topicAttempts, { grounds: 1 });
  assert.equal(await guideConversation(guided, async () => { throw new Error('no second question'); }), guided);
  const next = appendUserMessage(guided, '잘 모르겠습니다.');
  await assert.rejects(guideConversation(next, async request => {
    assert.equal(JSON.parse(request.prompt).askAbout.length, 2);
    return JSON.stringify({ reply: '어떤 이유로 보호를 신청하시게 되었나요?' });
  }), error => error.targets?.[0] === 'harm');
});

test('a group recorded as yes without details gets one focused extraction pass', async () => {
  const prompts = [];
  const session = await advanceConversation(createSession('ko'), '경찰이 왔지만 날짜는 기억나지 않습니다.', async request => {
    const prompt = JSON.parse(request.prompt);
    if (prompt.topics) return JSON.stringify({ groups: ['harm'] });
    prompts.push(prompt);
    return prompts.length === 1
      ? response([fact('harm', 'yes', '경찰이 왔')])
      : response([fact('harm.event', '경찰 방문', '경찰이 왔', { eventId: 'harm-1' })], '');
  });
  assert.equal(prompts.length, 2);
  assert.match(prompts[1].pass, /harm/);
  assert.ok(prompts[1].requirements.every(item => item.id === 'harm' || item.id.startsWith('harm.')));
  assert.deepEqual(getActiveFacts(session).map(item => item.requirementId), ['harm', 'harm.event']);
  assert.equal(session.messages.at(-1).content, '그때 어떤 일이 있었나요?');
});

test('a topic the answer mentions but the main pass missed gets a focused pass; explicit corrections replace', async () => {
  const opened = appendAssistantMessage(createSession('ko', 'full'), '이야기를 들려주세요.', { kind: 'narrative' });
  const quote = '경찰이 위협한 당사자라서 경찰에 도움을 요청할 수 없었습니다. 그래서 다른 도시로 갔습니다. 거기서 두 달을 지냈습니다.';
  const own = (id, value) => fact(id, value, quote);
  const passes = [];
  const session = await advanceConversation(opened, quote, async request => {
    const prompt = JSON.parse(request.prompt);
    if (prompt.topics) return JSON.stringify({ groups: ['protection'] });
    passes.push(prompt.pass ?? 'main');
    return prompt.pass ? response([own('protection', 'no'), own('protection.no_reason', '경찰이 위협한 당사자')]) : response([]);
  });
  assert.equal(passes.length, 2);
  assert.deepEqual(getActiveFacts(session).map(item => item.requirementId), ['protection', 'protection.no_reason']);

  const first = await sessionWith([fact('harm.time', '3월', '경찰이 왔', { eventId: 'harm-1' })]);
  const fixed = await advanceConversation(first, '3월이 아니라 4월이었습니다.', async request => JSON.parse(request.prompt).topics ? JSON.stringify({ groups: [] })
    : response([fact('harm.time', '4월', '3월이 아니라 4월이었습니다.', { eventId: 'harm-1', sourceIds: ['message-4'], sourceQuotes: [{ sourceId: 'message-4', quote: '3월이 아니라 4월이었습니다.' }] })]));
  assert.deepEqual(getActiveFacts(fixed).filter(item => item.requirementId === 'harm.time').map(item => [item.status, item.value]), [['answered', '4월']]);
});

test('the topic check runs only for long, multi-topic answers', async () => {
  const opened = appendAssistantMessage(createSession('ko', 'full'), '이야기를 들려주세요.', { kind: 'narrative' });
  const count = async text => {
    let checks = 0;
    await advanceConversation(opened, text, async request => { if (JSON.parse(request.prompt).topics) { checks += 1; return JSON.stringify({ groups: [] }); } return response([]); });
    return checks;
  };
  assert.equal(await count('경찰이 왔습니다.'), 0);
  assert.equal(await count('경찰이 왔습니다. 그 뒤 삼촌 집으로 피신했습니다. 경찰에 도움을 요청할 수는 없었습니다.'), 1);
});

test('a corrected value quoted inside another fact is not reused by the draft', async () => {
  const first = await sessionWith([
    fact('harm.event', '3월쯤 경찰서로 끌려감', '경찰이 왔', { eventId: 'harm-1' }),
    fact('harm.time', '3월쯤', '경찰이 왔', { eventId: 'harm-1' }),
  ]);
  const quote = { sourceIds: ['message-4'], sourceQuotes: [{ sourceId: 'message-4', quote: '3월이 아니라 4월이었습니다.' }] };
  const fixed = await advanceConversation(first, '3월이 아니라 4월이었습니다.', async request => JSON.parse(request.prompt).topics ? '{"groups":[]}'
    : response([fact('harm.time', '4월', '3월이 아니라 4월이었습니다.', { eventId: 'harm-1', ...quote })]));
  const ids = getActiveFacts(fixed).map(item => item.id);
  const prompts = [];
  const drafted = await generateDraft(confirmFacts(fixed, ids), async request => {
    prompts.push(JSON.parse(request.prompt));
    const text = prompts.length === 1 ? '3월쯤 경찰서로 끌려갔습니다.' : '4월에 경찰서로 끌려갔습니다.';
    return JSON.stringify({ sections: [{ questionId: '14.2', sentences: [{ text, factIds: ids, sourceIds: ['message-2', 'message-4'] }] }] });
  });
  assert.deepEqual(prompts[0].corrections.map(item => [item.old, item.now]), [['3월쯤', '4월']]);
  assert.match(prompts[1].correction, /3월쯤/);
  assert.equal(drafted.draft[0].text, '4월에 경찰서로 끌려갔습니다.');
});

test('the question 14 draft fills choices, tables and narrative boxes for editing', async () => {
  const session = reviewed(await sessionWith([
    fact('grounds.category', ['political'], '경찰이 왔'),
    fact('harm', 'yes', '경찰이 왔'),
    fact('harm.event', '경찰 방문', '경찰이 왔', { eventId: 'harm-1' }),
  ]));
  const drafted = await generateDraft(session, async request => {
    const { questionId, requiredFactIds } = JSON.parse(request.prompt);
    return JSON.stringify({ sections: [{ questionId, sentences: [{ text: questionId === '14.1' ? '정치적 의견 때문에 신청합니다.' : '경찰이 집에 왔습니다.', factIds: requiredFactIds, sourceIds: ['message-2'] }] }] });
  });
  const answers = drafted.question14;
  assert.deepEqual(answers['14.1'], { kind: 'choice', values: ['political'] });
  assert.deepEqual(answers['14.2'], { kind: 'choice', values: ['yes'] });
  assert.equal(answers['14.2-detail'].text, '경찰이 집에 왔습니다.');
  assert.equal(narrativeFieldFor('14.5', { '14.5': { kind: 'choice', values: ['no'] } }), '14.5-no');
  assert.deepEqual(buildQuestion14Answers({ ...drafted, draft: [] })['14.2-detail'], undefined);
  assert.ok(JSON.parse(exportSession(drafted)).question14['14.2-detail']);
});

test('a shown guided question (even a fallback without a question mark) is not asked again', () => {
  const opened = openTopic(finishNarrative(createSession('ko', 'full')), ['grounds'], '이제 신청 사유에 대해 여쭤볼게요.');
  assert.equal(needsTopicQuestion(opened), false);
  const answered = appendUserMessage(opened, '정치적 의견 때문입니다.');
  assert.equal(needsTopicQuestion(answered), true);
  assert.equal(needsTopicQuestion(appendAssistantMessage(answered, '말씀 감사합니다.', undefined)), true);
});

test('after the first account the conversation moves on to gap questions by itself', async () => {
  const opened = appendAssistantMessage(createSession('ko', 'full'), '이야기를 들려주세요.', { kind: 'narrative' });
  let note;
  const session = await advanceConversation(opened, '정치적 의견 때문에 신청합니다.', async request => {
    const prompt = JSON.parse(request.prompt);
    if (prompt.topics) return '{"groups":[]}';
    note = prompt.focusTopic;
    return response([fact('grounds.summary', '정치적 의견', '정치적 의견 때문에 신청합니다.')], '말씀 감사합니다.');
  });
  assert.equal(session.narrativeDone, true);
  assert.match(note, /NO question/);
  assert.ok(nextStep(session).guided?.length);
  assert.equal(needsTopicQuestion(session), true);
});
