import { useEffect, useMemo, useRef, useState } from 'react';
import type { IntakeSession } from '../intake/types';
import { buildApplicationPlan, templateVersion } from './plan';
import { createApplicationPdf } from './pdf';
import { createApplicationHwp } from './hwp';

export default function ApplicationExport({session, reviewed, language}: {session: IntakeSession; reviewed: boolean; language: string}) {
  const ko = language === 'ko';
  const [url,setUrl] = useState('');
  const [hwpUrl,setHwpUrl] = useState('');
  const [busy,setBusy] = useState<'pdf'|'hwp'|null>(null);
  const [error,setError] = useState('');
  const generation=useRef(0);
  const plan = useMemo(()=>buildApplicationPlan(session,reviewed),[session,reviewed]);
  const unresolved = plan.entries.filter(entry=>entry.state!=='answered' && entry.state!=='not_applicable');
  useEffect(()=>()=>{if(url) URL.revokeObjectURL(url);},[url]);
  useEffect(()=>()=>{if(hwpUrl) URL.revokeObjectURL(hwpUrl);},[hwpUrl]);
  // An existing PDF is a snapshot. Never offer it as the latest after any edit.
  useEffect(()=>{generation.current++;setUrl('');setHwpUrl('');setError('');setBusy(null);return()=>{generation.current++;};},[plan]);
  async function generate() {
    const request=++generation.current;
    setBusy('pdf');setError('');
    try {
      const bytes = await createApplicationPdf(plan);
      if(request!==generation.current)return;
      setUrl(URL.createObjectURL(new Blob([new Uint8Array(bytes)],{type:'application/pdf'})));
    } catch(failure) {if(request===generation.current)setError(failure instanceof Error ? failure.message : String(failure));}
    finally {if(request===generation.current)setBusy(null);}
  }
  async function generateHwp() {
    const request=++generation.current;
    setBusy('hwp');setError('');
    try {
      const bytes=await createApplicationHwp(plan);
      if(request!==generation.current)return;
      setHwpUrl(URL.createObjectURL(new Blob([new Uint8Array(bytes)],{type:'application/x-hwp'})));
    } catch(failure) {if(request===generation.current)setError(failure instanceof Error ? failure.message : String(failure));}
    finally {if(request===generation.current)setBusy(null);}
  }
  return <section className="application-export">
    <p>{ko ? '원본 신청서 양식에 현재 답변을 채워 편집 가능한 HWP 또는 PDF로 저장합니다. 칸을 넘는 답변과 표는 문항 번호가 표시된 별지에 담습니다. 서버로 전송하지 않고 이 기기에서 생성합니다.' : 'Fill the original application form and save an editable HWP or PDF. Overflow answers and tables go on numbered additional sheets. Files are generated on this device without uploading your answers.'}</p>
    <aside className="export-notice" role="note">
      <p>{ko ? `제공된 양식: ${templateVersion} 개정본. 실제 제출 전 최신 서식인지 확인하세요.` : `Provided form: revision ${templateVersion}. Check that the form is current before filing.`}</p>
      <p>{ko ? '사용자 검토용 출력입니다. 서명, 자필 서약, 동의란, 신청일과 공무원 작성란은 비워둡니다. 자동 제출되지 않습니다.' : 'This is a review copy. Signatures, handwritten declarations, consent, application date and officer-only areas remain blank. Nothing is submitted automatically.'}</p>
      {!reviewed && <p>{ko ? '앱의 최종 내용 확인이 아직 완료되지 않았습니다.' : 'You have not completed the final content check in the app.'}</p>}
      {plan.test && <p>{ko ? '짧은 테스트 결과입니다. 실제 제출에 사용하지 마세요.' : 'Short test only. Do not use this output for submission.'}</p>}
      {plan.warnings.filter(warning=>warning.startsWith('원문 정보') || warning.startsWith('초안에서')).map(warning=><p key={warning}>{ko ? warning : 'The draft or source information has outstanding issues. Review the original answers and draft before using this document.'}</p>)}
    </aside>
    <p>{ko ? `미작성 또는 확인 필요: ${unresolved.length}개` : `Missing or needs review: ${unresolved.length} items`}</p>
    <details><summary>{ko ? '출력할 전체 답변 검토' : 'Review all answers for export'}</summary>
      <dl className="export-answers" dir="ltr">{plan.entries.map(entry=><div key={entry.field.id}>
        <dt>{entry.field.id} {ko ? entry.field.ko : entry.field.en}</dt>
        <dd lang="ko" style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{entry.text || (ko ? '[미작성 — 빈칸으로 유지]' : '[Missing — left blank]')}</dd>
        {entry.state==='review' && <dd>{ko ? '확인 필요: 표에 빈 항목이 있습니다.' : 'Needs review: some table cells are empty.'}</dd>}
      </div>)}</dl>
    </details>
    {error && <p role="alert">{error}</p>}
    <div className="actions"><button className="primary" disabled={!!busy} onClick={()=>void generateHwp()}>{busy==='hwp' ? (ko ? 'HWP 생성 중…' : 'Creating HWP…') : (ko ? 'HWP 만들기' : 'Create filled HWP')}</button>
      {hwpUrl && <a className="export-link" href={hwpUrl} download={`DARI-${session.scope==='test'?'TEST-':''}application-review.hwp`}>{ko ? 'HWP 다운로드' : 'Download HWP'}</a>}
      <button className="secondary" disabled={!!busy} onClick={()=>void generate()}>{busy==='pdf' ? (ko ? 'PDF 생성 중…' : 'Creating PDF…') : (ko ? 'PDF 만들기' : 'Create filled PDF')}</button>
      {url && <><a className="export-link" href={url} target="_blank" rel="noopener noreferrer">{ko ? 'PDF 전체 미리보기' : 'Open PDF preview'}</a><a className="export-link" href={url} download={`DARI-${session.scope==='test'?'TEST-':''}application-review.pdf`}>{ko ? 'PDF 다운로드' : 'Download PDF'}</a></>}
    </div>
    {hwpUrl && <p>{ko ? '다운로드한 HWP는 한글 앱에서 열어 편집할 수 있습니다. 브라우저 안의 미리보기는 PDF로 확인하세요. 편집 후에는 페이지 나눔과 빈칸, 별지를 다시 확인해 주세요.' : 'Open the downloaded HWP in a compatible Hancom app to edit it. Use PDF for a browser preview. Recheck page breaks, blank fields and additional sheets after editing.'}</p>}
    {url && <object className="export-pdf-preview" data={url} type="application/pdf" aria-label={ko ? '신청서 PDF 미리보기' : 'Application PDF preview'}><p>{ko ? '이 브라우저에서는 위의 미리보기 또는 다운로드를 눌러 확인하세요.' : 'Use Open PDF preview or Download PDF above to view the document.'}</p></object>}
  </section>;
}
