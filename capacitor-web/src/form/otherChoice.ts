import { applicationSteps } from './schema.ts';

/** Option value the official form uses for “기타 / Other”. */
export const OTHER_OPTION = 'other';
type Option = { value: string; ko: string; en: string };

// Questions whose “기타” already opens a separate short box on the official form (1.13-other, 7.5-other, 9.10-other).
const ownOtherBox = new Set(applicationSteps.flatMap(step => step.fields)
  .filter(field => field.type === 'short' && field.when?.length === 1 && field.when[0].anyOf.length === 1 && field.when[0].anyOf[0] === OTHER_OPTION)
  .map(field => field.when![0].id));

/** A choice question takes inline “기타 직접 입력” text when it offers an Other option
 * and the official form has no separate box for that text. */
export function takesOtherText(id: string, options?: Option[]): boolean {
  return !!options?.some(option => option.value === OTHER_OPTION) && !ownOtherBox.has(id);
}

/** Korean option labels for stored choice values, with the applicant's own
 * “기타” wording in parentheses. The free text is kept verbatim, never translated. */
export function koreanChoiceText(options: Option[] | undefined, values: string[], other?: string, separator = ', '): string {
  const detail = other?.trim();
  return values.map(value => {
    const label = options?.find(option => option.value === value)?.ko ?? value;
    return value === OTHER_OPTION && detail ? `${label}(${detail})` : label;
  }).join(separator);
}
