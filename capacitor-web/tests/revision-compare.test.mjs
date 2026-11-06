import assert from 'node:assert/strict';
import test from 'node:test';
import { createDocument, documentText, editSentence, isConfirmed, setConfirmed, undoChange, validateDocument, addAssistantMessage } from '../src/revision/state.mjs';
import { originalWordsFor } from '../src/revision/originals.ts';
import { revisionCopies } from '../src/revision/revisionCopy.ts';

const first = doc => doc.pieces.find(piece => piece.kind === 'sentence');

test('a direct edit replaces only the selected sentence, is undoable and stales pending suggestions', () => {
  let doc = createDocument('저는 집회에 갔습니다. 경찰이 왔습니다.');
  const id = first(doc).id;
  doc = addAssistantMessage(doc, id, { type: 'proposal', message: '제안', replacement: '저는 평화 집회에 참석했습니다.' }, 0);
  doc = editSentence(doc, id, ' 저는 2025년 봄 집회에 갔습니다. ');
  assert.equal(documentText(doc), '저는 2025년 봄 집회에 갔습니다. 경찰이 왔습니다.');
  assert.equal(first(doc).originalText, '저는 집회에 갔습니다.');
  assert.equal(doc.history.at(-1).kind, 'edit');
  assert.equal(doc.threads[id][0].proposal.status, 'stale');
  validateDocument(doc);
  assert.throws(() => editSentence(doc, id, '   '));
  assert.throws(() => editSentence(doc, id, '두 줄\n문장'));
  doc = undoChange(doc);
  assert.equal(documentText(doc), '저는 집회에 갔습니다. 경찰이 왔습니다.');
});

test('confirmation belongs to one revision: changing the sentence unconfirms it', () => {
  let doc = createDocument('저는 집회에 갔습니다. 경찰이 왔습니다.');
  const id = first(doc).id;
  assert.equal(isConfirmed(doc, id), false);
  doc = setConfirmed(doc, id, true);
  assert.equal(isConfirmed(doc, id), true);
  validateDocument(doc);
  doc = editSentence(doc, id, '저는 집회에 참석했습니다.');
  assert.equal(isConfirmed(doc, id), false);
  doc = setConfirmed(setConfirmed(doc, id, true), id, false);
  assert.equal(isConfirmed(doc, id), false);
  assert.throws(() => validateDocument({ ...doc, confirmed: { unknown: 0 } }));
});

test('original words are found for a draft sentence, exactly or by overlap', () => {
  const origins = [
    { text: '저는 집회에 갔습니다.', quotes: ['I went to a rally', 'I went to a rally'] },
    { text: '경찰 제복을 입은 두 사람이 집에 찾아왔습니다.', quotes: ['two men in police uniform came'] },
  ];
  assert.deepEqual(originalWordsFor(origins, '저는 집회에 갔습니다.'), ['I went to a rally']);
  assert.deepEqual(originalWordsFor(origins, '경찰 제복을 입은 두 사람이 집에 찾아왔습니다'), ['two men in police uniform came']);
  assert.deepEqual(originalWordsFor(origins, '무관한 문장입니다.'), []);
});

test('comparison copy exists in every revision language and avoids legal judgement claims', () => {
  for (const copy of Object.values(revisionCopies)) {
    for (const key of ['compareView', 'originalWords', 'confirmSentence', 'editDirect', 'notLegal', 'confirmedCount']) assert.ok(copy[key]?.trim(), key);
    assert.match(copy.confirmedCount, /\{n\}/); assert.match(copy.confirmedCount, /\{total\}/);
  }
});
