import { localizedLabel } from '../form/localize';
import { AnswerChoices } from './AnswerChoices';
import { Button } from '../ui/ScreenControls';
import { designCopy } from './designCopy';
import { inputCopy } from './inputGuidance';
import { visibleField, type FieldValue, type FieldValues } from './structuredAnswer';
import type { Question } from './model';

export function StructuredInput({question,values,language,uiLanguage,busy,onChange}:{question:Question;values:FieldValues;language:string;uiLanguage:string;busy:boolean;onChange:(values:FieldValues)=>void}){
 const c=designCopy(uiLanguage),guide=inputCopy(language),label=(ko:string,en:string)=>localizedLabel(uiLanguage,ko,en);
 const update=(id:string,value:FieldValue)=>onChange({...values,[id]:value});
 return <div className="structured-input">{question.fields.filter(f=>visibleField(f,values)).map(field=>{
  const value=values[field.id],id=`field-${field.id}`;
  if(field.type==='table'){
   const rows=Array.isArray(value)?value as Record<string,string>[]:[{}];
   return <section className="table-entries" key={id} aria-label={label(field.ko,field.en)}>
    {question.fields.length>1&&<h3>{label(field.ko,field.en)}</h3>}
    {rows.map((row,index)=><fieldset className="table-entry" key={index} disabled={busy}>
     <legend>{c.item} {index+1}</legend>
     <div className="table-entry-tools"><span aria-hidden="true">{String(index+1).padStart(2,'0')}</span><button type="button" className="remove-entry" aria-label={`${c.item} ${index+1} ${c.remove}`} onClick={()=>update(field.id,rows.filter((_,i)=>i!==index))}>{c.remove}</button></div>
     {field.columns?.map(col=><label className="structured-label" key={col.id} htmlFor={`${id}-${index}-${col.id}`}><span>{label(col.ko,col.en)}</span><input id={`${id}-${index}-${col.id}`} dir="auto" lang={language} value={row[col.id]??''} maxLength={1000} placeholder={col.kind==='date'?(/yyyy\/mm\)/i.test(col.en)?'YYYY / MM':'YYYY / MM / DD'):''} onChange={e=>update(field.id,rows.map((r,i)=>i===index?{...r,[col.id]:e.target.value}:r))}/></label>)}
    </fieldset>)}
    <Button className="add-entry" disabled={busy} onClick={()=>update(field.id,[...rows,{}])}><span aria-hidden="true">＋</span>{c.add}</Button>
   </section>;
  }
  if(field.options){
   if(field.type==='multi')return <fieldset className="structured-multi" key={id} disabled={busy}><legend>{label(field.ko,field.en)}</legend>{field.options.map(o=><label className="answer-option" key={o.value}><input type="checkbox" checked={Array.isArray(value)&&value.includes(o.value as never)} onChange={e=>update(field.id,e.target.checked?[...(Array.isArray(value)?value as string[]:[]),o.value]:(value as string[]).filter(v=>v!==o.value))}/>{label(o.ko,o.en)}</label>)}</fieldset>;
   return <div className="structured-choice" key={id}>{field.id!==question.fields[0].id&&<p>{label(field.ko,field.en)}</p>}<AnswerChoices id={id} label={label(field.ko,field.en)} value={typeof value==='string'?value:''} options={field.options.map(o=>({value:o.value,label:label(o.ko,o.en)}))} disabled={busy} onChange={v=>update(field.id,v)} clearLabel={inputCopy(uiLanguage).clear} chooseLabel={c.select}/></div>;
  }
  const text=typeof value==='string'?value:'';
  return <div key={id} className="structured-text">
   <label className="structured-field-title" htmlFor={id}>{label(field.ko,field.en)}</label>
   {field.type==='long'?<div className="answer-input"><textarea id={id} dir="auto" lang={language} rows={6} maxLength={12000} value={text} disabled={busy} placeholder={guide.write} onChange={e=>update(field.id,e.target.value)}/><span className="answer-count" dir="ltr">{text.length.toLocaleString()} / 12,000</span></div>:<input id={id} dir="auto" lang={language} value={text} disabled={busy} maxLength={1000} placeholder={field.type==='date'?guide.date:''} onChange={e=>update(field.id,e.target.value)}/>}
  </div>;
 })}</div>;
}
