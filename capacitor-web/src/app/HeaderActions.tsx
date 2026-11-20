import { useEffect, useRef, type ReactNode } from 'react';
import type { AppTexts } from './texts';

type Props = {
  texts: AppTexts;
  languageName: string;
  overviewOpen: boolean;
  onOverview: () => void;
  onLanguage: () => void;
  onHelp: () => void;
  showOperator: boolean;
  operatorOpen: boolean;
  onOperator: () => void;
  onCloseOperator: () => void;
  operatorPanel: ReactNode;
  accessory?: ReactNode;
};

/** Keep frequent actions visible; language, help and developer tools share a quiet settings menu. */
export function HeaderActions({ texts: { copy, ui, overview }, languageName, overviewOpen, onOverview, onLanguage, onHelp,
  showOperator, operatorOpen, onOperator, onCloseOperator, operatorPanel, accessory }: Props) {
  const menu = useRef<HTMLDetailsElement>(null);
  const tools = useRef<HTMLDivElement>(null);
  const close = () => { if (menu.current) menu.current.open = false; };
  const act = (action: () => void) => { close(); action(); };
  useEffect(() => {
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !tools.current?.contains(event.target)) { close(); onCloseOperator(); }
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && (menu.current?.open || operatorOpen)) {
        event.preventDefault(); close(); onCloseOperator(); menu.current?.querySelector('summary')?.focus();
      }
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); };
  }, [operatorOpen, onCloseOperator]);
  return <div className="header-actions">
    <button className="overview-trigger" aria-label={overview.open} title={overview.open} aria-haspopup="dialog" aria-expanded={overviewOpen} onClick={() => act(onOverview)}>
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M7 3h7l4 4v14H7z" /><path d="M14 3v4h4M10 12h5M10 16h5" /></svg>
      <span>{overview.open}</span>
    </button>
    <div className="header-settings" ref={tools}>
      <details className="settings-menu" ref={menu} onToggle={event => { if (event.currentTarget.open) onCloseOperator(); }}>
        <summary aria-label={ui.settings} title={ui.settings}>
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m9.5 3-.6 2.1-1.7 1L5 5.6 2.5 10l1.6 1.6v1L2.5 14 5 18.4l2.2-.5 1.7 1 .6 2.1h5l.6-2.1 1.7-1 2.2.5 2.5-4.4-1.6-1.4v-1L21.5 10 19 5.6l-2.2.5-1.7-1-.6-2.1z" /><circle cx="12" cy="12" r="3" /></svg>
        </summary>
        <div className="settings-popover" role="group" aria-label={ui.settings}>
          <button className="settings-action language-action" aria-label={ui.languagePicker} onClick={() => act(onLanguage)}>
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c5 5 5 13 0 18M12 3c-5 5-5 13 0 18"/></svg><span>{languageName}</span><span className="settings-chevron" aria-hidden="true">›</span>
          </button>
          <button className="settings-action help-action" onClick={() => act(onHelp)}>
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 4.3 1.7C12.6 11.6 12 12 12 14M12 17h.01"/></svg><span>{copy.help}</span>
          </button>
          {showOperator && <button className="settings-action developer-action" onClick={() => act(onOperator)}>
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m8 7-5 5 5 5M16 7l5 5-5 5M14 4l-4 16"/></svg><span>{ui.operator}</span>
          </button>}
        </div>
      </details>
      {operatorPanel && <div className="operator-entry">{operatorPanel}</div>}
    </div>
    {accessory}
  </div>;
}
