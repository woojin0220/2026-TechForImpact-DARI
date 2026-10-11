import test from 'node:test';
import assert from 'node:assert/strict';
import { createSession, appendAssistantMessage, appendUserMessage } from '../src/intake/index.ts';
import { exampleAnswerRequest, parseExampleAnswer } from '../src/intake/exampleAnswer.ts';
test('examples follow the current question and previous answers without mutating the session', () => {
  let session = appendUserMessage(createSession('en', 'test'), 'I cannot remember the exact date.');
  session = appendAssistantMessage(session, 'Where were you?', {kind:'narrative',topics:['harm']});
  const before = JSON.stringify(session);
  const request = exampleAnswerRequest(session);
  assert.deepEqual(JSON.parse(request.prompt), {currentQuestion:'Where were you?',previousAnswers:['I cannot remember the exact date.']});
  assert.match(request.system, /FICTIONAL/);
  assert.equal(JSON.stringify(session), before);
});
test('examples cannot be used in real application mode or without an open question', () => {
  assert.throws(() => exampleAnswerRequest(createSession('en','full')));
  assert.throws(() => exampleAnswerRequest(appendUserMessage(createSession('en','test'),'answer')));
  assert.throws(() => exampleAnswerRequest(appendAssistantMessage(createSession('en','test'),'Done',{kind:'done'})));
});
test('invalid example output does not become an answer', () => {
  for (const raw of ['bad','{}','{"answer":""}','{"answer":"한국어"}']) assert.throws(() => parseExampleAnswer(raw));
  assert.equal(parseExampleAnswer('{"answer":"I was at home."}'),'I was at home.');
});
