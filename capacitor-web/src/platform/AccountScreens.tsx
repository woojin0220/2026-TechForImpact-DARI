import { useState, type FormEvent, type ReactNode } from 'react';
import { accountErrorKind, isValidCode, isValidEmail, isValidNickname, missingConsents, onboardingNeeds, primaryRole, type Account, type AccountErrorKind, type AppRole } from './account';
import type { AccountCopy } from './accountCopy';
import type { PlatformApi } from './api';
import { useAuth } from './AuthContext';

const errorKeys: Record<AccountErrorKind, keyof AccountCopy> = {
  email: 'errorEmail', code: 'errorCode', nickname: 'errorNickname', nicknameTaken: 'errorNicknameTaken', rateLimit: 'errorRateLimit', generic: 'errorGeneric',
};
const roleKeys: Record<AppRole, keyof AccountCopy> = { user: 'roleUser', supporter: 'roleSupporter', moderator: 'roleModerator', admin: 'roleAdmin' };

function fill(text: string, values: Record<string, string>) { return text.replace(/\{(\w+)\}/g, (_, key) => values[key] ?? ''); }

/** Runs one request at a time and turns failures into a translated message. */
function useRequest(copy: AccountCopy) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  async function run(task: () => Promise<unknown>) {
    setPending(true); setError('');
    try { await task(); return true; } catch (problem) { setError(copy[errorKeys[accountErrorKind(problem)]]); return false; } finally { setPending(false); }
  }
  return { pending, error, setError, run };
}

function ErrorLine({ text }: { text: string }) { return text ? <p className="account-error" role="alert">{text}</p> : null; }

export function SignInScreen({ copy, api }: { copy: AccountCopy; api: PlatformApi }) {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sentTo, setSentTo] = useState('');
  const request = useRequest(copy);
  async function sendCode(event?: FormEvent) {
    event?.preventDefault();
    if (!isValidEmail(email)) { request.setError(copy.errorEmail); return; }
    if (await request.run(() => api.sendEmailCode(email))) { setSentTo(email.trim()); setCode(''); }
  }
  async function verify(event: FormEvent) {
    event.preventDefault();
    if (!isValidCode(code)) { request.setError(copy.errorCode); return; }
    await request.run(() => api.verifyEmailCode(sentTo, code));
  }
  return <section className="account-screen">
    <h1>{copy.signInTitle}</h1>
    <p className="account-intro">{copy.signInIntro}</p>
    {!sentTo ? <form onSubmit={sendCode}>
      <label>{copy.email}<input type="email" inputMode="email" autoComplete="email" dir="ltr" value={email} onChange={event => setEmail(event.target.value)} required /></label>
      <ErrorLine text={request.error} />
      <button className="primary full" disabled={request.pending}>{request.pending ? copy.working : copy.sendCode}</button>
    </form> : <form onSubmit={verify}>
      <p className="account-intro">{fill(copy.codeSent, { email: sentTo })}</p>
      <label>{copy.code}<input inputMode="numeric" autoComplete="one-time-code" dir="ltr" maxLength={8} value={code} onChange={event => setCode(event.target.value.replace(/\D/g, ''))} required /></label>
      <ErrorLine text={request.error} />
      <button className="primary full" disabled={request.pending}>{request.pending ? copy.working : copy.verify}</button>
      <div className="account-links">
        <button type="button" className="quiet" disabled={request.pending} onClick={() => void sendCode()}>{copy.resend}</button>
        <button type="button" className="quiet" disabled={request.pending} onClick={() => { setSentTo(''); request.setError(''); }}>{copy.changeEmail}</button>
      </div>
    </form>}
  </section>;
}

export function OnboardingScreen({ copy, account, api, language, onDone }: { copy: AccountCopy; account: Account; api: PlatformApi; language: string; onDone: () => void }) {
  const missing = missingConsents(account.consents);
  const [age, setAge] = useState(!!account.profile.age_confirmed_at);
  const [agreed, setAgreed] = useState<string[]>([]);
  const [nickname, setNickname] = useState(account.profile.nickname ?? '');
  const request = useRequest(copy);
  const consentText: Record<string, string> = { terms: copy.agreeTerms, privacy: copy.agreePrivacy, community: copy.agreeCommunity };
  const ready = age && missing.every(item => agreed.includes(item)) && isValidNickname(nickname);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!isValidNickname(nickname)) { request.setError(copy.errorNickname); return; }
    if (await request.run(() => api.completeOnboarding(account.profile.user_id, { nickname, language, missing }))) onDone();
  }
  return <section className="account-screen">
    <h1>{copy.onboardingTitle}</h1>
    <p className="account-intro">{copy.onboardingIntro}</p>
    <form onSubmit={submit}>
      {!account.profile.age_confirmed_at && <label className="check-row"><input type="checkbox" checked={age} onChange={event => setAge(event.target.checked)} /><span>{copy.ageConfirm}</span></label>}
      {missing.map(document => <label key={document} className="check-row"><input type="checkbox" checked={agreed.includes(document)}
        onChange={event => setAgreed(current => event.target.checked ? [...current, document] : current.filter(item => item !== document))} /><span>{consentText[document]}</span></label>)}
      <label className="account-field">{copy.nickname}<input autoComplete="nickname" maxLength={20} dir="auto" value={nickname} onChange={event => setNickname(event.target.value)} /><small>{copy.nicknameHint}</small></label>
      <ErrorLine text={request.error} />
      <button className="primary full" disabled={!ready || request.pending}>{request.pending ? copy.working : copy.finish}</button>
    </form>
  </section>;
}

export function AccountScreen({ copy, account, api, onBack, onChanged }: { copy: AccountCopy; account: Account; api: PlatformApi; onBack: () => void; onChanged: () => void }) {
  const [nickname, setNickname] = useState(account.profile.nickname ?? '');
  const [saved, setSaved] = useState(false);
  const request = useRequest(copy);
  async function save(event: FormEvent) {
    event.preventDefault(); setSaved(false);
    if (!isValidNickname(nickname)) { request.setError(copy.errorNickname); return; }
    if (await request.run(() => api.updateNickname(account.profile.user_id, nickname))) { setSaved(true); onChanged(); }
  }
  async function remove() {
    if (!window.confirm(copy.deleteConfirm)) return;
    await request.run(() => api.deleteAccount());
  }
  return <section className="account-screen">
    <button type="button" className="quiet" onClick={onBack}>{copy.back}</button>
    <h1>{copy.accountTitle}</h1>
    <p className="account-intro">{fill(copy.signedInAs, { email: account.email })}</p>
    <dl className="account-facts"><div><dt>{copy.role}</dt><dd>{copy[roleKeys[primaryRole(account.roles)]]}</dd></div></dl>
    <form onSubmit={save}>
      <label className="account-field">{copy.nickname}<input maxLength={20} dir="auto" value={nickname} onChange={event => { setNickname(event.target.value); setSaved(false); }} /><small>{copy.nicknameHint}</small></label>
      <ErrorLine text={request.error} />
      {saved && <p className="account-saved" role="status">{copy.saved}</p>}
      <button className="secondary" disabled={request.pending || nickname === account.profile.nickname}>{copy.save}</button>
    </form>
    <div className="account-actions">
      <button type="button" className="secondary" disabled={request.pending} onClick={() => void request.run(() => api.signOut())}>{copy.signOut}</button>
      <button type="button" className="quiet account-danger" disabled={request.pending} onClick={() => void remove()}>{copy.deleteAccount}</button>
    </div>
  </section>;
}

/**
 * Shows sign-in, onboarding or a status screen until the member may use the feature,
 * then renders `children` with the ready account.
 */
export function AuthGate({ copy, language, children }: { copy: AccountCopy; language: string; children: (account: Account) => ReactNode }) {
  const { state, api, refresh } = useAuth();
  if (state.status === 'unconfigured' || !api) return <section className="account-screen"><p className="account-intro">{copy.notConfigured}</p></section>;
  if (state.status === 'loading') return <section className="account-screen" aria-busy="true"><p className="account-intro">{copy.working}</p></section>;
  if (state.status === 'signedOut') return <SignInScreen copy={copy} api={api} />;
  if (state.status === 'error') return <section className="account-screen"><p className="account-intro">{copy.loadFailed}</p>
    <div className="account-actions"><button type="button" className="secondary" onClick={() => void refresh()}>{copy.retry}</button><button type="button" className="quiet" onClick={() => void api.signOut()}>{copy.signOut}</button></div></section>;
  const { account } = state;
  if (account.profile.status === 'suspended') return <section className="account-screen"><p className="account-intro">{copy.suspended}</p>
    <div className="account-actions"><button type="button" className="secondary" onClick={() => void api.signOut()}>{copy.signOut}</button></div></section>;
  if (onboardingNeeds(account).length) return <OnboardingScreen copy={copy} account={account} api={api} language={language} onDone={() => void refresh()} />;
  return <>{children(account)}</>;
}
