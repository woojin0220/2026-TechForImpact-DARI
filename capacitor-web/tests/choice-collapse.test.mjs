import test from 'node:test';
import assert from 'node:assert/strict';
import { collapseRows, CHOICE_LIMIT } from '../src/form/collapseChoices.ts';
import { scriptedCopy } from '../src/intakeCopy.ts';

const rows = n => Array.from({ length: n }, (_, i) => ({ value: `v${i}`, label: `Choice ${i}` }));

test('short lists never collapse', () => {
  const view = collapseRows(rows(CHOICE_LIMIT), [], false);
  assert.equal(view.collapsible, false);
  assert.equal(view.visible.length, CHOICE_LIMIT);
  assert.equal(view.hidden, 0);
});

test('long lists show the limit until expanded, then everything', () => {
  const collapsed = collapseRows(rows(8), [], false);
  assert.equal(collapsed.collapsible, true);
  assert.equal(collapsed.visible.length, CHOICE_LIMIT);
  assert.equal(collapsed.hidden, 3);
  const open = collapseRows(rows(8), [], true);
  assert.equal(open.visible.length, 8);
  assert.equal(open.hidden, 0);
});

test('collapsing keeps hidden selections and reports them', () => {
  const selected = ['v1', 'v6', 'v7'];
  const view = collapseRows(rows(8), selected, false);
  assert.equal(view.hiddenSelected, 2);
  assert.deepEqual(selected, ['v1', 'v6', 'v7']);
});

test('every language has the more/fewer labels with a count slot', () => {
  for (const [code, copy] of Object.entries(scriptedCopy)) {
    assert.ok(copy.moreChoices.includes('{n}'), code);
    assert.ok(copy.fewerChoices, code);
    assert.ok(copy.hiddenSelected.includes('{n}'), code);
  }
});
