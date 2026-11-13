import type { ReactNode } from 'react';
import { intakeLanguages } from '../intakeCopy';
import type { AppTexts } from './texts';

type Props = {
  texts: AppTexts;
  status: ReactNode;
  /** A request is running, so the applicant can go back without choosing again. */
  onBack?: () => void;
  onQuickTest?: () => void;
  locked: boolean;
  onSelect: (code: string) => void;
};

/** First screen: the language picker. */
export function LanguageEntry({ texts: { copy, ui }, status, onBack, onQuickTest, locked, onSelect }: Props) {
  return <div className="language-entry"><div className="language-entry-content">
    <h1 className="entry-logo" lang="en" dir="ltr">DARI</h1>{status}{onBack && <button className="quiet" onClick={onBack}>{copy.back}</button>}
    {onQuickTest && <button className="secondary" disabled={locked} onClick={onQuickTest}>{ui.quickEnglishTest}</button>}
    <nav className="language-scroll" aria-label={ui.languagePicker}>{intakeLanguages.map(item => <button className="language-option" lang={item.code} dir="auto" key={item.code} disabled={locked} onClick={() => onSelect(item.code)}>{item.name}</button>)}</nav>
  </div></div>;
}
