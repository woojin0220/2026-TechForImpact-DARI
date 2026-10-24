import test from 'node:test';
import assert from 'node:assert/strict';
import { createSession, advanceConversation, appendUserMessage, continueConversation, clarifyStatement,
  getActiveFacts, confirmFacts, generateDraft, exportSession, calculateCoverage, setAuxiliaryPasses } from '../src/intake/index.ts';
import { eventReview, parseStatements, relatedRequirements, questionUses, statementMetadata } from '../src/intake/statements.ts';
import { intakeCompactSchema } from '../src/intake/responseSchemas.ts';
import { requirementsForScope } from '../src/intake/catalog.ts';

setAuxiliaryPasses('off');
const statement = (quote, subject, action, object = null, extra = {}) => ({ quote, subject, action, object,
  polarity: 'positive', certainty: 'exact', knowledge: 'direct', ...extra });
const compact = facts => async () => JSON.stringify({ reply: 'Thank you.', facts });

test('one account retains affirmed harm, denied detention and an uncertain identity belief independently', async () => {
  const first = 'They threatened me, but I was not detained.';
  const second = 'I think they were police officers.';
  const result = await advanceConversation(createSession('en'), `${first} ${second}`, compact([
    { r: 'harm.event', v: `${first} ${second}`, k: 'd', q: ['2.1', '2.2'], e: 'harm-1', a: [
      statement(first, 'They', 'threatened', 'me'),
      statement(first, 'I', 'detained', null, { polarity: 'negative' }),
      statement(second, 'I', 'think', 'they were police officers', { certainty: 'uncertain', knowledge: 'inferred' }),
    ] },
  ]));
  const fact = getActiveFacts(result).find(item => item.requirementId === 'harm.event');
  assert.equal(fact.statements.length, 3);
  assert.equal(fact.statements[1].polarity, 'negative');
  assert.equal(fact.statements[2].subject, 'I');
  assert.equal(fact.statements[2].object, 'they were police officers');
  assert.equal(fact.certainty, 'uncertain');
  assert.equal(fact.statements[2].knowledge, 'inferred');
  assert.equal(result.messages[1].content, `${first} ${second}`);
  const saved = JSON.parse(exportSession(result));
  assert.equal(saved.metadata.schemaVersion, 2);
  assert.equal(saved.metadata.statements.length, 3);
  assert.deepEqual(saved.metadata.statements[2].sourceQuotes, [{ sourceId: 'message-2', quote: second }]);
});

test('fabricated roles/actions or quotes are flagged without becoming structured statements', () => {
  const quote = 'They threatened me.';
  const evidence = [{ sourceId: 'message-2', quote }];
  assert.deepEqual(parseStatements([statement(quote, 'police officers', 'threatened', 'me')], evidence), { statements: [], clarification: ['roles'] });
  assert.equal(parseStatements([statement(quote, 'They', 'arrested', 'me')], evidence).statements.length, 0);
  assert.equal(parseStatements([statement('I was arrested.', 'I', 'arrested')], evidence).statements.length, 0);
  const unclear = parseStatements([statement(quote, null, 'threatened', 'me', { polarity: 'unspecified' })], evidence);
  assert.deepEqual(unclear.clarification, ['roles', 'polarity']);
});

test('a denied action alone does not imply a yes gate', async () => {
  const quote = 'I was not detained.';
  const result = await advanceConversation(createSession('en'), quote, compact([
    { r: 'harm.event', v: quote, k: 'd', q: ['2.1'], e: 'harm-1', a: [statement(quote, 'I', 'detained', null, { polarity: 'negative' })] },
  ]));
  assert.ok(!getActiveFacts(result).some(item => item.requirementId === 'harm' && item.value === 'yes'));
});

test('a negative model label without a negation is unresolved, and an identity belief cannot become certain', async () => {
  const quote = 'They threatened me.';
  const result = await advanceConversation(createSession('en'), quote, compact([
    { r: 'harm.event', v: quote, k: 'd', q: ['2.1'], e: 'harm-1', a: [statement(quote, 'They', 'threatened', 'me', { polarity: 'negative' })] },
  ]));
  const fact = getActiveFacts(result).find(item => item.requirementId === 'harm.event');
  assert.equal(fact.statements[0].polarity, 'unspecified');
  assert.ok(fact.clarification.includes('polarity'));
  const belief = 'I think they were police officers.';
  const parsed = parseStatements([statement(belief, 'I', 'think', 'they were police officers')], [{ sourceId: 'm', quote: belief }]);
  assert.equal(parsed.statements[0].certainty, 'uncertain');
  assert.equal(parsed.statements[0].knowledge, 'inferred');
});

test('a model placeholder is not accepted as the location of an incident', async () => {
  const result = await advanceConversation(createSession('en'), 'They threatened me.', compact([
    { r: 'harm.place', v: 'null', k: 'u', q: ['2.1'], e: 'harm-1', a: [] },
  ]));
  assert.equal(getActiveFacts(result).length, 0);
});

test('one canonical fact can be cited by several explicitly linked narrative sections', async () => {
  const quote = 'They threatened me for protesting, so I fear returning.';
  let session = await advanceConversation(createSession('en'), quote, compact([
    { r: 'harm.event', v: quote, k: 'd', q: ['2.1'], e: 'harm-1', u: ['grounds.summary', 'fear.reason', 'grounds.category', 'fear'],
      a: [statement(quote, 'They', 'threatened', 'me')] },
  ]));
  const shared = getActiveFacts(session).find(item => item.requirementId === 'harm.event');
  assert.deepEqual(shared.relatedRequirementIds, ['grounds.summary', 'fear.reason']);
  assert.equal(calculateCoverage(session).find(item => item.requirementId === 'grounds.summary').status, 'answered');
  session = confirmFacts(session, getActiveFacts(session).map(item => item.id));
  const requests = [];
  const drafted = await generateDraft(session, async request => {
    const task = JSON.parse(request.prompt); requests.push(task);
    assert.ok(task.facts.some(item => item.id === shared.id && item.statements.length));
    return JSON.stringify({ sections: [{ questionId: task.questionId, sentences: [
      { text: '시위에 참여하여 위협을 받았고 귀국이 두렵습니다.', factIds: task.requiredFactIds },
    ] }] });
  });
  assert.deepEqual(new Set(requests.map(item => item.questionId)), new Set(['14.1', '14.2', '14.3']));
  assert.equal(getActiveFacts(drafted).filter(item => item.id === shared.id).length, 1);
  for (const section of drafted.draft) assert.ok(section.factIds.includes(shared.id));
  assert.equal(JSON.parse(exportSession(drafted)).metadata.questionUses.filter(item => item.factId === shared.id).length, 3);
});

test('cross-question links cannot fill options, identity, tables, out-of-scope fields or unknown testimony', () => {
  assert.deepEqual(relatedRequirements(['grounds.category', 'harm', '1.1', 'org.name', 'fear.reason', 'fear.reason'], 'harm.event', 'test'), ['fear.reason']);
  const uses = questionUses([{ id: 'fact-1', requirementId: 'harm.time', status: 'unknown', relatedRequirementIds: ['grounds.summary'] }]);
  assert.deepEqual(uses.map(item => item.requirementId), ['harm.time']);
});

test('a targeted clarification revises only that fact and incident, with original testimony retained', async () => {
  const quote = 'I think they were police officers.';
  const description = 'Two men threatened me.';
  let session = await advanceConversation(createSession('en'), `${description} ${quote}`, compact([
    { r: 'harm.actor', v: description, k: 'd', q: ['2.1'], e: 'harm-1', a: [statement(description, 'Two men', 'threatened', 'me')] },
    { r: 'harm.actor', v: quote, k: 'i', c: 'u', q: ['2.2'], e: 'harm-1', a: [statement(quote, 'I', 'think', 'they were police officers', { certainty: 'uncertain', knowledge: 'inferred' })] },
  ]));
  const original = getActiveFacts(session).find(item => item.value === quote);
  const sibling = getActiveFacts(session).find(item => item.value === description);
  session = await clarifyStatement(session, original.id, async request => {
    assert.equal(JSON.parse(request.prompt).askAbout[0].eventId, 'harm-1');
    return JSON.stringify({ reply: 'Who did you mean by “they”?' });
  });
  assert.deepEqual(session.messages.at(-1).ask.clarifies, [original.id]);
  session = appendUserMessage(session, 'They were the two men.');
  const messageId = session.messages.at(-1).id.replace('message-', '');
  session = await continueConversation(session, async request => {
    assert.deepEqual(JSON.parse(request.prompt).clarifyingFactIds, [original.id]);
    return JSON.stringify({ reply: 'Thank you for clarifying.', facts: [{ r: 'harm.actor', v: 'They were the two men.', k: 'd', q: [`${messageId}.1`], e: 'harm-1', a: [statement('They were the two men.', 'They', 'were', 'the two men')] }] });
  });
  const revised = getActiveFacts(session).find(item => item.supersedes?.includes(original.id));
  assert.notEqual(revised.id, original.id);
  assert.deepEqual(revised.supersedes, [original.id]);
  assert.equal(revised.status, 'answered');
  assert.equal(revised.confirmed, false);
  assert.equal(revised.certainty, 'uncertain');
  assert.ok(revised.value.includes(quote));
  assert.equal(revised.statements.length, 2);
  assert.ok(session.facts.some(item => item.id === original.id));
  assert.equal(session.messages[1].content, `${description} ${quote}`);
  assert.ok(getActiveFacts(session).some(item => item.id === sibling.id));
  assert.ok(!JSON.parse(exportSession(session)).metadata.statements.some(item => item.factId === original.id));
});

test('different aspects supplement one incident without being labeled contradictory', async () => {
  const quote = 'Two men threatened me. I think they were police officers.';
  const result = await advanceConversation(createSession('en'), quote, compact([
    { r: 'harm.actor', v: 'Two men', k: 'd', q: ['2.1'], e: 'harm-1', a: [statement('Two men threatened me.', 'Two men', 'threatened', 'me')] },
    { r: 'harm.actor', v: 'I think they were police officers.', k: 'i', q: ['2.2'], e: 'harm-1', a: [statement('I think they were police officers.', 'I', 'think', 'they were police officers', { certainty: 'uncertain', knowledge: 'inferred' })] },
  ]));
  assert.equal(getActiveFacts(result).filter(item => item.requirementId === 'harm.actor').every(item => item.status === 'answered'), true);
});

test('a clarification silently ignored by the model stays recoverable and is not reported as applied', async () => {
  let session = await advanceConversation(createSession('en'), 'They threatened me.', compact([
    { r: 'harm.event', v: 'They threatened me.', k: 'd', q: ['2.1'], e: 'harm-1', a: [] },
  ]));
  const target = getActiveFacts(session).find(item => item.requirementId === 'harm.event');
  session = await clarifyStatement(session, target.id, async () => JSON.stringify({ reply: 'Who did you mean?' }));
  session = appendUserMessage(session, 'The two men outside my home.');
  await assert.rejects(continueConversation(session, compact([])), error => {
    assert.match(error.message, /clarification was saved/);
    assert.equal(error.session.messages.at(-1).content, 'The two men outside my home.');
    return true;
  });
});

test('positive harm and negative detention can share the event field without a false conflict', async () => {
  const result = await advanceConversation(createSession('en'), 'They threatened me. I was not detained.', compact([
    { r: 'harm.event', v: 'They threatened me.', k: 'd', q: ['2.1'], e: 'harm-1', a: [statement('They threatened me.', 'They', 'threatened', 'me')] },
    { r: 'harm.event', v: 'I was not detained.', k: 'd', q: ['2.2'], e: 'harm-1', a: [statement('I was not detained.', 'I', 'detained', null, { polarity: 'negative' })] },
  ]));
  assert.ok(getActiveFacts(result).filter(item => item.requirementId === 'harm.event').every(item => item.status === 'answered'));
  assert.equal(calculateCoverage(result).find(item => item.requirementId === 'harm.event').status, 'answered');
});

test('event gaps do not borrow dates from a different incident and do not re-ask explicit unknowns', async () => {
  const result = await advanceConversation(createSession('en'), 'They threatened me in March. They returned later. I do not know where.', compact([
    { r: 'harm.event', v: 'They threatened me in March.', k: 'd', q: ['2.1'], e: 'harm-1', a: [] },
    { r: 'harm.time', v: 'March', k: 'd', q: ['2.1'], e: 'harm-1', a: [] },
    { r: 'harm.event', v: 'They returned later.', k: 'd', q: ['2.2'], e: 'harm-2', a: [] },
    { r: 'harm.place', v: 'I do not know where.', s: 'u', k: 'u', q: ['2.3'], e: 'harm-2', a: [] },
  ]));
  const events = eventReview(result);
  assert.equal(events.find(item => item.eventId === 'harm-1').missingRequirementIds.includes('harm.time'), false);
  assert.equal(events.find(item => item.eventId === 'harm-2').missingRequirementIds.includes('harm.time'), true);
  assert.equal(events.find(item => item.eventId === 'harm-2').missingRequirementIds.includes('harm.place'), false);
  assert.ok(events.find(item => item.eventId === 'harm-2').unknownRequirementIds.includes('harm.place'));
});

test('duplicate statement extraction exports one statement with all referring facts', () => {
  const sourceQuotes = [{ sourceId: 'm', quote: 'They threatened me.' }];
  const structured = parseStatements([statement(sourceQuotes[0].quote, 'They', 'threatened', 'me')], sourceQuotes).statements;
  const fact = { id: 'fact-1', requirementId: 'harm.event', eventId: 'harm-1', statements: structured, status: 'answered', confirmed: true };
  const statements = statementMetadata([fact, { ...fact, id: 'fact-2', requirementId: 'harm.type' }]);
  assert.equal(statements.length, 1);
  assert.deepEqual(statements[0].factIds, ['fact-1', 'fact-2']);
  assert.equal(new Set(questionUses([fact, { ...fact, id: 'fact-2' }]).flatMap(item => item.statementIds)).size, 1);
});

test('opposite statements about the same action and incident still require clarification', async () => {
  const result = await advanceConversation(createSession('en'), 'They threatened me. They did not threaten me.', compact([
    { r: 'harm.event', v: 'They threatened me.', k: 'd', q: ['2.1'], e: 'harm-1', a: [statement('They threatened me.', 'They', 'threaten', 'me')] },
    { r: 'harm.event', v: 'They did not threaten me.', k: 'd', q: ['2.2'], e: 'harm-1', a: [statement('They did not threaten me.', 'They', 'threaten', 'me', { polarity: 'negative' })] },
  ]));
  assert.equal(getActiveFacts(result).filter(item => item.requirementId === 'harm.event').at(-1).status, 'conflict');
});

test('compact constrained output requires statements for narrative fields, not dates and choices', () => {
  const schema = intakeCompactSchema(requirementsForScope('test'), ['2.1'], []);
  const variants = schema.properties.facts.items.anyOf;
  const event = variants.find(item => item.properties.r.enum.includes('harm.event'));
  const time = variants.find(item => item.properties.r.enum.includes('harm.time'));
  assert.equal(event.properties.a.minItems, 1);
  assert.ok(event.required.includes('a'));
  assert.equal(time.properties.a.minItems, undefined);
});

test('missing incident IDs in unconstrained compact responses cannot merge unrelated events', async () => {
  const session = await advanceConversation(createSession('en'), 'They threatened me in 2023. I was detained in 2024.', compact([
    { r: 'harm.event', v: 'They threatened me in 2023.', k: 'd', q: ['2.1'], a: [] },
    { r: 'harm.time', v: '2024', k: 'd', q: ['2.2'], a: [] },
  ]));
  assert.equal(getActiveFacts(session).length, 0);
  assert.match(session.messages[1].content, /2023.*2024/);
});
