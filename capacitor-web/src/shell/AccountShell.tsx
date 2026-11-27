import { feedbackBuild } from '../platform/feedbackBuild';
import { FeedbackEntry } from '../platform/FeedbackEntry';
import { AccountScreen, AuthGate } from '../platform/AccountScreens';
import { useAuth, type AuthState } from '../platform/AuthContext';
import { onboardingNeeds } from '../platform/account';
import type { AccountCopy } from '../platform/accountCopy';
import { devSupervisorCopyFor } from '../platform/devSupervisorCopy';

/** True until the member is signed in with a finished, active profile. Every tab needs an account. */
export function needsSignIn(state: AuthState) {
  if (state.status === 'unconfigured') return false;
  if (state.status === 'development') return false;
  if (state.status !== 'signedIn') return true;
  return state.account.profile.status === 'suspended' || onboardingNeeds(state.account).length > 0;
}

/** Shown right after the language choice until the member has signed in and finished setting up. */
export function SignInFront({ copy, language }: { copy: AccountCopy; language: string }) {
  if (feedbackBuild) return <FeedbackEntry language={language} />;
  return <main className="account-main sign-in-front" tabIndex={-1}>
    <p className="front-brand" lang="en" dir="ltr">DARI</p>
    <AuthGate copy={copy} language={language} frontTitle={copy.frontTitle} frontIntro={copy.frontIntro}>{() => null}</AuthGate>
  </main>;
}

/** Round button shown at the end of every tab header: the member's initial, or a person icon when signed out. */
export function UserButton({ copy, onOpen }: { copy: AccountCopy; onOpen: () => void }) {
  const { state } = useAuth();
  if (state.status === 'unconfigured') return null;
  const nickname = state.status === 'signedIn' || state.status === 'development' ? state.account.profile.nickname : null;
  const initial = nickname ? Array.from(nickname.trim())[0]?.toUpperCase() : '';
  return <button type="button" className={`user-button${initial ? ' signed-in' : ''}`} aria-label={state.status === 'signedIn' || state.status === 'development' ? copy.profile : copy.signInTitle} onClick={onOpen}>
    {initial ? <span aria-hidden="true">{initial}</span> : <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="8.5" r="3.5" /><path d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5" /></svg>}
  </button>;
}

/** Profile page over the current tab: profile, badges, sign out and account deletion. Signed-out members get the sign-in form. */
export function ProfilePanel({ copy, language, onClose }: { copy: AccountCopy; language: string; onClose: () => void }) {
  const { api, refresh, state } = useAuth();
  return <main className="account-main profile-panel" tabIndex={-1}>
    {state.status === 'development' && <p className="dev-supervisor-profile" role="status">{devSupervisorCopyFor(language).profile.replace('{id}', state.account.profile.user_id)}</p>}
    <AuthGate copy={copy} language={language}>{account => api && <AccountScreen copy={copy} account={account} api={api} language={language} onBack={onClose} onChanged={() => void refresh()} />}</AuthGate>
  </main>;
}
