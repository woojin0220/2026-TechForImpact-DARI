import assert from 'node:assert/strict';
import test from 'node:test';
import { prepareReconfirmation } from '../src/form/reconfirmation.ts';

const example = [{
  type: '불확실성 변화', direction: '방향 불명확', severity: '높음',
  sourceExcerpt: '날짜는 기억나지 않습니다.',
  translationExcerpt: 'It happened on March 15.',
  explanation: '불확실한 날짜가 특정 날짜로 바뀌었습니다.',
}];

test('Korean review translates the English meaning but reuses Korean explanation', async () => {
  const calls = [];
  const views = await prepareReconfirmation(example, 'ko', 'test-model', async (_model, source, target, items) => {
    calls.push([source, target]);
    return Object.fromEntries(items.map((item) => [item.id, '3월 15일에 일어났습니다.']));
  });
  assert.deepEqual(calls, [['en', 'ko']]);
  assert.equal(views[0].englishMeaning, '3월 15일에 일어났습니다.');
  assert.equal(views[0].explanation, example[0].explanation);
});

test('other languages receive translated meaning and explanation', async () => {
  const calls = [];
  const views = await prepareReconfirmation(example, 'ru', 'test-model', async (_model, source, target, items) => {
    calls.push([source, target]);
    return Object.fromEntries(items.map((item) => [item.id, source === 'en' ? 'Это произошло 15 марта.' : 'Дата стала точной.']));
  });
  assert.deepEqual(calls, [['en', 'ru'], ['ko', 'ru']]);
  assert.equal(views[0].englishMeaning, 'Это произошло 15 марта.');
  assert.equal(views[0].explanation, 'Дата стала точной.');
});

test('failed translation is explicit rather than treated as matching', async () => {
  const views = await prepareReconfirmation(example, 'ru', 'test-model', async () => { throw new Error('unavailable'); });
  assert.deepEqual(views, [{ englishMeaning: null, explanation: null }]);
});
