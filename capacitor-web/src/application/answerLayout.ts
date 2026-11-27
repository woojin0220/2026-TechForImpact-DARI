import type {Box} from '../export/placements.ts';
import {placements,statementSlots} from './form2024.ts';
import {isCurrent,isReviewed,writtenAnswers,type Answers} from './model.ts';
export type AnswerBox={id:string;questionId:string;box:Box;text:string;size:number;checkbox?:boolean};
export type AnswerAnnex={id:string;title:string;text:string;number:number};
const sx=595.28/778,sy=841.89/1100;
export function wrapAnswer(text:string,width:number,size:number):string[]{
 const lines:string[]=[];
 for(const paragraph of text.replace(/\r\n?/g,'\n').split('\n')){let line='',used=0;for(const char of paragraph){const units=/\s/.test(char)?.34:/[\u2e80-\uffef]/u.test(char)?1.05:.68;if(line&&used+units*size>width){lines.push(line);line='';used=0;}line+=char;used+=units*size;}lines.push(line);}return lines;
}
/** One reviewed snapshot for PDF, HWP and Word. Never calls a model or invents fields. */
export function applicationLayout(answers:Answers){
 const entries=writtenAnswers(answers);if(!entries.length)throw Error('No written answers');
 const boxes:AnswerBox[]=[],annexes:AnswerAnnex[]=[];
 for(const{question:q,answer:a}of entries){
  if(!isCurrent(a,q.id))throw Error(`Translation required: ${q.id}`);
  if(!isReviewed(a,q.id))throw Error(`Review required: ${q.id}`);
  const text=a.korean.trim(),title=q.fields[0].ko;
  if(q.id.startsWith('16.')){annexes.push({id:q.id,title,text,number:annexes.length+1});continue;}
  const original=placements[q.id];if(!original)throw Error(`Unmapped question: ${q.id}`);
  const add=(id:string,box:Box,value:string,size:number,checkbox=false)=>boxes.push({id,questionId:q.id,box,text:value,size,checkbox});
  if(q.id==='15'){
   const size=9,lines=wrapAnswer(text,original.w*sx-3,size),overflow=lines.length>statementSlots.length,number=annexes.length+1;
   if(overflow)annexes.push({id:q.id,title,text,number});
   (overflow?[`별지 ${number} 참조`]:lines).forEach((line,i)=>{const slot=statementSlots[i];add(`15-line-${i+1}`,{page:slot.page,x:original.x,y:(slot.bottom-size-3)/sy,w:original.w,h:(size+2)/sy},line,size);});continue;
  }
  const option=q.fields.length===1?q.fields[0].options?.find(o=>o.ko===text||o.en===text):undefined,point=option&&original.choices?.[option.value];
  if(point){add(q.id,{page:original.page,x:point[0]-5,y:point[1]-9,w:16,h:18},'√',10,true);continue;}
  const details=q.fields.slice(1).map(f=>placements[f.id]).filter(p=>p&&!p.choices),ambiguous=!!original.choices&&details.length>1;
  const place=ambiguous?original:(details[0]??original),size=place.h*sy<12?8:9,lines=wrapAnswer(text,place.w*sx-3,size);
  if(q.fields[0].type!=='table'&&lines.length*(size+2)<=place.h*sy&&!place.choices){add(q.id,place,lines.join('\n'),size);continue;}
  const number=annexes.length+1;annexes.push({id:q.id,title,text,number});add(q.id,place,`별지 ${number} 참조`,8);
 }
 return {boxes,annexes};
}
