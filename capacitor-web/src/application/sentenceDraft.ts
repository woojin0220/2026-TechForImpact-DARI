import { sentences } from './sentences.ts';
export type SentencePart={id:string;text:string;after:string};
export type SentenceDrafts=Record<string,SentencePart[]>;
const newId=()=>crypto.randomUUID();
export const sentenceText=(parts:SentencePart[])=>parts.map(p=>p.text+p.after).join('');
export function makeSentenceParts(text:string,language:string,id:()=>string=newId):SentencePart[]{
 const chunks=sentences(text,language);
 return (chunks.length?chunks:[text]).map(chunk=>{const after=chunk.match(/\s*$/u)?.[0]??'';return {id:id(),text:after?chunk.slice(0,-after.length):chunk,after};});
}
/** Segment metadata without changing the textarea text or reidentifying unchanged neighbours. */
export function reconcileSentenceParts(text:string,previous:SentencePart[],language:string,id:()=>string=newId):SentencePart[]{
 const next=makeSentenceParts(text,language,id),same=(a:SentencePart,b:SentencePart)=>a.text===b.text&&a.after===b.after;
 let start=0;while(start<previous.length&&start<next.length&&same(previous[start],next[start])){next[start].id=previous[start].id;start++;}
 let oldEnd=previous.length-1,newEnd=next.length-1;
 while(oldEnd>=start&&newEnd>=start&&same(previous[oldEnd],next[newEnd])){next[newEnd].id=previous[oldEnd].id;oldEnd--;newEnd--;}
 for(let i=start;i<=newEnd&&i-start<=oldEnd-start;i++)next[i].id=previous[i].id;
 return next;
}
export function splitSentence(parts:SentencePart[],index:number,language:string,id:()=>string=newId){
 const part=parts[index];if(!part)return parts;
 const split=makeSentenceParts(part.text,language,id);split[0].id=part.id;split[split.length-1].after+=part.after;
 return [...parts.slice(0,index),...split,...parts.slice(index+1)];
}
export function mergeSentence(parts:SentencePart[],index:number){
 if(index<1||index>=parts.length)return parts;
 const previous=parts[index-1],part=parts[index];
 return [...parts.slice(0,index-1),{...previous,text:previous.text+previous.after+part.text,after:part.after},...parts.slice(index+1)];
}
export function validSentenceDrafts(value:unknown):value is SentenceDrafts {
 return !!value&&typeof value==='object'&&!Array.isArray(value)&&Object.values(value).every(parts=>Array.isArray(parts)&&parts.every(p=>p&&typeof p.id==='string'&&typeof p.text==='string'&&typeof p.after==='string')&&new Set(parts.map(p=>p.id)).size===parts.length);
}
