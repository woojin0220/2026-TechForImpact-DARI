import test from 'node:test';
import assert from 'node:assert/strict';
import { applicationSteps } from '../src/form/schema.ts';
import { requirementCatalog } from '../src/intake/catalog.ts';
import { metadataGroups } from '../src/intake/metadata14.ts';
import { intakeCopies, intakeProcessCopy, scriptedCopy } from '../src/intakeCopy.ts';
import { hasLocalizedPhrase, localize, localizedLabel, localizedRequirementLabel } from '../src/form/localize.ts';
import { draftSectionTitle } from '../src/form/presentation.ts';

const arabic = /\p{Script=Arabic}/u;
const hangul = /\p{Script=Hangul}/u;

function checkLabel(korean, english, context) {
  assert.equal(hasLocalizedPhrase('ar', korean), true, `missing Arabic key: ${context}: ${korean}`);
  const result = localizedLabel('ar', korean, english);
  assert.match(result, arabic, `Arabic text absent: ${context}`);
  assert.doesNotMatch(result, hangul, `Korean fallback: ${context}`);
  assert.notEqual(result, english, `English fallback: ${context}`);
  assert.equal(localizedLabel('ko', korean, english), korean);
  assert.equal(localizedLabel('en', korean, english), english);
}

test('Arabic covers every official step, question, hint, option and table column', () => {
  for (const step of applicationSteps) {
    checkLabel(step.sectionKo, step.sectionEn, `${step.id}:section`);
    checkLabel(step.titleKo, step.titleEn, `${step.id}:title`);
    for (const field of step.fields) {
      checkLabel(field.ko, field.en, field.id);
      if (field.hintKo) checkLabel(field.hintKo, field.hintEn, `${field.id}:hint`);
      for (const option of field.options ?? []) checkLabel(option.ko, option.en, `${field.id}:${option.value}`);
      for (const column of field.columns ?? []) checkLabel(column.ko, column.en, `${field.id}:${column.id}`);
    }
  }
});

test('Arabic covers the complete conversation and personal-confirmation catalog', () => {
  for (const requirement of requirementCatalog) {
    checkLabel(requirement.label, requirement.labelEn, requirement.id);
    assert.equal(localizedRequirementLabel(requirement, 'ar'), localizedLabel('ar', requirement.label, requirement.labelEn));
    for (const option of requirement.options ?? []) checkLabel(option.ko, option.en, `${requirement.id}:${option.value}`);
  }
  for (const group of metadataGroups) checkLabel(group.ko, group.en, `${group.id}:group`);
});

test('core Arabic copy has exactly the same keys and interpolation slots as English', () => {
  for (const [name, copies] of Object.entries({ intakeCopies, intakeProcessCopy, scriptedCopy })) {
    assert.deepEqual(Object.keys(copies.ar).sort(), Object.keys(copies.en).sort(), name);
    for (const [key, english] of Object.entries(copies.en)) {
      const value = copies.ar[key];
      assert.equal(typeof value, 'string', `${name}.${key}`);
      assert.ok(value.trim(), `${name}.${key}`);
      assert.match(value, arabic, `${name}.${key}`);
      assert.doesNotMatch(value, hangul, `${name}.${key}`);
      assert.notEqual(value, english, `${name}.${key}`);
      assert.deepEqual(value.match(/\{\w+\}/g) ?? [], english.match(/\{\w+\}/g) ?? [], `${name}.${key}:interpolation`);
    }
  }
});

test('Arabic labels preserve distinctions between identity, motive and uncertainty', () => {
  const byId = new Map(requirementCatalog.map(requirement => [requirement.id, requirement]));
  const actor = localizedRequirementLabel(byId.get('harm.actor'), 'ar');
  const reason = localizedRequirementLabel(byId.get('harm.reason'), 'ar');
  assert.notEqual(actor, reason);
  assert.match(actor, /هويته/u);
  assert.match(reason, /على أي أساس/u);
  assert.match(localizedRequirementLabel(byId.get('harm.time'), 'ar'), /التقريب|عدم المعرفة/u);
});

test('Arabic draft headings are translated and retain ordered numeric ranges', () => {
  for (const step of applicationSteps.filter(item => item.fields.every(field => field.id.startsWith('14')))) {
    const label = draftSectionTitle(step, 'ar');
    assert.match(label, /^\u206614\.\d+(?:–14\.\d+)?\u2069 /u);
    assert.match(label, arabic);
    assert.doesNotMatch(label, hangul);
  }
  const org = applicationSteps.find(step => step.id === 'organizations');
  assert.match(draftSectionTitle(org, 'ar'), /^\u206614\.8–14\.9\u2069 /u);
});

test('Arabic-only metadata additions do not claim translation coverage in unrelated languages', () => {
  const label = requirementCatalog.find(requirement => requirement.id === 'harm.actor');
  assert.equal(hasLocalizedPhrase('ar', label.label), true);
  assert.equal(hasLocalizedPhrase('fr', label.label), false);
  assert.equal(localizedRequirementLabel(label, 'fr'), label.labelEn);
});

test('new unknown Arabic labels fail visibly without exposing an English fallback', () => {
  const value = localizedLabel('ar', '앞으로 추가될 문항', 'A future untranslated question');
  assert.match(value, /غير متاحة/u);
  assert.doesNotMatch(value, /future|untranslated|[가-힣]/u);
});

test('localization never changes official wording, field IDs or catalog objects', () => {
  const before = JSON.stringify({ applicationSteps, requirementCatalog });
  for (const requirement of requirementCatalog) localizedRequirementLabel(requirement, 'ar');
  for (const step of applicationSteps) draftSectionTitle(step, 'ar');
  localize('ar', '예');
  assert.equal(JSON.stringify({ applicationSteps, requirementCatalog }), before);
});
