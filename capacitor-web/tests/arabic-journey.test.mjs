import test from 'node:test';
import assert from 'node:assert/strict';
import { journeyCopies, journeyCopyFor, journeyTopicTitle, journeyDetailTitle, journeyStatusLabel } from '../src/journeyCopy.ts';
import { metadata14, metadataGroups } from '../src/intake/metadata14.ts';

test('every applicant journey key has a nonempty Arabic translation, with no English copy fallback', () => {
  assert.deepEqual(Object.keys(journeyCopies.ar).sort(), Object.keys(journeyCopies.en).sort());
  assert.deepEqual(Object.keys(journeyCopies.ko).sort(), Object.keys(journeyCopies.en).sort());
  for (const [key, text] of Object.entries(journeyCopies.ar)) {
    assert.match(text, /\p{Script=Arabic}/u, key);
    assert.doesNotMatch(text, /[A-Za-z\p{Script=Hangul}]/u, key);
    assert.notEqual(text, journeyCopies.en[key], key);
  }
  assert.equal(journeyCopyFor('ar'), journeyCopies.ar);
});

test('all conversation topic and metadata field titles are meaningful Arabic, not a generic missing-key fallback', () => {
  for (const group of metadataGroups) {
    const title = journeyTopicTitle(group.id, group.en, 'ar');
    assert.match(title, /\p{Script=Arabic}/u, group.id);
    assert.notEqual(title, journeyCopies.ar.fieldDetails, group.id);
  }
  for (const item of metadata14) {
    const title = journeyDetailTitle(item.id, item.labelEn, 'ar');
    assert.match(title, /\p{Script=Arabic}/u, item.id);
    assert.notEqual(title, journeyCopies.ar.fieldDetails, item.id);
    assert.doesNotMatch(title, /\p{Script=Hangul}/u, item.id);
  }
});

test('unknown machine statuses or new unmapped headings do not leak raw English to Arabic users', () => {
  for (const status of ['answered', 'unknown', 'skipped', 'not_applicable', 'conflict', 'missing', 'blocked', 'new_status']) {
    assert.match(journeyStatusLabel(status, 'ar'), /\p{Script=Arabic}/u);
  }
  assert.equal(journeyTopicTitle('future-topic', 'A future heading', 'ar'), journeyCopies.ar.fieldDetails);
  assert.equal(journeyDetailTitle('future-field', 'A future heading', 'ar'), journeyCopies.ar.fieldDetails);
  assert.equal(journeyTopicTitle('future-topic', 'عنوان عربي', 'ar'), 'عنوان عربي');
});

test('Arabic final-review notice discloses the English-only capability instead of claiming Arabic verification', () => {
  assert.match(journeyCopies.ar.unsupportedMeaning, /بالإنجليزية فقط/);
  assert.match(journeyCopies.ar.unsupportedMeaning, /ليست متاحة بالعربية/);
  assert.match(journeyCopies.ar.unsupportedMeaning, /غير مؤكد/);
});
