import test from 'node:test';
import assert from 'node:assert/strict';
import { createModelQueue } from '../src/lib/modelQueue.ts';

const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };

test('requests run one at a time instead of failing when another is running', async () => {
  const queue = createModelQueue();
  const order = [];
  const first = deferred();
  const a = queue.run(async () => { order.push('a start'); await first.promise; order.push('a end'); return 'a'; });
  const b = queue.run(async () => { order.push('b start'); return 'b'; });
  await Promise.resolve();
  assert.deepEqual(order, ['a start']);
  first.resolve();
  assert.deepEqual(await Promise.all([a, b]), ['a', 'b']);
  assert.deepEqual(order, ['a start', 'a end', 'b start']);
});

test('the applicant’s request goes ahead of queued back-translations', async () => {
  const queue = createModelQueue();
  const order = [];
  const gate = deferred();
  const running = queue.run(async () => { await gate.promise; order.push('running'); }, 'background');
  const bg = queue.run(async () => { order.push('background'); }, 'background');
  const fg = queue.run(async () => { order.push('foreground'); });
  gate.resolve();
  await Promise.all([running, bg, fg]);
  assert.deepEqual(order, ['running', 'foreground', 'background']);
});

test('a request cancelled while waiting never reaches the model', async () => {
  const queue = createModelQueue();
  const gate = deferred();
  const controller = new AbortController();
  let called = false;
  const first = queue.run(() => gate.promise);
  const second = queue.run(async () => { called = true; }, 'foreground', controller.signal);
  controller.abort();
  await assert.rejects(second, { name: 'AbortError' });
  gate.resolve();
  await first;
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(called, false);
  assert.equal(queue.pending(), 0);
  assert.equal(queue.busy(), false);
});

test('a failed request does not block the next one', async () => {
  const queue = createModelQueue();
  await assert.rejects(queue.run(async () => { throw new Error('model failed'); }));
  assert.equal(await queue.run(async () => 'ok'), 'ok');
});
