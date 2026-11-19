import { useEffect, useState } from 'react';
import App from '../App';
import { ComingSoon, TabBar } from './TabBar';
import { CommunityTab } from './CommunityTab';
import { AuthProvider, useAuth } from '../platform/AuthContext';
import { accountCopyFor } from '../platform/accountCopy';
import { needsSignIn, ProfilePanel, SignInFront, UserButton } from './AccountShell';
import { readActiveTab, tabsCopyFor, writeActiveTab, type AppTab } from './tabsCopy';
import { useDocumentLanguage, useKeyboardOpen } from './useShellEnvironment';
import './tabs.css';
import '../platform/account.css';

/** App frame: the existing application flow plus the scheduler and community tabs. */
export function AppTabs() {
  return <AuthProvider><Shell /></AuthProvider>;
}

function Shell() {
  const [tab, setTab] = useState<AppTab>(() => readActiveTab());
  const [profileOpen, setProfileOpen] = useState(false);
  const language = useDocumentLanguage();
  const keyboardOpen = useKeyboardOpen();
  const copy = tabsCopyFor(language);
  const accountCopy = accountCopyFor(language);
  const { state } = useAuth();
  const signingIn = needsSignIn(state);
  useEffect(() => { writeActiveTab(tab); }, [tab]);
  useEffect(() => { if (tab !== 'application') window.scrollTo(0, 0); }, [tab]);
  // Signing out from the profile returns to the sign-in screen.
  useEffect(() => { if (state.status === 'signedOut') setProfileOpen(false); }, [state.status]);
  const openProfile = () => { setProfileOpen(true); window.scrollTo(0, 0); };
  const userButton = <UserButton copy={accountCopy} onOpen={openProfile} />;
  const gate = signingIn ? <SignInFront copy={accountCopy} language={language} /> : undefined;
  const showApp = tab === 'application' || signingIn;
  return <div className={`tab-root${keyboardOpen ? ' keyboard-open' : ''}${signingIn ? ' signing-in' : ''}`}>
    <div className="tab-panel" hidden={!showApp || profileOpen}><App gate={gate} headerAccessory={userButton} /></div>
    {!signingIn && profileOpen && <div className="tab-panel"><ProfilePanel copy={accountCopy} language={language} onClose={() => setProfileOpen(false)} /></div>}
    {!signingIn && !profileOpen && tab === 'scheduler' && <div className="tab-panel"><ComingSoon title={copy.schedulerTitle} copy={copy} accessory={userButton} onBack={() => setTab('application')} /></div>}
    {!signingIn && !profileOpen && tab === 'community' && <div className="tab-panel"><CommunityTab copy={copy} language={language} onOpenProfile={openProfile} /></div>}
    {!signingIn && <TabBar active={tab} copy={copy} onSelect={next => { setProfileOpen(false); setTab(next); }} />}
  </div>;
}
