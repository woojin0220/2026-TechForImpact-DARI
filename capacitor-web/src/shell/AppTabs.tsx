import { useEffect, useState } from 'react';
import App from '../App';
import { ComingSoon, TabBar } from './TabBar';
import { readActiveTab, tabsCopyFor, writeActiveTab, type AppTab } from './tabsCopy';
import { useDocumentLanguage, useKeyboardOpen } from './useShellEnvironment';
import './tabs.css';

/** App frame: the existing application flow plus the scheduler and community tabs. */
export function AppTabs() {
  const [tab, setTab] = useState<AppTab>(() => readActiveTab());
  const language = useDocumentLanguage();
  const keyboardOpen = useKeyboardOpen();
  const copy = tabsCopyFor(language);
  useEffect(() => { writeActiveTab(tab); }, [tab]);
  useEffect(() => { if (tab !== 'application') window.scrollTo(0, 0); }, [tab]);
  return <div className={`tab-root${keyboardOpen ? ' keyboard-open' : ''}`}>
    <div className="tab-panel" hidden={tab !== 'application'}><App /></div>
    {tab === 'scheduler' && <div className="tab-panel"><ComingSoon title={copy.schedulerTitle} copy={copy} onBack={() => setTab('application')} /></div>}
    {tab === 'community' && <div className="tab-panel"><ComingSoon title={copy.communityTitle} copy={copy} onBack={() => setTab('application')} /></div>}
    <TabBar active={tab} copy={copy} onSelect={setTab} />
  </div>;
}
