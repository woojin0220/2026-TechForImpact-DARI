import test from 'node:test';
import assert from 'node:assert/strict';
import { canApproveSuggestion } from '../src/revision/approval.ts';

const proposal = { before: '원래 문장', after: '수정 문장', baseRevision: 1, status: 'pending' };

test('English approval waits for the exact suggested text to have an English meaning', () => {
  assert.equal(canApproveSuggestion(proposal, 1, proposal.before, 'en'), false);
  assert.equal(canApproveSuggestion(proposal, 1, proposal.before, 'en', ''), false);
  assert.equal(canApproveSuggestion(proposal, 1, proposal.before, 'en', '다른 수정안'), false);
  assert.equal(canApproveSuggestion(proposal, 1, proposal.before, 'en', proposal.after), true);
});

test('stale, dismissed, applied, changed-source and busy suggestions cannot be approved', () => {
  for (const status of ['stale', 'dismissed', 'applied']) assert.equal(canApproveSuggestion({ ...proposal, status }, 1, proposal.before, 'en', proposal.after), false);
  assert.equal(canApproveSuggestion(proposal, 2, proposal.before, 'en', proposal.after), false);
  assert.equal(canApproveSuggestion(proposal, 1, '다른 원문', 'en', proposal.after), false);
  assert.equal(canApproveSuggestion(proposal, 1, proposal.before, 'en', proposal.after, true), false);
});

test('Korean readers can approve a current suggestion without a back-translation', () => {
  assert.equal(canApproveSuggestion(proposal, 1, proposal.before, 'ko'), true);
});
