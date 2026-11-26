import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { procedureCopyFor } from './copy';
import './procedure.css';
import { ScreenHeader } from '../ui/ScreenControls';
import { tabsCopyFor } from '../shell/tabsCopy';
import {CommunityWelcome,needsCommunityWelcome} from '../community/CommunityWelcome';
import {schedulerWelcomeCopy,schedulerGuideLabel} from './welcomeCopy';
import '../community/community.css';

type Props = { language: string; ownerScope?: string; onBack: () => void; headerAccessory?: ReactNode };

/** Same-origin bundled guide. The frame never receives the applicant's writing session. */
export function ProcedureGuide({ language, ownerScope='guest', onBack, headerAccessory }: Props) {
  const copy = procedureCopyFor(language);
  const [welcome,setWelcome]=useState(()=>needsCommunityWelcome(ownerScope,'scheduler'));
  const frame = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState<number>();
  const [loadFailed, setLoadFailed] = useState(false);
  const [overlay, setOverlay] = useState<{left: number; width: number} | null>(null);
  const [notice, setNotice] = useState<{lines: string[]; active: boolean}>({lines:[],active:false});
  const locale = ['ko', 'en', 'fr', 'ru', 'ar', 'fa'].includes(language) ? language : 'en';
  const src = `${import.meta.env.BASE_URL}procedure-guide.html?embedded=1&lang=${locale}&ownerScope=${encodeURIComponent(ownerScope)}`;
  const standaloneSrc = `${import.meta.env.BASE_URL}procedure-guide.html?lang=${locale}&ownerScope=${encodeURIComponent(ownerScope)}`;
  const direction = locale === 'ar' || locale === 'fa' ? 'rtl' : 'ltr';
  useEffect(()=>setWelcome(needsCommunityWelcome(ownerScope,'scheduler')),[ownerScope]);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.source !== frame.current?.contentWindow || event.origin !== window.location.origin) return;
      const data: unknown = event.data;
      if (!data || typeof data !== 'object') return;
      const message = data as { type?: unknown; height?: unknown; active?: unknown; lines?: unknown };
      if (message.type === 'dari-procedure:resize' && typeof message.height === 'number' && Number.isFinite(message.height)) {
        setHeight(Math.max(400, Math.min(30000, Math.ceil(message.height))));
      } else if (message.type === 'dari-procedure:open-application') {
        setOverlay(null);
        onBack();
      } else if (message.type === 'dari-procedure:fullscreen' && typeof message.active === 'boolean') {
        const bounds = frame.current?.parentElement?.getBoundingClientRect();
        setOverlay(message.active && bounds ? {left: bounds.left, width: bounds.width} : null);
      } else if(message.type === 'dari-procedure:notice' && typeof message.active === 'boolean' && Array.isArray(message.lines) && message.lines.length===3 && message.lines.every(line=>typeof line==='string' && line.length<=240)) {
        setNotice({lines:message.lines as string[],active:message.active});
      }
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [onBack]);

  useLayoutEffect(() => {
    if(overlay)frame.current?.contentWindow?.postMessage({type:'dari-procedure:fullscreen-ready'},window.location.origin);
  }, [overlay]);

  useEffect(() => {
    if (!overlay) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const resize = () => {
      const bounds = frame.current?.parentElement?.getBoundingClientRect();
      if (bounds) setOverlay({left: bounds.left, width: bounds.width});
    };
    window.addEventListener('resize', resize);
    return () => { document.body.style.overflow = previous; window.removeEventListener('resize', resize); };
  }, [Boolean(overlay)]);

  function checkLoadedDocument() {
    try {
      // A local development server may return its index page for a missing asset.
      setLoadFailed(frame.current?.contentDocument?.documentElement.dataset.procedureReady !== 'true');
    } catch {
      setLoadFailed(true);
    }
  }

  if(welcome)return <main className="procedure-view procedure-welcome" lang={language} dir={direction}><CommunityWelcome owner={ownerScope} section="scheduler" language={language} title={tabsCopyFor(language).schedulerTitle} messages={schedulerWelcomeCopy(language)} onDone={()=>setWelcome(false)}/></main>;
  return <main className="procedure-view" aria-label={copy.title} lang={language} dir={direction}>
    <ScreenHeader variant="tab" className="procedure-toolbar" title={tabsCopyFor(language).schedulerTitle} actions={<div className="procedure-header-actions"><button type="button" className="community-tour-entry scheduler-tour-entry" aria-label={schedulerGuideLabel(language)} onClick={()=>frame.current?.contentWindow?.postMessage({type:'dari-procedure:start-tour'},window.location.origin)}>?</button>{headerAccessory}</div>} />
    {loadFailed && <div className="procedure-load-error" role="alert">
      <p>{copy.loadError}</p>
      <a href={standaloneSrc} target="_blank" rel="noopener noreferrer">{copy.openSeparately}</a>
    </div>}
    <iframe key={ownerScope} ref={frame} className="procedure-frame" src={src} title={copy.title}
      dir={direction} lang={locale} style={overlay ? {position:'fixed',top:0,left:overlay.left,width:overlay.width,height:'100dvh',minHeight:0,zIndex:1000} : height ? { height } : undefined}
      hidden={loadFailed} onLoad={checkLoadedDocument} onError={() => setLoadFailed(true)} />
    {!overlay && notice.active && !loadFailed && <ol className="procedure-risk-footer">{notice.lines.map(line=><li key={line}>{line}</li>)}</ol>}
  </main>;
}
