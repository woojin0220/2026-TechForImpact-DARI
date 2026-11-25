import type { Question } from './model.ts';
import { localizedLabel } from '../form/localize.ts';
import { inputCopy } from './inputGuidance.ts';
import { guidanceStageCopy,persecutionPrompts } from './guidanceStageCopy.ts';

export function guidanceItems(question:Question,language:string):string[]{
 return guidanceGroups(question,language).content;
}
export function guidanceGroups(question:Question,language:string):{response:string[];content:string[];support:string[]}{
 const label=(ko:string,en:string)=>localizedLabel(language,ko,en);
 const notes=question.notes.map(note=>label(note.ko,note.en));
 const choices=question.fields[0].options?.map(option=>label(option.ko,option.en)).join(' / ');
 const support=question.fields.some(f=>f.type==='long')?[inputCopy(language).uncertain]:[];
 if(question.id==='14.2')return {response:[choices??'',guidanceStageCopy(language).ifYes].filter(Boolean),content:persecutionPrompts(language),support};
 const fields=question.fields.flatMap((field,index)=>field.columns?field.columns.map(column=>label(column.ko,column.en)):index===0?[]:[label(field.ko,field.en)]);
 const content=[...new Set([...notes,...fields])].filter(Boolean);
 if(!content.length)content.push(question.fields[0].type==='date'?inputCopy(language).date:label(question.fields[0].ko,question.fields[0].en));
 return {response:choices?[choices]:[],content,support};
}
/** Reconfirm if displayed requirements or locale change. This is an acknowledgement, not a legal consent record. */
export function guidanceKey(question:Question,language:string):string{
 const text=JSON.stringify([language,question.id,question.fields,question.notes,guidanceGroups(question,language)]);
 let hash=2166136261;for(let i=0;i<text.length;i++){hash^=text.charCodeAt(i);hash=Math.imul(hash,16777619);}return `guide-2-${(hash>>>0).toString(16)}`;
}
