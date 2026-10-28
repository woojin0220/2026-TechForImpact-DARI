import type { FormStep } from './schema.ts';

/** Screen headings only. Official field wording and IDs stay unchanged. */
const shortEnglishTitles: Record<string, string> = {
  'claim-ground': 'Reasons for seeking protection',
  '14.2': 'Past harm',
  '14.3': 'Fear on return',
  '14.4': 'Harm to family or friends',
  '14.5': 'Requests for protection',
  '14.6': 'Relocation within your country',
};

export function draftSectionTitle(step: FormStep, language: string): string {
  const numbers = [...new Set(step.fields.map(field => field.id.split('-')[0]))];
  const range = numbers.length > 1 ? `${numbers[0]}–${numbers.at(-1)}` : numbers[0];
  return `${range} ${language === 'en' ? shortEnglishTitles[step.id] ?? step.titleEn : step.titleKo}`;
}

export function samePrompt(first: string, second: string): boolean {
  const normalize = (value: string) => value.toLocaleLowerCase().replace(/[\p{P}\p{Z}\s]/gu, '');
  return normalize(first) === normalize(second);
}
