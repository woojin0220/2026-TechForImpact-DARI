import { useState } from 'react';
import { localizedLabel } from '../form/localize';
import { intakeLanguages } from '../intakeCopy';
import { BackButton,Button,ScreenHeader } from '../ui/ScreenControls';
import { SelectMenu } from '../ui/SelectMenu';
import { questionGroups,type Answers,type Question } from './model';
import { guidanceGroups,requiresGuidance } from './questionGuidance';
import { previewCopy } from './previewCopy';
import type { FieldValue } from './structuredAnswer';
import { visibleField } from './structuredAnswer';

export function FormPreview({answers,language,selected,onBack,onEdit}:{answers:Answers;language:string;selected?:string|null;onBack:()=>void;onEdit:(id:string)=>void}){
 const [locale,setLocale]=useState(language),[original,setOriginal]=useState(false),[answeredOnly,setAnsweredOnly]=useState(false),[groupId,setGroupId]=useState(selected?.split('.')[0]??'');
 const c=previewCopy(locale),label=(ko:string,en:string)=>localizedLabel(locale,ko,en),pdf=`${import.meta.env.BASE_URL}forms/refugee-application-2024.pdf`;
 const fieldAnswer=(q:Question,fieldId:string,value:FieldValue)=>{
  const field=q.fields.find(f=>f.id===fieldId)!;
  if(field.type==='table'&&Array.isArray(value))return <div className="preview-table-wrap"><table><thead><tr>{field.columns?.map(col=><th key={col.id} scope="col">{label(col.ko,col.en)}</th>)}</tr></thead><tbody>{(value as Record<string,string>[]).filter(row=>Object.values(row).some(cell=>cell.trim())).map((row,i)=><tr key={i}>{field.columns?.map(col=><td key={col.id} dir="auto">{row[col.id]||'—'}</td>)}</tr>)}</tbody></table></div>;
  const text=(Array.isArray(value)?value:[value]) as string[];
  return <p className="preview-answer" dir="auto">{text.map(item=>{const option=field.options?.find(o=>o.value===item);return option?label(option.ko,option.en):item;}).join(', ')||c.empty}</p>;
 };
 return <div className="application-page form-preview" dir={['ar','fa'].includes(locale)?'rtl':'ltr'}>
  <ScreenHeader title={c.title} leading={<BackButton label={c.back} onClick={onBack}/>}/>
  <div className="preview-tabs" role="group" aria-label={c.title}><Button aria-pressed={!original} onClick={()=>setOriginal(false)}>{c.paper}</Button><Button aria-pressed={original} onClick={()=>setOriginal(true)}>{c.original}</Button></div>
  {original?<section className="preview-original"><p>{c.originalNote}</p><a href={pdf} target="_blank" rel="noopener noreferrer">{c.source} ↗</a><iframe src={pdf} title={c.revision}/><p className="application-note">{c.revision}</p></section>:<>
   <p className="preview-note">{c.note}</p>
   <div className="preview-controls"><SelectMenu label={c.language} value={locale} options={intakeLanguages.map(l=>({value:l.code,label:l.name}))} onChange={setLocale}/><SelectMenu label={c.all} value={groupId} options={[{value:'',label:c.all},...questionGroups.map(g=>({value:g.id,label:label(g.ko,g.en)}))]} onChange={setGroupId}/></div>
   <label className="preview-filter"><input type="checkbox" checked={answeredOnly} onChange={e=>setAnsweredOnly(e.target.checked)}/>{c.draft}</label>
   <main className="preview-paper">{questionGroups.filter(g=>!groupId||g.id===groupId).map(group=>{
    const items=group.questions.filter(q=>!answeredOnly||answers[q.id]?.source.trim());if(!items.length)return null;
    return <section className="preview-section" key={group.id}><h2>{label(group.ko,group.en)}</h2>{items.map(q=>{
     const a=answers[q.id],structured=!!a?.fieldValues,guide=guidanceGroups(q,locale);
     return <article className="preview-question" key={q.id}><header><h3><span dir="ltr">{q.id}</span>{label(q.fields[0].ko,q.fields[0].en)}</h3><button type="button" onClick={()=>onEdit(q.id)}>{c.edit} ↗</button></header>
      {[...new Set(q.notes.map(note=>label(note.ko,note.en)))].map(note=><p className="preview-instruction" key={note}>{note}</p>)}
      {requiresGuidance(q)&&<div className="preview-instructions">{guide.response.map(text=><p key={text}>{text}</p>)}<ul>{guide.content.map(text=><li key={text}>{text}</li>)}</ul></div>}
      {q.fields.map((field,index)=><div className="preview-field" key={field.id}>
       {index>0&&<p className="preview-field-label">{label(field.ko,field.en)}</p>}
       {structured&&visibleField(field,a.fieldValues!)&&a.fieldValues?.[field.id]!==undefined?fieldAnswer(q,field.id,a.fieldValues[field.id]):(!structured&&q.fields.length===1&&index===0&&a?.source.trim())?<p className="preview-answer" dir="auto" lang={a.language}>{a.source}</p>:<>
        {field.options&&<p className="preview-options">{field.options.map(option=><span key={option.value}>□ {label(option.ko,option.en)}</span>)}</p>}
        {field.columns&&<div className="preview-table-wrap"><table><thead><tr>{field.columns.map(col=><th key={col.id} scope="col">{label(col.ko,col.en)}</th>)}</tr></thead><tbody><tr>{field.columns.map(col=><td key={col.id}>—</td>)}</tr></tbody></table></div>}
        <p className="preview-empty">{c.empty}</p>
       </>}
      </div>)}
      {!structured&&q.fields.length>1&&a?.source.trim()&&<div><p className="preview-field-label">{c.answer}</p><p className="preview-answer" dir="auto" lang={a.language}>{a.source}</p></div>}
     </article>;
    })}</section>;
   })}</main>
  </>}
 </div>;
}
