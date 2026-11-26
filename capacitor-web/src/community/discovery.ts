export type FeedOptions = { search?: string; unanswered?: boolean };

export const normalizeSearch = (text = '') => text.replace(/[\x00-\x1f\x7f]/g, ' ').trim().slice(0, 80);

/** Literal case-insensitive substring, quoted for PostgREST's filter grammar.
 * Regex metacharacters cannot become operators or inject additional filters. */
export function searchFilter(text: string) {
  const literal = normalizeSearch(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const value = JSON.stringify(literal);
  return `title.imatch.${value},body.imatch.${value}`;
}

export function matchesSearch(title: string, body: string, search = '') {
  return `${title}\n${body}`.toLocaleLowerCase().includes(normalizeSearch(search).toLocaleLowerCase());
}
