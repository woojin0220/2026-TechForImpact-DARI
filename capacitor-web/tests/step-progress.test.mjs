import test from 'node:test';
import assert from 'node:assert/strict';
import { stepProgress } from '../src/stepProgress.ts';

const steps = ['basics', 'form', 'conversation', 'facts', 'draft'];

test('progress follows the current step and marks earlier steps passed (#3)', () => {
  const p = stepProgress(steps, 'conversation');
  assert.equal(p.current, 3);
  assert.equal(p.total, 5);
  assert.equal(p.percent, 60);
  assert.equal(p.passed('basics'), true);
  assert.equal(p.passed('form'), true);
  assert.equal(p.passed('conversation'), false);
  assert.equal(p.passed('draft'), false);
});

test('language picker is before the first step and the last step is 100%', () => {
  assert.equal(stepProgress(steps, 'language').current, 0);
  assert.equal(stepProgress(steps, 'language').passed('basics'), false);
  assert.equal(stepProgress(steps, 'draft').percent, 100);
});

test('test scope without the form step still counts correctly', () => {
  const p = stepProgress(['basics', 'conversation', 'facts', 'draft'], 'facts');
  assert.equal(p.current, 3);
  assert.equal(p.percent, 75);
});
