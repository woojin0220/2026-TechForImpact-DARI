import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanModelOutput, createTranslator, languageName, needsTranslation, translationPrompt } from '../src/community/translation.ts';

test('only text in another language is translated', () => {
  assert.equal(needsTranslation('ar', 'ko'), true);
  assert.equal(needsTranslation('ko', 'ko'), false);
  assert.equal(needsTranslation('fa-IR', 'fa'), false);
  assert.equal(needsTranslation('', 'ko'), false);
  assert.equal(needsTranslation(null, 'ko'), false);
});

test('translator caches results, skips same-language text and retries after a failure', async () => {
  const calls = [];
  let fail = true;
  const translator = createTranslator({ fast: true, translate: async (text, source, target) => {
    calls.push(`${source}>${target}:${text}`);
    if (text === 'flaky' && fail) { fail = false; throw new Error('model busy'); }
    return `[${target}] ${text}`;
  } });
  assert.equal(await translator.translate('안녕하세요', 'ko', 'ko'), '안녕하세요');
  assert.equal(await translator.translate('مرحبا', 'ar', 'ko'), '[ko] مرحبا');
  assert.equal(await translator.translate('مرحبا ', 'ar', 'ko'), '[ko] مرحبا');
  assert.equal(calls.length, 1);
  await assert.rejects(translator.translate('flaky', 'en', 'ko'));
  assert.equal(await translator.translate('flaky', 'en', 'ko'), '[ko] flaky');
  assert.equal(translator.fast, true);
});

test('an empty model answer counts as a failure', async () => {
  const translator = createTranslator({ fast: false, translate: async () => '   ' });
  await assert.rejects(translator.translate('Hello', 'en', 'ko'));
});

test('model wrappers are stripped from translations', () => {
  assert.equal(cleanModelOutput('"안녕하세요"'), '안녕하세요');
  assert.equal(cleanModelOutput('Translation: Bonjour'), 'Bonjour');
  assert.equal(cleanModelOutput('```\n줄1\n줄2\n```'), '줄1\n줄2');
  assert.equal(cleanModelOutput('그는 "네"라고 했어요'), '그는 "네"라고 했어요');
});

test('prompt names both languages and language names follow the reader', () => {
  const { system, prompt } = translationPrompt('سلام', 'fa', 'ko');
  assert.match(system, /Persian/); assert.match(system, /Korean/);
  assert.equal(prompt, 'سلام');
  assert.equal(languageName('ar', 'ko'), '아랍어');
});
