import test from 'node:test';
import assert from 'node:assert/strict';
import { meaningRequest, parseMeaning } from '../src/revision/meaning.ts';
test('back-translation is based solely on the actual Korean snapshot', () => {
  const request = meaningRequest('정확한 날짜는 기억나지 않습니다.');
  assert.deepEqual(JSON.parse(request.prompt), { koreanDraft: '정확한 날짜는 기억나지 않습니다.' });
  assert.match(request.system, /do not reconstruct the original English/);
  assert.match(request.system, /Preserve negation, uncertainty, attribution/);
  assert.equal(request.task, 'draft');
  assert.throws(() => meaningRequest(''));
});
test('malformed translations are not presented as a successful meaning check', () => {
  for (const raw of ['{}', 'invalid', '{"translation":" "}', '{"translation":12}']) assert.throws(() => parseMeaning(raw));
  assert.equal(parseMeaning('{"translation":"I do not remember the exact date."}'), 'I do not remember the exact date.');
});
