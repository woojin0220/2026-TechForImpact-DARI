import type { ReactNode } from 'react';
import { appTabs, type AppTab, type TabsCopy } from './tabsCopy';

const icons: Record<AppTab, ReactNode> = {
  application: <><path d="M7 3h7l4 4v14H7z" /><path d="M14 3v4h4M10 12h5M10 16h5" /></>,
  scheduler: <><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M8 3v4M16 3v4M4 10h16" /></>,
  community: <><path d="M4 6h11v8H9l-3 3v-3H4z" /><path d="M15 10h5v7h-2v3l-3-3h-4v-3" /></>,
};

/** Bottom navigation. The application tab stays mounted, so switching never interrupts its work. */
export function TabBar({ active, copy, onSelect }: { active: AppTab; copy: TabsCopy; onSelect: (tab: AppTab) => void }) {
  return <nav className="tab-bar" aria-label={copy.navigation}>
    {appTabs.map(tab => <button key={tab} type="button" className="tab-bar-item" aria-current={active === tab ? 'page' : undefined} onClick={() => onSelect(tab)}>
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">{icons[tab]}</svg>
      <span>{copy[tab]}</span>
    </button>)}
  </nav>;
}

export function ComingSoon({ title, copy, onBack }: { title: string; copy: TabsCopy; onBack: () => void }) {
  return <main className="tab-placeholder" tabIndex={-1}>
    <h1>{title}</h1>
    <p>{copy.comingSoon}</p>
    <button type="button" className="secondary" onClick={onBack}>{copy.backToApplication}</button>
  </main>;
}
