/** A completion guard, not a measure of semantic translation accuracy. */
const originalNameFields = new Set(['1.2', '1.3', '10.12', '10.13']);
export function preserveOriginal(text: string, questionId?: string): boolean {
  const value = text.trim();
  return !!value && (originalNameFields.has(questionId ?? '') ||
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ||
    /^[\d\s/+().:\-–]+$/.test(value) || /^[A-Za-z]{1,3}-\d{1,3}$/.test(value));
}
export function translationProblem(source: string, language: string, result: string, questionId?: string, target='ko'): string | null {
  const text = result.trim();
  if (!text) return 'EMPTY_TRANSLATION';
  if (language === target || preserveOriginal(source, questionId)) return null;
  if(target==='en'&&(!/\p{Script=Latin}/u.test(text)||text===source.trim()))return 'UNTRANSLATED_ANSWER';
  const letters = text.match(/\p{L}/gu) ?? [];
  if (target==='ko'&&!/[가-힣]/.test(text)) return 'UNTRANSLATED_ANSWER';
  // Catch substantial source-script leakage while allowing names inside Korean sentences.
  const sourceScript = language === 'ru' ? /\p{Script=Cyrillic}/gu :
    ['ar', 'fa'].includes(language) ? /\p{Script=Arabic}/gu : language==='ko'&&target==='en'?/\p{Script=Hangul}/gu:null;
  const remaining = sourceScript ? (text.match(sourceScript) ?? []).length : 0;
  const foreignWords = sourceScript ? text.split(/\s+/).filter(word => {
    const part = (word.match(sourceScript) ?? []).join('');
    return part.length >= 2 && !(language === 'ru' && /^[А-ЯЁ][а-яё]+$/.test(part));
  }).length : 0;
  if (foreignWords >= (language === 'ru' ? 2 : 3) && remaining >= 12 && remaining / Math.max(1, letters.length) > 0.4) return 'UNTRANSLATED_ANSWER';
  return null;
}
export function requireTranslation(source: string, language: string, result: string, questionId?: string, target='ko'): string {
  const problem = translationProblem(source, language, result, questionId,target);
  if (problem) throw new Error(`${problem}${questionId ? `:${questionId}` : ''}`);
  return result.trim();
}
