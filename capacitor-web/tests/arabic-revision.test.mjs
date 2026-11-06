import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { revisionCopies, revisionCopy, revisionDirection, revisionErrorKey, supportsMeaningReview } from '../src/revision/revisionCopy.ts';
import { createDocument, addUserMessage } from '../src/revision/state.mjs';
import { buildSentenceRequest, parseReply, generateSentenceReply } from '../src/revision/model.mjs';

const pendingArabicRequest = () => {
  // The edited document remains Korean, even though the editing request is Arabic.
  const doc = createDocument('그들이 누구인지 모릅니다.');
  const sentenceId = doc.pieces.find(piece => piece.kind === 'sentence').id;
  return { doc: addUserMessage(doc, sentenceId, 'يرجى توضيح الصياغة دون تغيير المعنى.'), id: sentenceId };
};

test('every revision UI key has a non-empty Arabic translation rather than an English fallback', () => {
  const keys = Object.keys(revisionCopies.en).sort();
  assert.deepEqual(Object.keys(revisionCopies.ar).sort(), keys);
  assert.deepEqual(Object.keys(revisionCopies.ko).sort(), keys);
  for (const key of keys) {
    assert.match(revisionCopies.ar[key], /[\u0600-\u06ff]/u, key);
    assert.notEqual(revisionCopies.ar[key], revisionCopies.en[key], key);
  }
  assert.equal(revisionCopy('ar'), revisionCopies.ar);
});

test('Arabic chrome is RTL but localization alone cannot claim supported meaning review', () => {
  assert.equal(revisionDirection('ar'), 'rtl');
  assert.equal(revisionDirection('fa'), 'rtl');
  assert.equal(revisionDirection('en'), 'ltr');
  assert.equal(supportsMeaningReview('ar'), false);
  assert.equal(supportsMeaningReview('ko'), true);
  assert.equal(supportsMeaningReview('en'), true);
  assert.match(revisionCopies.ar.reviewUnavailable, /الكورية والإنجليزية/);
});

test('technical errors become actionable localized keys rather than leaking raw messages', () => {
  assert.equal(revisionErrorKey(new Error('선택한 문장이 너무 깁니다.')), 'requestTooLong');
  assert.equal(revisionErrorKey(new Error('수정 요청을 입력해 주세요.')), 'emptyRequest');
  assert.equal(revisionErrorKey(new Error('모델 응답 형식이 올바르지 않습니다.')), 'invalidResponse');
  assert.equal(revisionErrorKey(new Error('The model did not reply in Arabic.')), 'wrongLanguage');
  assert.equal(revisionErrorKey(new Error('Network exception: private request content')), 'requestFailed');
});

test('Arabic sentence discussion explicitly requests Arabic explanations and Korean replacements', () => {
  const { doc, id } = pendingArabicRequest();
  const request = buildSentenceRequest(doc, id, 'ar');
  assert.equal(JSON.parse(request.prompt).conversationLanguage, 'Arabic');
  assert.match(request.system, /Arabic only/);
  assert.match(request.system, /Replacement text must remain in Korean/);
  assert.match(request.system, /never claim the suggestion is approved or applied/);
});

test('a wrong-language model explanation is retried once before any rejected message is displayed', async () => {
  const { doc, id } = pendingArabicRequest();
  let calls = 0;
  const reply = await generateSentenceReply(doc, id, 'ar', async () => JSON.stringify({
    type: 'proposal', message: ++calls === 1 ? 'Here is a clearer sentence.' : 'يحافظ هذا الاقتراح على عدم معرفة هويتهم.',
    replacement: '그들이 누구인지는 모릅니다.',
  }));
  assert.equal(calls, 2);
  assert.match(reply.message, /يحافظ/);
  assert.equal(reply.replacement, '그들이 누구인지는 모릅니다.');
  for (const message of ['설명입니다.', 'English only.', 'English with an Arabic comma،', 'English with digits ١٢٣.', 'توضيح 한국어']) {
    assert.throws(() => parseReply(JSON.stringify({ type: 'answer', message, replacement: '' }), 'ar'), /did not reply in Arabic/);
  }
  calls = 0;
  await assert.rejects(generateSentenceReply(doc, id, 'ar', async () => {
    calls++;
    return JSON.stringify({ type: 'answer', message: 'Still English.', replacement: '' });
  }), /did not reply in Arabic/);
  assert.equal(calls, 2);
});

test('revision components use translated feedback and isolate document content from Arabic UI direction', () => {
  const sentence = readFileSync(new URL('../src/revision/SentenceReview.tsx', import.meta.url), 'utf8');
  const meaning = readFileSync(new URL('../src/revision/EnglishMeaning.tsx', import.meta.url), 'utf8');
  const modal = readFileSync(new URL('../src/revision/EditorModal.tsx', import.meta.url), 'utf8');
  assert.match(sentence, /dir=\{revisionDirection\(uiLanguage\)\}/);
  assert.match(sentence, /className="revision-sentences" lang="ko" dir="ltr"/);
  assert.match(sentence, /disabled=\{!reviewSupported \|\| !canApproveSuggestion/);
  assert.match(sentence, /if \(reviewSupported && message\.proposal/);
  assert.match(sentence, /<textarea dir="auto"/);
  assert.match(meaning, /className="meaning-text" lang="en" dir="ltr"/);
  assert.match(meaning, /supportsMeaningReview\(uiLanguage\) \? text : ''/);
  assert.match(meaning, /copy\.meaningFailed/);
  assert.match(meaning, /copy\.meaningLoading/);
  assert.doesNotMatch(meaning, /String\(failure\)|failure\.message|>Loading/);
  assert.match(modal, /dir=\{revisionDirection\(language\)\}/);
});
