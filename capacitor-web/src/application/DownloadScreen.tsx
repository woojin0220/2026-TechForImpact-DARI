import {useLayoutEffect,type ReactNode} from 'react';
import {Button,BackButton,ScreenHeader} from '../ui/ScreenControls';
import {localizedLabel} from '../form/localize';
import {questions,writtenAnswers,type Answers} from './model';
import {pendingReviews} from './prepareDownload';
import {applicationDownloadCopy} from './downloadCopy';
import {downloadCopy,applicationCopy} from './copy';
import type {ApplicationFileFormat} from './download';

export function DownloadScreen({answers,language,format,onFormat,onFix,onDownload,onBack,busy,error,headerAccessory,active=true}:{answers:Answers;language:string;format:ApplicationFileFormat;onFormat:(f:ApplicationFileFormat)=>void;onFix:(id:string)=>void;onDownload:()=>void;onBack:()=>void;busy:boolean;error:string;headerAccessory?:ReactNode;active?:boolean}){
 useLayoutEffect(()=>{if(!active)return;window.scrollTo(0,0);const frame=requestAnimationFrame(()=>window.scrollTo(0,0));return()=>cancelAnimationFrame(frame);},[active]);
 const c=applicationDownloadCopy(language),pending=pendingReviews(answers),count=writtenAnswers(answers).length,ready=count>0&&!pending.length;
 return <div className="application-page application-download" dir={['ar','fa'].includes(language)?'rtl':'ltr'}>
  <ScreenHeader className="application-header" title={c[0]} leading={<BackButton label={applicationCopy(language).back} disabled={busy} onClick={onBack}/>} actions={headerAccessory}/>
  <main className="download-main">
   <section className={`download-status${ready?' is-ready':''}`} aria-live="polite"><h2>{pending.length?c[1].replace('{n}',String(pending.length)):count?c[3]:c[16]}</h2><p>{pending.length?c[2]:count?c[4].replace('{n}',String(count)):c[17]}</p></section>
   {pending.length>0&&<ol className="download-pending-list">{pending.map(item=>{const q=questions.find(q=>q.id===item.id)!;return <li key={item.id}><button type="button" disabled={busy} onClick={()=>onFix(item.id)}><span className="download-question-id" dir="ltr">{item.id}</span><span className="download-question-title">{localizedLabel(language,q.fields[0].ko,q.fields[0].en)}</span><small>{c[item.reason==='translation'?7:8]}</small><strong>{c[item.reason==='translation'?5:6]} <span aria-hidden="true">→</span></strong></button></li>;})}</ol>}
   <section className="download-formats"><h2>{c[9]}</h2><div role="group" aria-label={c[9]}>{(['pdf','hwp'] as const).map((value,i)=><button type="button" key={value} aria-pressed={format===value} disabled={busy} onClick={()=>onFormat(value)}><strong>{value.toUpperCase()}</strong><span>{c[10+i]}</span><i aria-hidden="true">{format===value?'✓':''}</i></button>)}</div></section>
   <aside className="download-handwriting" role="note"><span className="download-pen" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m4 16 11-11 4 4L8 20H4v-4ZM13 7l4 4M13 20h7"/></svg></span><div><h2>{c[12]}</h2><p>{c[13]}</p></div></aside>
   {error&&<p className="application-warning" role="alert">{error}</p>}
   <Button className="download-file-button" variant="primary" disabled={!ready||busy} onClick={onDownload}>{busy?downloadCopy(language).progress:c[14].replace('{format}',format.toUpperCase())}<span aria-hidden="true">↓</span></Button>
  </main>
 </div>;
}
