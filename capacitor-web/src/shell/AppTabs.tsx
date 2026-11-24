import { useCallback, useEffect, useMemo, useState } from 'react';
import App from '../application/Application';
import { sessionDraftRepository } from '../application/repository';
import { TabBar } from './TabBar';
import { ProcedureGuide } from '../procedure/ProcedureGuide';
import { CommunityTab } from './CommunityTab';
import { AuthProvider, useAuth } from '../platform/AuthContext';
import { accountCopyFor } from '../platform/accountCopy';
import { needsSignIn, ProfilePanel, SignInFront, UserButton } from './AccountShell';
import { readActiveTab, tabsCopyFor, writeActiveTab, type AppTab } from './tabsCopy';
import { useDocumentLanguage, useKeyboardOpen } from './useShellEnvironment';
import { canUseDevGuest, devGuestCopyFor, readDevGuest, writeDevGuest } from './devGuest';
import { devSupervisorCopyFor } from '../platform/devSupervisorCopy';
import './tabs.css';
import '../platform/account.css';

/** App frame: the existing application flow plus the scheduler and community tabs. */
export function AppTabs() {
  return <AuthProvider><Shell /></AuthProvider>;
}

function Shell() {
  const [tab, setTab] = useState<AppTab>(() => readActiveTab());
  const [profileOpen, setProfileOpen] = useState(false);
  const [testRequested, setTestRequested] = useState(() => readDevGuest(import.meta.env.DEV));
  const language = useDocumentLanguage();
  const keyboardOpen = useKeyboardOpen();
  const copy = tabsCopyFor(language);
  const accountCopy = accountCopyFor(language);
  const { state, exitSupervisor } = useAuth();
  const supervisor = state.status === 'development';
  const supervisorCopy = devSupervisorCopyFor(language);
  const userId=state.status==='signedIn'?state.session.user.id:state.status==='development'?state.account.profile.user_id:null;
  const draftRepository=useMemo(()=>sessionDraftRepository({userId}),[userId]);
  const canTest = canUseDevGuest(import.meta.env.DEV, state.status);
  const testing = canTest && testRequested;
  const testCopy = devGuestCopyFor(language);
  const signingIn = needsSignIn(state) && !testing;
  const leaveTest = () => { writeDevGuest(false); setTestRequested(false); setProfileOpen(false); };
  const enterTest = () => {
    if (!canTest) return;
    writeDevGuest(true);
    setTestRequested(true);
    setProfileOpen(false);
    setTab('application');
  };
  const returnToApplication = useCallback(() => {
    setProfileOpen(false);
    setTab('application');
    requestAnimationFrame(() => {
      const target = document.getElementById('main') ?? document.querySelector<HTMLElement>('.tab-bar-item[aria-current="page"]');
      target?.focus({ preventScroll: true });
    });
  }, []);
  useEffect(() => { writeActiveTab(tab); }, [tab]);
  useEffect(() => { if (tab !== 'application') window.scrollTo(0, 0); }, [tab]);
  // Signing out from the profile returns to the sign-in screen.
  useEffect(() => { if (state.status === 'signedOut') setProfileOpen(false); }, [state.status]);
  useEffect(() => {
    if (state.status === 'signedIn' || state.status === 'development') { writeDevGuest(false); setTestRequested(false); }
    if (state.status === 'development') { setTab('community'); setProfileOpen(false); }
  }, [state.status]);
  const openProfile = () => { if (testing) leaveTest(); else setProfileOpen(true); window.scrollTo(0, 0); };
  const userButton = <UserButton copy={accountCopy} onOpen={openProfile} />;
  const gate = signingIn ? <SignInFront copy={accountCopy} language={language} onTest={canTest ? enterTest : undefined} /> : undefined;
  const showApp = tab === 'application' || signingIn;
  return <div className={`tab-root${keyboardOpen ? ' keyboard-open' : ''}${signingIn ? ' signing-in' : ''}`}>
    {(testing || supervisor) && <div className="dev-guest-banner" dir={['ar', 'fa'].includes(language) ? 'rtl' : 'ltr'} role="status">
      <span>{supervisor ? supervisorCopy.active : testCopy.active}</span><button type="button" onClick={supervisor ? exitSupervisor : leaveTest}>{supervisor ? supervisorCopy.exit : testCopy.exit}</button>
    </div>}
    <div className="tab-panel" hidden={!showApp || profileOpen}><App key={draftRepository.scope} repository={draftRepository} gate={gate} headerAccessory={userButton} /></div>
    {!signingIn && profileOpen && <div className="tab-panel"><ProfilePanel copy={accountCopy} language={language} onClose={() => setProfileOpen(false)} /></div>}
    {!signingIn && !profileOpen && tab === 'scheduler' && <div className="tab-panel"><ProcedureGuide language={language} onBack={returnToApplication} headerAccessory={userButton} /></div>}
    {!signingIn && !profileOpen && tab === 'community' && <div className="tab-panel"><CommunityTab copy={copy} language={language} onOpenProfile={openProfile} /></div>}
    {!signingIn && <TabBar active={tab} copy={copy} onSelect={next => { setProfileOpen(false); setTab(next); }} />}
  </div>;
}
