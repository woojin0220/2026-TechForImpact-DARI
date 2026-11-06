import test from 'node:test';
import assert from 'node:assert/strict';
import { visibleOutputs, initialOutput } from '../src/workingCopy.ts';

test('applicants do not see the metadata tab; developer builds keep it (#6)', () => {
  assert.deepEqual(visibleOutputs(false), ['draft', 'source']);
  assert.deepEqual(visibleOutputs(true), ['draft', 'source', 'metadata']);
});

test('a restored metadata tab falls back to the draft outside developer builds', () => {
  assert.equal(initialOutput('metadata', false), 'draft');
  assert.equal(initialOutput('metadata', true), 'metadata');
  assert.equal(initialOutput('source', false), 'source');
  assert.equal(initialOutput(undefined, false), 'draft');
});
