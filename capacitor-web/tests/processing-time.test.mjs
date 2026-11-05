import test from 'node:test';
import assert from 'node:assert/strict';
import { estimateProcessingTime } from '../src/processingTime.ts';

test('initial estimates are ranges and do not infer time from the current step', () => {
  assert.deepEqual(estimateProcessingTime('intake'), { minimum: 120, maximum: 360, learned: false });
  assert.deepEqual(estimateProcessingTime('followup'), { minimum: 20, maximum: 120, learned: false });
});
test('a single cold request cannot replace the provisional estimate', () => {
  assert.equal(estimateProcessingTime('intake', [280]).learned, false);
});
test('recent successful requests provide a bounded median-based range', () => {
  const estimate = estimateProcessingTime('intake', [200, 240, 280]);
  assert.equal(estimate.learned, true);
  assert.ok(estimate.minimum < 240 && estimate.maximum > 240);
});
test('invalid and older samples do not distort the estimate', () => {
  assert.deepEqual(estimateProcessingTime('intake', [NaN, -1, 0]), estimateProcessingTime('intake'));
  assert.deepEqual(estimateProcessingTime('example', [9000, 20, 30, 40, 50, 60]), estimateProcessingTime('example', [20, 30, 40, 50, 60]));
});
