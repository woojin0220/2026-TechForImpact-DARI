import { useState, type FormEvent, type ReactNode } from 'react';
import { accountErrorKind, canVerifyBadges, isValidBadgeCode, isValidCode, isValidEmail, isValidNickname, missingConsents, onboardingNeeds, primaryRole, type Account, type AccountErrorKind, type AppRole, type BadgeType } from './account';
import type { AccountCopy } from './accountCopy';
import type { PlatformApi } from './api';
import { useAuth } from './AuthContext';

const errorKeys: Record<AccountErrorKind, keyof AccountCopy> = {
  email: 'errorEmail', code: 'errorCode', nickname: 'errorNickname', nicknameTaken: 'errorNicknameTaken', rateLimit: 'errorRateLimit', badgeCode: 'errorBadgeCode', badgeSelf: 'errorBadgeSelf', generic: 'errorGeneric',
};
const badgeKeys: Record<BadgeType, keyof AccountCopy> = { recognized_refugee: 'badgeRecognizedRefugee' };
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

export function SignInScreen({ copy, api, title, intro }: { copy: AccountCopy; api: PlatformApi; title?: string; intro?: string }) {
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
    <h1>{title ?? copy.signInTitle}</h1>
    <p className="account-intro">{intro ?? copy.signInIntro}</p>
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

/** A verified badge chip, for profiles and (later) community posts. */
export function MemberBadge({ badge, copy }: { badge: BadgeType; copy: AccountCopy }) {
  return <span className="member-badge"><svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M8 1.5 13.5 4v4c0 3.2-2.3 5.6-5.5 6.5C4.8 13.6 2.5 11.2 2.5 8V4z" /><path d="m5.5 8 1.8 1.8L10.8 6.3" /></svg>{copy[badgeKeys[badge]]}</span>;
}

function expiryTime(iso: string, language: string) {
  try { return new Intl.DateTimeFormat(language, { hour: '2-digit', minute: '2-digit' }).format(new Date(iso)); } catch { return new Date(iso).toLocaleTimeString(); }
}

function BadgeSection({ copy, account, api, language, onChanged }: { copy: AccountCopy; account: Account; api: PlatformApi; language: string; onChanged: () => void }) {
  const badge: BadgeType = 'recognized_refugee';
  const held = account.badges.find(item => item.badge === badge);
  const [issued, setIssued] = useState<{ code: string; expires_at: string } | null>(null);
  const [shown, setShown] = useState(held?.visible ?? false);
  const request = useRequest(copy);
  async function getCode() { await request.run(async () => setIssued(await api.requestBadgeCode(badge))); }
  async function toggle(show: boolean) {
    setShown(show);
    if (await request.run(() => api.setBadgeVisibility(badge, show))) onChanged(); else setShown(!show);
  }
  async function remove() {
    if (!window.confirm(copy.badgeRemoveConfirm)) return;
    if (await request.run(() => api.removeBadge(account.profile.user_id, badge))) onChanged();
  }
  return <section className="account-section" aria-labelledby="badges-title">
    <h2 id="badges-title">{copy.badgesTitle}</h2>
    {held ? <>
      <MemberBadge badge={badge} copy={copy} />
      <label className="check-row"><input type="checkbox" checked={shown} disabled={request.pending} onChange={event => void toggle(event.target.checked)} /><span>{copy.badgeVisible}<small>{copy.badgeVisibleNote}</small></span></label>
      <ErrorLine text={request.error} />
      <div className="account-links"><button type="button" className="quiet account-danger" disabled={request.pending} onClick={() => void remove()}>{copy.badgeRemove}</button></div>
    </> : <>
      <p className="account-intro">{copy.badgeAbout}</p>
      {issued && <div className="badge-code" role="status"><strong dir="ltr">{issued.code}</strong><p>{fill(copy.badgeCodeShow, { time: expiryTime(issued.expires_at, language) })}</p></div>}
      <ErrorLine text={request.error} />
      <div className="account-links"><button type="button" className="secondary" disabled={request.pending} onClick={() => void getCode()}>{issued ? copy.badgeNewCode : copy.badgeRequest}</button></div>
    </>}
  </section>;
}

function VerifySection({ copy, api }: { copy: AccountCopy; api: PlatformApi }) {
  const [code, setCode] = useState('');
  const [done, setDone] = useState('');
  const request = useRequest(copy);
  async function submit(event: FormEvent) {
    event.preventDefault(); setDone('');
    if (!isValidBadgeCode(code)) { request.setError(copy.errorBadgeCode); return; }
    let nickname: string | null = null;
    if (await request.run(async () => { nickname = await api.grantBadge(code); })) { setDone(fill(copy.verifyDone, { nickname: nickname ?? '' })); setCode(''); }
  }
  return <section className="account-section" aria-labelledby="verify-title">
    <h2 id="verify-title">{copy.verifyTitle}</h2>
    <p className="account-intro">{copy.verifyIntro}</p>
    <form onSubmit={submit}>
      <label className="account-field">{copy.verifyCode}<input inputMode="numeric" autoComplete="off" dir="ltr" maxLength={6} value={code} onChange={event => { setCode(event.target.value.replace(/\D/g, '')); setDone(''); }} /></label>
      <ErrorLine text={request.error} />
      {done && <p className="account-saved" role="status">{done}</p>}
      <button className="secondary" disabled={request.pending || code.length !== 6}>{copy.verifySubmit}</button>
    </form>
  </section>;
}

export function AccountScreen({ copy, account, api, language = 'ko', onBack, onChanged }: { copy: AccountCopy; account: Account; api: PlatformApi; language?: string; onBack: () => void; onChanged: () => void }) {
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
    <h1>{copy.profile}</h1>
    <div className="profile-card">
      <span className="profile-avatar" aria-hidden="true">{Array.from((account.profile.nickname ?? '').trim())[0]?.toUpperCase()}</span>
      <div className="profile-summary">
        <strong dir="auto">{account.profile.nickname}</strong>
        <span>{fill(copy.signedInAs, { email: account.email })}</span>
        <span className="profile-role">{copy.role} · {copy[roleKeys[primaryRole(account.roles)]]}</span>
        {account.badges.some(badge => badge.visible) && <span className="profile-badges">{account.badges.filter(badge => badge.visible).map(badge => <MemberBadge key={badge.badge} badge={badge.badge} copy={copy} />)}</span>}
      </div>
    </div>
    <form onSubmit={save}>
      <label className="account-field">{copy.nickname}<input maxLength={20} dir="auto" value={nickname} onChange={event => { setNickname(event.target.value); setSaved(false); }} /><small>{copy.nicknameHint}</small></label>
      <ErrorLine text={request.error} />
      {saved && <p className="account-saved" role="status">{copy.saved}</p>}
      <button className="secondary" disabled={request.pending || nickname === account.profile.nickname}>{copy.save}</button>
    </form>
    <BadgeSection copy={copy} account={account} api={api} language={language} onChanged={onChanged} />
    {canVerifyBadges(account.roles) && <VerifySection copy={copy} api={api} />}
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
export function AuthGate({ copy, language, children, frontTitle, frontIntro }: { copy: AccountCopy; language: string; children: (account: Account) => ReactNode; frontTitle?: string; frontIntro?: string }) {
  const { state, api, refresh } = useAuth();
  if (state.status === 'unconfigured' || !api) return <section className="account-screen"><p className="account-intro">{copy.notConfigured}</p></section>;
  if (state.status === 'loading') return <section className="account-screen" aria-busy="true"><p className="account-intro">{copy.working}</p></section>;
  if (state.status === 'signedOut') return <SignInScreen copy={copy} api={api} title={frontTitle} intro={frontIntro} />;
  if (state.status === 'error') return <section className="account-screen"><p className="account-intro">{copy.loadFailed}</p>
    <div className="account-actions"><button type="button" className="secondary" onClick={() => void refresh()}>{copy.retry}</button><button type="button" className="quiet" onClick={() => void api.signOut()}>{copy.signOut}</button></div></section>;
  const { account } = state;
  if (account.profile.status === 'suspended') return <section className="account-screen"><p className="account-intro">{copy.suspended}</p>
    <div className="account-actions"><button type="button" className="secondary" onClick={() => void api.signOut()}>{copy.signOut}</button></div></section>;
  if (onboardingNeeds(account).length) return <OnboardingScreen copy={copy} account={account} api={api} language={language} onDone={() => void refresh()} />;
  return <>{children(account)}</>;
}
