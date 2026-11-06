import type { FormStep } from './schema.ts';
import { localizedLabel } from './localize.ts';

/** Screen headings only. Official field wording and IDs stay unchanged. */
const shortEnglishTitles: Record<string, string> = {
  'claim-ground': 'Reasons for seeking protection',
  '14.2': 'Past harm',
  '14.3': 'Fear on return',
  '14.4': 'Harm to family or friends',
  '14.5': 'Requests for protection',
  '14.6': 'Relocation within your country',
};
const shortArabicTitles: Record<string, string> = {
  'claim-ground': 'أسباب طلب الحماية',
  '14.2': 'الأذى في الماضي',
  '14.3': 'الخوف عند العودة',
  '14.4': 'الأذى الذي تعرض له أفراد الأسرة أو الأصدقاء',
  '14.5': 'طلبات الحماية',
  '14.6': 'الانتقال إلى منطقة أخرى داخل بلدك',
};

export function draftSectionTitle(step: FormStep, language: string): string {
  const numbers = [...new Set(step.fields.map(field => field.id.split('-')[0]))];
  const range = numbers.length > 1 ? `${numbers[0]}–${numbers.at(-1)}` : numbers[0];
  const label = language === 'en' ? shortEnglishTitles[step.id] ?? step.titleEn
    : language === 'ar' ? shortArabicTitles[step.id] ?? localizedLabel(language, step.titleKo, step.titleEn)
    : localizedLabel(language, step.titleKo, step.titleEn);
  // Isolate the official numeric range in RTL without changing field IDs.
  return `${['ar', 'fa'].includes(language) ? `\u2066${range}\u2069` : range} ${label}`;
}

export function samePrompt(first: string, second: string): boolean {
  const normalize = (value: string) => value.toLocaleLowerCase().replace(/[\p{P}\p{Z}\s]/gu, '');
  return normalize(first) === normalize(second);
}
