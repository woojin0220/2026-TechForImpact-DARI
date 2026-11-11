import { isFieldVisible, requirementsById, type FormAnswers, type IntakeFact, type IntakeScope, type ScriptedAsk } from '../intake/index.ts';
import type { FormField } from '../form/schema.ts';
import { localize, localizedRequirementLabel } from '../form/localize.ts';
import { koreanChoiceText, OTHER_OPTION } from '../form/otherChoice.ts';
import { statusWords } from '../statusCopy.ts';
import type { ScriptedCopy } from '../intakeCopy.ts';

/** Display helpers shared by the conversation, review and draft screens. */
export type ChoiceOption = { value: string; ko: string; en: string };

export function requirementLabel(id: string, language: string): string {
  const requirement = requirementsById.get(id);
  return requirement ? localizedRequirementLabel(requirement, language) : id;
}

export function optionLabel(option: { ko: string; en: string }, language: string): string {
  return language === 'en' ? option.en : localize(language, option.ko);
}

/** A stored answer in the applicant's language; “기타” text is appended verbatim. */
export function factValue(id: string, value: string | string[], language: string, other?: string): string {
  const options = requirementsById.get(id)?.options ?? [];
  return (Array.isArray(value) ? value : [value]).map(item => {
    const option = options.find(choice => choice.value === item);
    if (!option) return item;
    const label = optionLabel(option, language);
    return item === OTHER_OPTION && other ? `${label}: ${other}` : label;
  }).join(' · ');
}

/** A stored answer in Korean, prefixed with its status when it is not a plain answer. */
export function koreanValue(fact: IntakeFact): string {
  const options = requirementsById.get(fact.requirementId)?.options ?? [];
  const value = koreanChoiceText(options, Array.isArray(fact.value) ? fact.value : [fact.value], fact.otherText);
  return fact.status === 'answered' ? value : `${statusWords.ko[fact.status]} (${value})`;
}

/** The applicant's message for a confirmed choice; “기타” text stays verbatim. */
export function pickedText(options: ChoiceOption[], values: string[], language: string, other = ''): string {
  const detail = values.includes(OTHER_OPTION) ? other.trim() : '';
  return options.filter(option => values.includes(option.value))
    .map(option => option.value === OTHER_OPTION && detail ? `${optionLabel(option, language)}: ${detail}` : optionLabel(option, language)).join(', ');
}

/** The assistant message that asks a scripted question. */
export function questionText(item: ScriptedAsk, language: string, copy: ScriptedCopy, row?: number): string {
  const label = requirementLabel(item.requirementId, language);
  if (item.kind === 'table') return `${label} — ${copy.tableAsk}`;
  if (item.kind === 'more') return `${label} — ${copy.tableMore}`;
  return row ? `${copy.row.replace('{n}', String(row))} · ${label}` : label;
}

/** Question 14 fields shown in the draft; the short test only covers 14.1 to 14.3. */
export function isDraftFieldShown(field: FormField, answers: FormAnswers, scope: IntakeScope): boolean {
  return isFieldVisible(field, answers) && (scope !== 'test' || /^14\.[123](?:-|$)/.test(field.id));
}
