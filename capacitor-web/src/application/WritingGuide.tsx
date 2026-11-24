import { localizedLabel } from '../form/localize';
import { inputCopy } from './inputGuidance';
import { guidanceGroups } from './questionGuidance';
import { guidanceStageCopy } from './guidanceStageCopy';
import type { Question } from './model';

const topics={
 ko:['사건 경위','피해 내용','시점','행위자','그렇게 생각한 이유','장소','풀려난 경위'],
 en:['What happened','Type of harm','When','Who','Why you believe so','Where','How or why released'],
 fr:['Les faits','Le préjudice','Quand','Qui','Pourquoi vous le pensez','Où','La libération'],
 ru:['Событие','Причинённый вред','Когда','Кто','Почему вы так считаете','Где','Освобождение'],
 ar:['ما حدث','نوع الأذى','متى','من','سبب اعتقادك','أين','الإفراج'],
 fa:['اتفاق','نوع آسیب','زمان','عامل','دلیل برداشت شما','مکان','آزادی'],
};
const details={ko:'상세 항목 보기',en:'View detailed prompts',fr:'Voir les points détaillés',ru:'Подробные пункты',ar:'عرض البنود التفصيلية',fa:'نمایش موارد کامل'};
export function WritingGuide({question,fieldId,language}:{question:Question;fieldId?:string;language:string}){
 const field=question.fields.find(f=>f.id===fieldId),c=inputCopy(language),s=guidanceStageCopy(language),list=guidanceGroups(question,language).content;
 return <aside className="writing-reminder" aria-label={c.hint}>
  {question.id==='14.2'?<>
   <p className="writing-reminder-title">{s.contents}</p>
   <ul className="writing-topics">{(topics[language as keyof typeof topics]??topics.en).map(topic=><li key={topic}>{topic}</li>)}</ul>
   <details><summary>{details[language as keyof typeof details]??details.en}</summary><ol>{list.map(item=><li key={item}>{item}</li>)}</ol></details>
  </>:<p>{field&&field.id!==question.fields[0].id?localizedLabel(language,field.ko,field.en):c.write}</p>}
  <p className="writing-uncertainty">{c.uncertain}</p>
 </aside>;
}
