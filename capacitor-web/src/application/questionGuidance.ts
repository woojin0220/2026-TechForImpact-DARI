import type { Question } from './model.ts';
import { localizedLabel } from '../form/localize.ts';
import { questionGuide } from './inputGuidance.ts';

export function guidanceItems(question:Question,language:string):string[]{
 const label=(ko:string,en:string)=>localizedLabel(language,ko,en);
 const notes=question.notes.map(note=>label(note.ko,note.en));
 const instructions=question.fields.slice(1).filter(f=>f.type==='long').map(f=>label(f.ko,f.en));
 const guide=questionGuide(question,language).split('\n').map(s=>s.replace(/^•\s*/,''));
 return [...new Set([...notes,...instructions,...guide])].filter(Boolean);
}
/** Reconfirm if displayed requirements or locale change. This is an acknowledgement, not a legal consent record. */
export function guidanceKey(question:Question,language:string):string{
 const text=JSON.stringify([language,question.id,question.fields,question.notes,guidanceItems(question,language)]);
 let hash=2166136261;for(let i=0;i<text.length;i++){hash^=text.charCodeAt(i);hash=Math.imul(hash,16777619);}return `guide-1-${(hash>>>0).toString(16)}`;
}
