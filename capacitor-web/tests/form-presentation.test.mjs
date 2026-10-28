import test from 'node:test';
import assert from 'node:assert/strict';
import { applicationSteps } from '../src/form/schema.ts';
import { draftSectionTitle, samePrompt } from '../src/form/presentation.ts';

const steps14 = applicationSteps.filter(step => step.fields.every(field => field.id.startsWith('14')));

test('all question 14 section titles are numbered topics, not repeated questions', () => {
  for (const step of steps14) {
    const title = draftSectionTitle(step, 'en');
    assert.match(title, /^14\.\d+/);
    assert.ok(!title.includes('?'));
    for (const field of step.fields) assert.ok(!samePrompt(title.replace(/^\S+\s/, ''), field.en));
  }
  assert.equal(draftSectionTitle(steps14.find(step => step.id === '14.2'), 'en'), '14.2 Past harm');
});

test('multi-question sections retain the complete question number range', () => {
  assert.match(draftSectionTitle(steps14.find(step => step.id === 'organizations'), 'en'), /^14\.8–14\.9 /);
  assert.match(draftSectionTitle(steps14.find(step => step.id === 'minors'), 'ko'), /^14\.13–14\.14 /);
});

test('duplicate labels are detected without dropping different follow-up instructions', () => {
  assert.equal(samePrompt('Marital status', 'Marital status?'), true);
  assert.equal(samePrompt('가족사항', '가족 사항'), true);
  assert.equal(samePrompt('Past harm', 'What happened to you?'), false);
  assert.equal(samePrompt('Why are you applying?', 'Please explain why you are applying.'), false);
});

test('display headings do not modify official form fields', () => {
  const before = JSON.stringify(applicationSteps);
  for (const step of steps14) { draftSectionTitle(step, 'en'); draftSectionTitle(step, 'ko'); }
  assert.equal(JSON.stringify(applicationSteps), before);
});
