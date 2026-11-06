import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { benchCopies, benchCopy, formatBenchCopy } from '../src/bench/benchCopy.ts';

test('all benchmark controls and summary headers have complete Arabic keys', () => {
  const keys = Object.keys(benchCopies.en).sort();
  assert.deepEqual(Object.keys(benchCopies.ko).sort(), keys);
  assert.deepEqual(Object.keys(benchCopies.ar).sort(), keys);
  for (const key of keys) {
    assert.match(benchCopies.ar[key], /[\u0620-\u064a]/u, key);
    assert.notEqual(benchCopies.ar[key], benchCopies.en[key], key);
  }
  assert.equal(benchCopy('ar'), benchCopies.ar);
});

test('localized counts keep all variables and do not expose runner diagnostics', () => {
  for (const copy of Object.values(benchCopies)) {
    const count = formatBenchCopy(copy.count, { languages: 6, scenarios: 4, repeats: 2, total: 48 });
    for (const expected of ['6', '4', '2', '48']) assert.ok(count.includes(expected));
    assert.doesNotMatch(count, /\{\w+\}/);
    assert.doesNotMatch(formatBenchCopy(copy.running, { done: 3, total: 48 }), /\{\w+\}/);
  }
  const source = readFileSync(new URL('../src/bench/BenchPanel.tsx', import.meta.url), 'utf8');
  assert.match(source, /language = 'ko'/);
  assert.match(source, /onProgress: \(\) => setProgress/);
  assert.doesNotMatch(source, /setProgress\(`|String\(failure\)|failure\.message/);
  assert.match(source, /setError\('runFailed'\)/);
  assert.match(source, /\{copy\[error\]\}/);
});
