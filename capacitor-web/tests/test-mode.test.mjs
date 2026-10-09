import test from 'node:test';
import assert from 'node:assert/strict';
import { createSession, appendUserMessage, nextStep, exportSession, calculateCoverage, openTopic, guideConversation, appendAssistantMessage } from '../src/intake/index.ts';
import { requirementsForScope, testRequirementIds } from '../src/intake/catalog.ts';
import { testStory, testOpening } from '../src/intake/testMode.ts';

test('quick test covers three core topics without collecting personal form data', () => {
  const requirements = requirementsForScope('test');
  assert.equal(requirements.length, testRequirementIds.length);
  assert.deepEqual(new Set(requirements.map(r => r.questionId)), new Set(['14.1', '14.2', '14.3']));
  assert.equal(calculateCoverage(createSession('ko', 'test')).length, testRequirementIds.length);
  assert.ok(!/[가-힣]/.test(testOpening + testStory));
  assert.equal(createSession('ko', 'test').language, 'en');
  assert.equal(createSession('ko', 'full').language, 'ko');
  assert.match(testStory, /not assaulted or detained/);
});
test('test uses actual gaps and bounds generated follow-ups rather than counting answers', async () => {
  let session = createSession('ko', 'test');
  assert.equal(nextStep(session).kind, 'narrative');
  session = { ...appendUserMessage(session, testStory), narrativeDone: true };
  assert.ok(nextStep(session).guided.includes('grounds'));
  let request;
  session = await guideConversation(session, async input => { request = input; return JSON.stringify({ reply: 'What led you to seek protection?' }); });
  assert.equal(request.task, 'intake');
  assert.ok(JSON.parse(request.prompt).askAbout[0].stillMissing.some(item => item.field.includes('summary')));
  assert.equal(session.messages.at(-1).content, 'What led you to seek protection?');
  session = appendAssistantMessage(appendUserMessage(session, 'I cannot remember.'), 'Thank you.', { kind: 'narrative' });
  assert.equal(nextStep(session).kind, 'narrative');
  session = openTopic(session, ['harm'], 'Where did this happen?');
  assert.equal(nextStep(session).kind, 'done');
  assert.equal(session.facts.length, 0); // Never fabricate missing metadata to complete a test.
  assert.equal(JSON.parse(exportSession(session)).testOnly, true);
  assert.equal(JSON.parse(exportSession(createSession('ko', 'full'))).testOnly, undefined);
  assert.ok(requirementsForScope('full').length > requirementsForScope('test').length);
});
