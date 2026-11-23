/** A completion guard, not a measure of semantic translation accuracy. */
const originalNameFields = new Set(['1.2', '1.3', '10.12', '10.13']);
export function preserveOriginal(text: string, questionId?: string): boolean {
  const value = text.trim();
  return !!value && (originalNameFields.has(questionId ?? '') ||
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ||
    /^[\d\s/+().:\-–]+$/.test(value) || /^[A-Za-z]{1,3}-\d{1,3}$/.test(value));
}
export function translationProblem(source: string, language: string, result: string, questionId?: string): string | null {
  const text = result.trim();
  if (!text) return 'EMPTY_TRANSLATION';
  if (language === 'ko' || preserveOriginal(source, questionId)) return null;
  const letters = text.match(/\p{L}/gu) ?? [];
  if (!/[가-힣]/.test(text)) return 'UNTRANSLATED_ANSWER';
  // Catch substantial source-script leakage while allowing names inside Korean sentences.
  const sourceScript = language === 'ru' ? /\p{Script=Cyrillic}/gu :
    ['ar', 'fa'].includes(language) ? /\p{Script=Arabic}/gu : null;
  const remaining = sourceScript ? (text.match(sourceScript) ?? []).length : 0;
  const foreignWords = sourceScript ? text.split(/\s+/).filter(word => {
    const part = (word.match(sourceScript) ?? []).join('');
    return part.length >= 2 && !(language === 'ru' && /^[А-ЯЁ][а-яё]+$/.test(part));
  }).length : 0;
  if (foreignWords >= (language === 'ru' ? 2 : 3) && remaining >= 12 && remaining / Math.max(1, letters.length) > 0.4) return 'UNTRANSLATED_ANSWER';
  return null;
}
export function requireTranslation(source: string, language: string, result: string, questionId?: string): string {
  const problem = translationProblem(source, language, result, questionId);
  if (problem) throw new Error(`${problem}${questionId ? `:${questionId}` : ''}`);
  return result.trim();
}
