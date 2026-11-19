/** Community data shapes and pure helpers. No network access here. */
export type BoardId = 'qna' | 'life' | 'notice';
export const boardIds: BoardId[] = ['qna', 'life', 'notice'];
export type BoardFilter = BoardId | 'all';
/** Boards only support organization staff and administrators may post to. */
export const staffBoards: BoardId[] = ['notice'];

export type Author = { author_id: string; author_nickname: string | null; author_is_supporter: boolean; author_badges: string[] };
export type PostSummary = Author & {
  id: string; board_id: BoardId; title: string; body: string; language: string; status: string;
  created_at: string; comment_count: number; helpful_count: number; helped_by_me: boolean;
};
export type CommentItem = Author & { id: string; post_id: string; body: string; language: string; status: string; created_at: string };
export type ReportReason = 'identity' | 'scam' | 'hate' | 'spam' | 'other';
export const reportReasons: ReportReason[] = ['identity', 'scam', 'hate', 'spam', 'other'];

export function writableBoards(canPostNotices: boolean): BoardId[] {
  return boardIds.filter(board => canPostNotices || !staffBoards.includes(board));
}

export function excerpt(text: string, limit = 90) {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > limit ? `${flat.slice(0, limit - 1)}…` : flat;
}

export function isValidTitle(value: string) { const length = value.trim().length; return length >= 2 && length <= 100; }
export function isValidBody(value: string, limit = 5000) { const length = value.trim().length; return length >= 1 && length <= limit; }

export type SensitiveKind = 'phone' | 'email' | 'idNumber';

/**
 * Flags text that looks like contact details or identity numbers before it is posted.
 * A warning only: members can still post after reviewing it.
 */
export function detectSensitive(text: string): SensitiveKind[] {
  const found = new Set<SensitiveKind>();
  const normalized = text.replace(/[٠-٩]/g, digit => String(digit.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, digit => String(digit.charCodeAt(0) - 0x06F0));
  if (/[^\s@]+@[^\s@]+\.[^\s@]{2,}/.test(normalized)) found.add('email');
  // Korean resident/foreigner registration number: 6 digits - 7 digits.
  if (/\b\d{6}\s*-\s*\d{7}\b/.test(normalized)) found.add('idNumber');
  // Passport-like: one or two letters followed by 7–8 digits.
  if (/\b[A-Za-z]{1,2}\d{7,8}\b/.test(normalized)) found.add('idNumber');
  // Phone numbers: 9–13 digits with optional +, spaces, dots or hyphens.
  for (const match of normalized.matchAll(/\+?\d[\d\s.-]{7,16}\d/g)) {
    const digits = match[0].replace(/\D/g, '');
    if (digits.length >= 9 && digits.length <= 13 && !/^\d{6}\s*-\s*\d{7}$/.test(match[0].trim())) found.add('phone');
  }
  return [...found];
}

/** "3 minutes ago" in the reader's language, falling back to a date for older items. */
export function relativeTime(iso: string, language: string, now = Date.now()) {
  const seconds = Math.round((new Date(iso).getTime() - now) / 1000);
  const abs = Math.abs(seconds);
  try {
    const format = new Intl.RelativeTimeFormat(language, { numeric: 'auto' });
    if (abs < 60) return format.format(0, 'second');
    if (abs < 3600) return format.format(Math.round(seconds / 60), 'minute');
    if (abs < 86400) return format.format(Math.round(seconds / 3600), 'hour');
    if (abs < 7 * 86400) return format.format(Math.round(seconds / 86400), 'day');
    return new Intl.DateTimeFormat(language, { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(iso));
  } catch { return new Date(iso).toISOString().slice(0, 10); }
}
