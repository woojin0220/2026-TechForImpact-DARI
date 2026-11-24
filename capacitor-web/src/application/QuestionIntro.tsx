import { useEffect, useState } from 'react';
import { intakeLanguages } from '../intakeCopy';
import { localizedLabel } from '../form/localize';
import { Button } from '../ui/ScreenControls';
import { SelectMenu } from '../ui/SelectMenu';
import { designCopy } from './designCopy';
import { focusCopy } from './focusCopy';
import { guidanceItems, guidanceKey } from './questionGuidance';
import type { Question, TranslationLanguage } from './model';

export function QuestionIntro({question,language,sourceLanguage,targetLanguage,acknowledged,section=false,settings=false,onFinish,onBack}:{question:Question;language:string;sourceLanguage:string;targetLanguage:TranslationLanguage;acknowledged:boolean;section?:boolean;settings?:boolean;onFinish:(source:string,target:TranslationLanguage,key:string)=>void;onBack:()=>void}){
 const c=focusCopy(language),d=designCopy(language),items=guidanceItems(question,language),key=guidanceKey(question,language),pages=Math.ceil(items.length/3);
 const [page,setPage]=useState(settings&&acknowledged?pages:0),[checked,setChecked]=useState<string[]>(acknowledged?items:[]),[source,setSource]=useState(sourceLanguage),[target,setTarget]=useState(targetLanguage);
 useEffect(()=>{window.scrollTo(0,0);},[page]);
 const title=section||question.fields[0].type==='table'?localizedLabel(language,question.sectionKo,question.sectionEn):`${question.id}. ${localizedLabel(language,question.fields[0].ko,question.fields[0].en)}`;
 const visible=items.slice(page*3,page*3+3),ready=visible.every(item=>checked.includes(item));
 return <section className="question-intro" aria-labelledby="intro-question-title">
  <p className="intro-caption">{c.intro}<span dir="ltr">{Math.min(page+1,pages+1)} / {pages+1}</span></p>
  <div className="intro-progress" aria-hidden="true">{Array.from({length:pages+1},(_,i)=><span className={i<=page?'passed':''} key={i}/>)}</div>
  {page<pages?<>
   <h2 id="intro-question-title">{title}</h2>
   <p className="intro-section-label">{c.required}</p>
   <div className="guidance-checks">{visible.map((item,i)=><label className={`guidance-check${checked.includes(item)?' checked':''}`} key={item}><span className="guidance-index" dir="ltr">{String(page*3+i+1).padStart(2,'0')}</span><span className="guidance-check-content"><span>{item}</span><span className="guidance-confirm"><input type="checkbox" checked={checked.includes(item)} onChange={e=>setChecked(previous=>e.target.checked?[...previous,item]:previous.filter(s=>s!==item))}/>{c.read}</span></span></label>)}</div>
  </>:<>
   <h2 id="intro-question-title">{c.languages}</h2>
   <p className="intro-question-reference">{title}</p>
   <div className="intro-languages"><div><span>{c.source}</span><SelectMenu label={c.source} value={source} onChange={setSource} options={intakeLanguages.map(l=>({value:l.code,label:l.name}))}/></div><div><span>{c.target}</span><SelectMenu label={c.target} value={target} onChange={v=>setTarget(v as TranslationLanguage)} options={[{value:'ko',label:d.ko},{value:'en',label:d.en}]}/></div></div>
  </>}
  <div className="intro-actions"><Button onClick={()=>page?setPage(page-1):onBack()}>{c.previous}</Button><Button variant="primary" disabled={page<pages?!ready:checked.length!==items.length} onClick={()=>page<pages?setPage(page+1):onFinish(source,target,key)}>{page<pages?c.next:c.start}<span aria-hidden="true">→</span></Button></div>
 </section>;
}
