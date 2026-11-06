/** Do not display a foreign-language model reply as an Arabic question.
 * This script check is a fallback, not a proof of translation quality.
 * User quotations and the intentionally Korean draft never pass through it.
 */
export function requireReplyLanguage(reply: string, language: string): string {
  if (language === 'ar' && !/\p{Script_Extensions=Arabic}/u.test(reply.replace(/[^\p{L}]|\u0640/gu, ''))) {
    throw new Error('responseLanguage');
  }
  return reply;
}
