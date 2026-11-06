import test from 'node:test';
import assert from 'node:assert/strict';
import { appEnglish, appArabic, appKorean, appCopyFor, localizeAppError } from '../src/appCopy.ts';
import { requireReplyLanguage } from '../src/intake/replyLanguage.ts';
import { createSession, appendUserMessage, continueConversation, getExtractionFormat, setExtractionFormat, getAuxiliaryPasses, setAuxiliaryPasses } from '../src/intake/index.ts';

test('Arabic application keys are exhaustive, nonempty and do not fall back to English', () => {
  const keys = Object.keys(appEnglish).sort();
  assert.deepEqual(Object.keys(appArabic).sort(), keys);
  assert.deepEqual(Object.keys(appKorean).sort(), keys);
  assert.equal(appCopyFor('ar'), appArabic);
  for (const key of keys) {
    assert.match(appArabic[key], /\p{Script=Arabic}/u, key);
    assert.notEqual(appArabic[key], appEnglish[key], key);
  }
});

test('engine, validation, timeout and unknown errors become useful Arabic without raw diagnostics', () => {
  const cases = [
    ['Failed to fetch', 'connectionError'],
    ['TimeoutError: request timed out', 'cancelled'],
    ['요청이 취소되었거나 처리 시간을 초과했습니다.', 'cancelled'],
    ['이전 모델 요청을 처리하고 있습니다.', 'busyError'],
    ['선택 모델이 없습니다.', 'modelMissingError'],
    ['한 번에 보낼 수 있는 답변은 12,000자까지입니다.', 'inputLengthError'],
    ['원문 인용 근거가 없습니다.', 'sourceError'],
    ['모델이 올바른 JSON 객체를 반환하지 않았습니다.', 'responseError'],
    ['Unexpected secret technical diagnostic', 'genericError'],
    ['constructor', 'genericError'],
    ['responseLanguage', 'responseLanguage'],
  ];
  for (const [raw, key] of cases) {
    assert.equal(localizeAppError('ar', new Error(raw)), appArabic[key], raw);
  }
});

test('Arabic assistant replies reject English plus Arabic digits or punctuation only', () => {
  for (const reply of ['What happened?', 'What happened? ١٢٣ ؟', 'Hello ـَ']) {
    assert.throws(() => requireReplyLanguage(reply, 'ar'), /responseLanguage/);
  }
  assert.equal(requireReplyLanguage('ماذا حدث لك؟', 'ar'), 'ماذا حدث لك؟');
  assert.equal(requireReplyLanguage('What happened?', 'en'), 'What happened?');
});

test('wrong-language model output is not appended and the original Arabic answer survives retry', async () => {
  const format = getExtractionFormat(), aux = getAuxiliaryPasses();
  setExtractionFormat('full'); setAuxiliaryPasses('off');
  try {
    const before = appendUserMessage(createSession('ar', 'priority'), 'حدث ذلك قرب منزلي.');
    let saved;
    await assert.rejects(continueConversation(before, async () => JSON.stringify({reply: 'What happened?', facts: []})), error => {
      assert.match(error.message, /responseLanguage/);
      saved = error.session;
      assert.equal(saved.messages.at(-1).content, 'حدث ذلك قرب منزلي.');
      assert.ok(!saved.messages.some(message => message.content === 'What happened?'));
      return true;
    });
    const after = await continueConversation(saved, async () => JSON.stringify({reply: 'شكرًا لك. هل ترغب في التوضيح؟', facts: []}));
    assert.equal(after.messages.filter(message => message.role === 'user').length, 1);
    assert.match(after.messages.at(-1).content, /شكرًا/);
  } finally { setExtractionFormat(format); setAuxiliaryPasses(aux); }
});
