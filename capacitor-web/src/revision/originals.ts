/** One drafted Korean sentence and the applicant's own words it was written from. */
export type SentenceOrigin = { text: string; quotes: string[] };

const normalize = (text: string) => text.replace(/\s+/g, ' ').trim();

/** The applicant's original words for one sentence of the editor. Editor sentences
 * are split again from the draft text, so match by text and fall back to overlap. */
export function originalWordsFor(origins: SentenceOrigin[], sentenceText: string): string[] {
  const target = normalize(sentenceText);
  if (!target) return [];
  const exact = origins.filter(origin => normalize(origin.text) === target);
  const matches = exact.length ? exact : origins.filter(origin => {
    const text = normalize(origin.text);
    return !!text && (text.includes(target) || target.includes(text));
  });
  return [...new Set(matches.flatMap(origin => origin.quotes.map(normalize)).filter(Boolean))];
}
