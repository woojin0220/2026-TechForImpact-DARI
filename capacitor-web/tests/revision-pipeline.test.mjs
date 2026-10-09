import test from 'node:test';
import assert from 'node:assert/strict';
import { createSession, appendUserMessage, exportSession } from '../src/intake/index.ts';
import { saveDraftReview } from '../src/revision/pipeline.ts';
import { createDocument, addUserMessage, addAssistantMessage, applySuggestion, undoChange, documentText } from '../src/revision/state.mjs';
import { buildSentenceRequest, parseReply, generateSentenceReply } from '../src/revision/model.mjs';
const text = '정확한 날짜는 기억나지 않습니다. 경찰인지는 모릅니다.';
const setup = () => ({ ...createSession('ko'), draftRevision: 1, question14: { detail: { kind: 'text', text } } });
function proposal() {
  let doc = createDocument(text); const id = doc.pieces.find(p => p.kind === 'sentence').id;
  doc = addUserMessage(doc, id, '뜻을 유지하고 짧게 써 주세요.');
  doc = addAssistantMessage(doc, id, parseReply(JSON.stringify({ type: 'proposal', message: '수정안입니다.', replacement: '정확한 날짜가 기억나지 않습니다.' })), 0);
  return { doc, id, messageId: doc.threads[id].at(-1).id };
}
test('review proposals only enter the official output on explicit apply, preserving source and metadata', () => {
  const original = setup(); const { doc, id, messageId } = proposal();
  let session = saveDraftReview(original, 'detail', text, doc);
  assert.equal(session.question14.detail.text, text);
  const applied = applySuggestion(doc, id, messageId);
  session = saveDraftReview(session, 'detail', text, applied);
  assert.equal(session.question14.detail.text, documentText(applied));
  assert.equal(session.facts, original.facts); assert.equal(session.messages, original.messages);
  const exported = JSON.parse(exportSession(session));
  assert.equal(exported.draftReviews.detail.history.length, 1);
  assert.equal(exported.question14.detail.text, documentText(applied));
  session = saveDraftReview(session, 'detail', documentText(applied), undoChange(applied));
  assert.equal(session.question14.detail.text, text);
});
test('new source invalidates review state and rejects stale callbacks', () => {
  const { doc } = proposal(); const session = saveDraftReview(setup(), 'detail', text, doc);
  const changed = appendUserMessage(session, '사실관계를 정정합니다.');
  assert.equal(changed.draftReviews, undefined);
  assert.throws(() => saveDraftReview(changed, 'detail', text, doc));
  assert.throws(() => saveDraftReview({ ...session, question14: { detail: { kind: 'text', text: '직접 수정함' } } }, 'detail', text, doc));
});
test('request uses existing draft adapter and keeps selected sentence conversation isolated', () => {
  const { doc, id } = proposal();
  const next = addUserMessage(doc, id, '왜 바꿨나요?');
  const request = buildSentenceRequest(next, id), payload = JSON.parse(request.prompt);
  assert.equal(request.task, 'draft'); assert.equal(payload.currentSentence, '정확한 날짜는 기억나지 않습니다.');
  assert.equal(payload.latestUnappliedSuggestion, '정확한 날짜가 기억나지 않습니다.');
  assert.match(request.system, /update the original intake conversation/);
  const englishRequest = buildSentenceRequest(next, id, 'en');
  assert.match(englishRequest.system, /Explain and ask clarifying questions in English/);
  assert.match(englishRequest.system, /Replacement text must remain in Korean/);
  assert.ok(!englishRequest.system.includes('explanation in Korean'));
  assert.equal(JSON.parse(englishRequest.prompt).conversationLanguage, 'English');
  assert.equal(parseReply('{"type":"answer","message":"설명","replacement":"ignored"}').replacement, '');
  for (const raw of ['broken', '{}', '{"type":"proposal","message":"수정","replacement":""}']) assert.throws(() => parseReply(raw));
});
test('English editing rejects Korean explanations, retries once and preserves Korean replacements', async () => {
  const { doc, id } = proposal(); const next = addUserMessage(doc, id, 'Make it clearer.');
  let calls = 0;
  const reply = await generateSentenceReply(next, id, 'en', async () => JSON.stringify({ type:'proposal', message: ++calls === 1 ? '다듬었습니다.' : 'This keeps the uncertainty.', replacement:'정확한 날짜가 기억나지 않습니다.' }));
  assert.equal(calls, 2); assert.equal(reply.message, 'This keeps the uncertainty.');
  assert.equal(reply.replacement, '정확한 날짜가 기억나지 않습니다.');
  calls = 0;
  await assert.rejects(generateSentenceReply(next, id, 'en', async () => { calls++; return JSON.stringify({type:'answer',message:'한국어 설명',replacement:''}); }), /replied in Korean/);
  assert.equal(calls, 2);
});
