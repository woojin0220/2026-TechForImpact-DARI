import { useEffect, useRef, useState, type ReactNode } from 'react';
import { procedureCopyFor } from './copy';
import './procedure.css';
import { BackButton, ScreenHeader } from '../ui/ScreenControls';
import { tabsCopyFor } from '../shell/tabsCopy';

type Props = { language: string; onBack: () => void; headerAccessory?: ReactNode };

/** Same-origin bundled guide. The frame never receives the applicant's writing session. */
export function ProcedureGuide({ language, onBack, headerAccessory }: Props) {
  const copy = procedureCopyFor(language);
  const frame = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState<number>();
  const [loadFailed, setLoadFailed] = useState(false);
  const locale = ['ko', 'en', 'fr', 'ru', 'ar', 'fa'].includes(language) ? language : 'en';
  const src = `${import.meta.env.BASE_URL}procedure-guide.html?embedded=1&lang=${locale}`;
  const standaloneSrc = `${import.meta.env.BASE_URL}procedure-guide.html?lang=${locale}`;
  const direction = locale === 'ar' || locale === 'fa' ? 'rtl' : 'ltr';

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.source !== frame.current?.contentWindow || event.origin !== window.location.origin) return;
      const data: unknown = event.data;
      if (!data || typeof data !== 'object') return;
      const message = data as { type?: unknown; height?: unknown };
      if (message.type === 'dari-procedure:resize' && typeof message.height === 'number' && Number.isFinite(message.height)) {
        setHeight(Math.max(400, Math.min(30000, Math.ceil(message.height))));
      } else if (message.type === 'dari-procedure:open-application') {
        onBack();
      }
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [onBack]);

  function checkLoadedDocument() {
    try {
      // A local development server may return its index page for a missing asset.
      setLoadFailed(frame.current?.contentDocument?.documentElement.dataset.procedureReady !== 'true');
    } catch {
      setLoadFailed(true);
    }
  }

  return <main className="procedure-view" aria-label={copy.title} lang={language} dir={direction}>
    <ScreenHeader className="procedure-toolbar" title={tabsCopyFor(language).schedulerTitle} actions={headerAccessory} />
    <div className="procedure-back-row"><BackButton label={copy.back} onClick={onBack} /></div>
    {loadFailed && <div className="procedure-load-error" role="alert">
      <p>{copy.loadError}</p>
      <a href={standaloneSrc} target="_blank" rel="noopener noreferrer">{copy.openSeparately}</a>
    </div>}
    <iframe ref={frame} className="procedure-frame" src={src} title={copy.title}
      dir={direction} lang={locale} style={height ? { height } : undefined}
      hidden={loadFailed} onLoad={checkLoadedDocument} onError={() => setLoadFailed(true)} />
  </main>;
}
