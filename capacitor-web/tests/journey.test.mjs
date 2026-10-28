import test from 'node:test';
import assert from 'node:assert/strict';
import { createSession, appendAssistantMessage, getActiveFacts, nextStep, exportSession } from '../src/intake/index.ts';
import { deferCurrentTopics, reviewBundles, journeyTopics, finalIssues } from '../src/intake/journey.ts';

const fact = (id, requirementId, value, extra = {}) => ({ id, requirementId, value, sourceIds: ['message-1'], sourceQuotes: [{ sourceId: 'message-1', quote: value }], status: 'answered', certainty: 'exact', knowledge: 'direct', confirmed: false, ...extra });

test('deferral preserves gaps and facts without manufacturing field answers', () => {
  let s = { ...createSession('en', 'test'), narrativeDone: true };
  s = appendAssistantMessage(s, 'Who harmed you, and what do you fear?', { kind: 'narrative', topics: ['harm', 'fear'] });
  const result = deferCurrentTopics(s, 'unknown', 'I do not know.');
  assert.deepEqual(getActiveFacts(result), []);
  assert.deepEqual(result.topicDecisions, { harm: 'unknown', fear: 'unknown' });
  assert.equal(result.messages.at(-1).content, 'I do not know.');
  assert.ok(finalIssues(result).some(c => c.requirementId === 'harm'));
  assert.ok(!nextStep(result).guided?.includes('harm'));
  assert.equal(JSON.parse(exportSession(result)).metadata.topicDecisions.harm, 'unknown');
});

test('a free story cannot mark unspecified topics unknown', () => {
  const s = appendAssistantMessage(createSession('en'), 'Tell me your story.', { kind: 'narrative' });
  assert.equal(deferCurrentTopics(s, 'skipped', 'Later'), s);
});

test('review bundles keep incidents separate and confirmation is invalidated by a new fact', () => {
  const s = { ...createSession('en'), facts: [
    fact('f1', 'harm.event', 'They threatened me.', { eventId: 'one', confirmed: true }),
    fact('f2', 'harm.time', 'In 2020.', { eventId: 'one', confirmed: true }),
    fact('f3', 'harm.event', 'Another incident.', { eventId: 'two' }),
  ] };
  const bundles = reviewBundles(s);
  assert.equal(bundles.length, 2);
  assert.equal(bundles[0].confirmed, true);
  assert.equal(bundles[1].confirmed, false);
  assert.deepEqual(bundles[0].factIds, ['f1', 'f2']);
  s.facts.push(fact('f4', 'harm.actor', 'Two men.', { eventId: 'one' }));
  assert.equal(reviewBundles(s)[0].confirmed, false);
  assert.ok(finalIssues(s).some(issue => issue.requirementId === 'harm.time' && issue.eventId === 'two'));
});

test('correction history is not displayed as another active account', () => {
  const s = { ...createSession('en'), facts: [fact('f1', 'fear.harm', 'detention'), fact('f2', 'fear.harm', 'threats', { supersedes: ['f1'] })] };
  assert.deepEqual(reviewBundles(s)[0].factIds, ['f2']);
});

test('topic list respects short test scope and deferral is not completion', () => {
  const s = { ...createSession('en', 'test'), topicDecisions: { harm: 'skipped' } };
  const topics = journeyTopics(s);
  assert.deepEqual(topics.map(t => t.id), ['grounds', 'harm', 'fear']);
  assert.equal(topics.find(t => t.id === 'harm').state, 'skipped');
  assert.ok(finalIssues(s).length > 0);
});
