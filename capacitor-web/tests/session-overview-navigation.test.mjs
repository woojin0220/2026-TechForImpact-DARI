import test from 'node:test';
import assert from 'node:assert/strict';
import { formRowIndex } from '../src/sessionOverview/navigation.ts';

const answers = rows => ({ 'family-table': { kind: 'table', rows } });

test('metadata row one focuses the first populated raw row after a blank first row', () => {
  const form = answers([{}, { name: 'Synthetic sibling', relation: '' }]);
  assert.equal(formRowIndex(form, 'family-table', 'row-1'), 1);
  assert.equal(formRowIndex(form, 'family-table', 'row-2'), -1);
});

test('partially filled rows count and interleaved empty rows preserve raw indices', () => {
  const form = answers([{ name: '', relation: 'Parent' }, {}, { name: 'Synthetic sibling' }, { name: '' }, { date: '2024/01/01', note: '' }]);
  assert.equal(formRowIndex(form, 'family-table', 'row-1'), 0);
  assert.equal(formRowIndex(form, 'family-table', 'row-2'), 2);
  assert.equal(formRowIndex(form, 'family-table', 'row-3'), 4);
});

test('whitespace-only cells do not create metadata incidents', () => {
  const form = answers([{ name: ' \n\t ', relation: '\u00a0' }, { name: '', relation: '' }, { name: '  Synthetic name  ' }]);
  assert.equal(formRowIndex(form, 'family-table', 'row-1'), 2);
  assert.equal(formRowIndex(form, 'family-table', 'row-2'), -1);
});

test('missing, non-table, empty table and unknown event IDs do not focus an arbitrary row', () => {
  assert.equal(formRowIndex({}, 'family-table', 'row-1'), -1);
  assert.equal(formRowIndex({ 'family-table': { kind: 'text', text: 'Other input' } }, 'family-table', 'row-1'), -1);
  assert.equal(formRowIndex(answers([]), 'family-table', 'row-1'), -1);
  const form = answers([{ name: 'Synthetic name' }]);
  for (const eventId of [undefined, '', 'incident-1', 'row-0', 'row--1', 'row-1.5', 'row-01', 'row-999999999999999999999', 'row-2']) {
    assert.equal(formRowIndex(form, 'family-table', eventId), -1, String(eventId));
  }
});

test('mapping a row is read-only', () => {
  const row = Object.freeze({ name: 'Synthetic name', relation: '' });
  const form = Object.freeze({ 'family-table': Object.freeze({ kind: 'table', rows: Object.freeze([Object.freeze({}), row]) }) });
  assert.equal(formRowIndex(form, 'family-table', 'row-1'), 1);
});
