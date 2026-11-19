import { useCallback, useEffect, useState } from 'react';
import App from '../App';
import { TabBar } from './TabBar';
import { CommunityTab } from './CommunityTab';
import { AuthProvider } from '../platform/AuthContext';
import { ProcedureGuide } from '../procedure/ProcedureGuide';
import { readActiveTab, tabsCopyFor, writeActiveTab, type AppTab } from './tabsCopy';
import { useDocumentLanguage, useKeyboardOpen } from './useShellEnvironment';
import './tabs.css';

/** App frame: the existing application flow plus the scheduler and community tabs. */
export function AppTabs() {
  const [tab, setTab] = useState<AppTab>(() => readActiveTab());
  const language = useDocumentLanguage();
  const keyboardOpen = useKeyboardOpen();
  const copy = tabsCopyFor(language);
  const returnToApplication = useCallback(() => {
    setTab('application');
    requestAnimationFrame(() => {
      const target = document.getElementById('main') ?? document.querySelector<HTMLElement>('.tab-bar-item[aria-current="page"]');
      target?.focus({ preventScroll: true });
    });
  }, []);
  useEffect(() => { writeActiveTab(tab); }, [tab]);
  useEffect(() => { if (tab !== 'application') window.scrollTo(0, 0); }, [tab]);
  return <AuthProvider><div className={`tab-root${keyboardOpen ? ' keyboard-open' : ''}`}>
    <div className="tab-panel" hidden={tab !== 'application'}><App /></div>
    {tab === 'scheduler' && <div className="tab-panel"><ProcedureGuide language={language} onBack={returnToApplication} /></div>}
    {tab === 'community' && <div className="tab-panel"><CommunityTab copy={copy} language={language} /></div>}
    <TabBar active={tab} copy={copy} onSelect={setTab} />
  </div></AuthProvider>;
}
