/** Pure account rules shared by the screens and tests. No network access here. */
export type AppRole = 'user' | 'supporter' | 'moderator' | 'admin';
export type ConsentDocument = 'terms' | 'privacy' | 'community';

/** Bump a version when the document text changes; members are asked to agree again. */
export const consentVersions: Record<ConsentDocument, string> = { terms: '2026-11', privacy: '2026-11', community: '2026-11' };
export const consentDocuments = Object.keys(consentVersions) as ConsentDocument[];
export const supportedProfileLanguages = ['ko', 'en', 'fr', 'ru', 'ar', 'fa'];

export type Profile = {
  user_id: string;
  nickname: string | null;
  preferred_language: string;
  age_confirmed_at: string | null;
  status: 'active' | 'suspended';
};
export type ConsentRecord = { document: ConsentDocument; version: string; withdrawn_at: string | null };
export type Account = { email: string; profile: Profile; roles: AppRole[]; consents: ConsentRecord[] };

export type OnboardingNeed = 'age' | 'consent' | 'nickname';

export function missingConsents(consents: ConsentRecord[]): ConsentDocument[] {
  return consentDocuments.filter(document => !consents.some(item => item.document === document && item.version === consentVersions[document] && !item.withdrawn_at));
}

/** What the member still has to do before using community features. */
export function onboardingNeeds(account: Pick<Account, 'profile' | 'consents'>): OnboardingNeed[] {
  const needs: OnboardingNeed[] = [];
  if (!account.profile.age_confirmed_at) needs.push('age');
  if (missingConsents(account.consents).length) needs.push('consent');
  if (!account.profile.nickname) needs.push('nickname');
  return needs;
}

export function normalizeNickname(value: string) { return value.normalize('NFC').trim().replace(/\s+/g, ' '); }

/** 2–20 letters, digits, spaces, hyphen or underscore, in any script. */
export function isValidNickname(value: string) {
  return /^[\p{L}\p{M}\p{N}_ -]{2,20}$/u.test(normalizeNickname(value)) && /[\p{L}\p{N}]/u.test(value);
}

export function isValidEmail(value: string) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()); }
export function isValidCode(value: string) { return /^\d{6,8}$/.test(value.trim()); }

const rank: AppRole[] = ['admin', 'moderator', 'supporter', 'user'];
export function primaryRole(roles: AppRole[]): AppRole { return rank.find(role => roles.includes(role)) ?? 'user'; }

export type AccountErrorKind = 'email' | 'code' | 'nickname' | 'nicknameTaken' | 'rateLimit' | 'generic';

/** Maps Supabase/Postgres errors to a translated message key without exposing raw server text. */
export function accountErrorKind(error: unknown): AccountErrorKind {
  const value = error as { status?: number; code?: string; message?: string } | null;
  if (!value) return 'generic';
  if (value.status === 429 || value.code === 'over_email_send_rate_limit' || value.code === 'over_request_rate_limit') return 'rateLimit';
  if (value.code === 'otp_expired' || value.code === 'invalid_otp') return 'code';
  if (value.code === '23505') return 'nicknameTaken';
  if (value.code === '23514') return 'nickname';
  return 'generic';
}
