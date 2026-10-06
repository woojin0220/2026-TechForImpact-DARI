import assert from 'node:assert/strict';
import test from 'node:test';
import { guidedSourceDraft } from '../src/form/guidedPastHarm.ts';

test('confirmed facts keep the applicant text and uncertainty marker', () => {
  const draft = guidedSourceDraft({
    event: { status: 'answered', text: 'Я был задержан' },
    time: { status: 'uncertain', text: 'В марте 2025 года' },
    actor: { status: 'skipped', text: '' },
  }, 'ru');

  assert.match(draft, /Я был задержан/);
  assert.match(draft, /Не уверен\(а\).*В марте 2025 года/);
  assert.doesNotMatch(draft, /Кто:/);
});

test('empty or skipped answers never produce invented detail', () => {
  assert.equal(guidedSourceDraft({ event: { status: 'answered', text: '  ' } }, 'fr'), '');
  assert.equal(guidedSourceDraft({ event: { status: 'skipped', text: 'old text' } }, 'fr'), '');
});

test('Korean preview keeps the applicant text and uncertainty', () => {
  const draft = guidedSourceDraft({
    event: { status: 'answered', text: '조사를 받았습니다.' },
    time: { status: 'uncertain', text: '2025년 3월쯤' },
  }, 'ko');

  assert.match(draft, /일어난 일: 조사를 받았습니다\./);
  assert.match(draft, /시점 \(불확실함\): 2025년 3월쯤/);
});
