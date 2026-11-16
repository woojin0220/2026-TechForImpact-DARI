import type { SupabaseClient } from '@supabase/supabase-js';
import { consentDocuments, consentVersions, normalizeNickname, supportedProfileLanguages, type Account, type AppRole, type BadgeType, type ConsentRecord, type MemberBadge, type Profile } from './account';

/** Thin data layer over Supabase. Every call relies on row-level security on the server. */
export function platformApi(client: SupabaseClient) {
  async function check<T>(promise: PromiseLike<{ data: T; error: unknown }>): Promise<T> {
    const { data, error } = await promise;
    if (error) throw error;
    return data;
  }
  return {
    sendEmailCode: (email: string) => check(client.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: true } })),
    verifyEmailCode: (email: string, token: string) => check(client.auth.verifyOtp({ email: email.trim(), token: token.trim(), type: 'email' })),
    signOut: () => check(client.auth.signOut().then(result => ({ data: null, error: result.error }))),

    async loadAccount(userId: string, email: string): Promise<Account> {
      const [profile, roles, consents, badges] = await Promise.all([
        check(client.from('profiles').select('user_id,nickname,preferred_language,age_confirmed_at,status').eq('user_id', userId).single()),
        check(client.from('user_roles').select('role').eq('user_id', userId)),
        check(client.from('consents').select('document,version,withdrawn_at').eq('user_id', userId)),
        check(client.from('member_badges').select('badge,visible,verified_at').eq('user_id', userId)),
      ]);
      return { email, profile: profile as Profile, roles: (roles as { role: AppRole }[]).map(item => item.role), consents: consents as ConsentRecord[], badges: badges as MemberBadge[] };
    },

    /** Records age confirmation, the current consent versions and the nickname in one go. */
    async completeOnboarding(userId: string, input: { nickname: string; language: string; missing: string[] }) {
      if (input.missing.length) {
        await check(client.from('consents').insert(consentDocuments.filter(document => input.missing.includes(document))
          .map(document => ({ user_id: userId, document, version: consentVersions[document] }))));
      }
      await check(client.from('profiles').update({
        nickname: normalizeNickname(input.nickname), age_confirmed_at: new Date().toISOString(),
        preferred_language: supportedProfileLanguages.includes(input.language) ? input.language : 'ko',
      }).eq('user_id', userId));
    },

    updateNickname: (userId: string, nickname: string) => check(client.from('profiles').update({ nickname: normalizeNickname(nickname) }).eq('user_id', userId)),
    updateLanguage: (userId: string, language: string) => check(client.from('profiles').update({ preferred_language: language }).eq('user_id', userId)),

    /** Member: a six-digit code to show a support organization in person, valid for 10 minutes. */
    async requestBadgeCode(badge: BadgeType) {
      const rows = await check(client.rpc('create_badge_request', { requested: badge })) as { code: string; expires_at: string }[];
      return rows[0];
    },
    /** Support organization staff: grants the badge for a member's code and returns their nickname. */
    grantBadge: (code: string) => check(client.rpc('grant_badge_by_code', { entered: code.trim() })) as Promise<string | null>,
    setBadgeVisibility: (badge: BadgeType, show: boolean) => check(client.rpc('set_badge_visibility', { target_badge: badge, show })),
    removeBadge: (userId: string, badge: BadgeType) => check(client.rpc('revoke_badge', { target: userId, target_badge: badge, reason: 'self' })),

    async deleteAccount() {
      await check(client.functions.invoke('delete-account', { method: 'POST' }));
      await client.auth.signOut({ scope: 'local' });
    },
  };
}
export type PlatformApi = ReturnType<typeof platformApi>;
