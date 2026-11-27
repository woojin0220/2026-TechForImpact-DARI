import { strToU8, strFromU8, unzipSync, zipSync } from 'fflate';
import type { Box } from '../export/placements.ts';
import { placements, statementSlots, formRevision } from './form2024.ts';
import { isCurrent, isReviewed, writtenAnswers, type Answers } from './model.ts';

export const wordTemplatePath = 'forms/refugee-application-2024-word.docx';
const xml = (s: string) => s.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const sx=595.28/778, sy=841.89/1100;
/** Conservative wrapping for the fixed original answer areas; overflow is never discarded. */
export function wrapAnswer(text: string, width: number, size: number): string[] {
 const lines:string[]=[];
 for(const paragraph of text.replace(/\r\n?/g,'\n').split('\n')) {
  let line='',used=0;
  for(const char of paragraph) {
   const units=/\s/.test(char)?.34:/[\u2e80-\uffef]/u.test(char)?1.05:.68;
   if(line && used+units*size>width){lines.push(line);line='';used=0;}
   line+=char;used+=units*size;
  }
  lines.push(line);
 }
 return lines;
}
function run(text:string,size=9,bold=false){return `<w:r><w:rPr><w:rFonts w:ascii="Malgun Gothic" w:hAnsi="Malgun Gothic" w:eastAsia="Malgun Gothic"/><w:sz w:val="${size*2}"/><w:szCs w:val="${size*2}"/><w:lang w:val="ko-KR" w:eastAsia="ko-KR"/>${bold?'<w:b/>':''}</w:rPr>${text.split('\n').map((line,i)=>`${i?'<w:br/>':''}<w:t xml:space="preserve">${xml(line)}</w:t>`).join('')}</w:r>`;}
function textBox(id:string,box:Box,text:string,size=9){
 return `<w:r><w:pict><v:rect id="answer-${id}" style="position:absolute;margin-left:${(box.x*sx).toFixed(2)}pt;margin-top:${(box.y*sy).toFixed(2)}pt;width:${(box.w*sx).toFixed(2)}pt;height:${Math.max(box.h*sy,size+2).toFixed(2)}pt;z-index:1;mso-position-horizontal-relative:page;mso-position-vertical-relative:page;v-text-anchor:top" filled="f" stroked="f"><v:textbox inset="0pt,0pt,0pt,0pt" style="mso-fit-shape-to-text:t"><w:txbxContent><w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="${(size+2)*20}" w:lineRule="exact"/><w:jc w:val="left"/></w:pPr>${run(text,size)}</w:p></w:txbxContent></v:textbox><w10:wrap type="none"/></v:rect></w:pict></w:r>`;
}
/** Preserve the original 22 PDF pages as background images, with editable Word answers.
 * This intentionally does not pretend that PDF labels are editable Word tables. */
export function applicationDocx(answers: Answers, template: Uint8Array): Uint8Array {
 const entries=writtenAnswers(answers); if(!entries.length)throw new Error('No written answers');
 const files=unzipSync(template);
 if(!files['word/document.xml'])throw new Error('Missing official Word template');
 if(!files['dari/form.json'] || JSON.parse(strFromU8(files['dari/form.json'])).revision!==formRevision)throw new Error('Wrong official form revision');
 let document=strFromU8(files['word/document.xml']);
 if(!document.includes('<!--DARI_PAGE_22-->')||!files['word/media/page-22.jpg'])throw new Error('Wrong official Word template');
 const pages=new Map<number,string[]>();
 const annexes:{id:string;title:string;text:string;number:number}[]=[];
 const add=(page:number,content:string)=>pages.set(page,[...(pages.get(page)??[]),content]);
 for(const {question:q,answer:a} of entries){
  if(!isCurrent(a,q.id))throw new Error(`Translation required: ${q.id}`);
  if(!isReviewed(a,q.id))throw new Error(`Review required: ${q.id}`);
  const text=a.korean.trim();
  // Oaths, consent, signatures and officer fields are preserved for manual completion.
  if(q.id.startsWith('16.')){annexes.push({id:q.id,title:q.fields[0].ko,text,number:annexes.length+1});continue;}
  const original=placements[q.id];if(!original)throw new Error(`Unmapped question: ${q.id}`);
  if(q.id==='15') {
   const size=9;
   const lines=wrapAnswer(text,original.w*sx-3,size);
   const overflow=lines.length>statementSlots.length;
   const number=annexes.length+1;
   if(overflow)annexes.push({id:q.id,title:q.fields[0].ko,text,number});
   // Each printed rule is a separate writing row; continuous 11 pt leading crosses it.
   const written=overflow?[`별지 ${number} 참조`]:lines;
   written.forEach((line,i)=>{
    const slot=statementSlots[i];
    add(slot.page,textBox(`15-line-${i+1}`,{page:slot.page,x:original.x,y:(slot.bottom-size-3)/sy,w:original.w,h:(size+2)/sy},line,size));
   });
   continue;
  }
  const option=q.fields.length===1?q.fields[0].options?.find(o=>o.ko===text):undefined;
  const point=option&&original.choices?.[option.value];
  if(point){add(original.page,textBox(q.id,{page:original.page,x:point[0]-5,y:point[1]-9,w:16,h:18},'√',10));continue;}
  const details=q.fields.slice(1).map(f=>placements[f.id]).filter(p=>p&&!p.choices);
  // A single free-text answer cannot identify which conditional detail area applies.
  // Keep it in a numbered appendix rather than assigning it to the first branch.
  const ambiguousBranch=!!original.choices && details.length>1;
  const place=ambiguousBranch?original:(details[0]??original);
  const size=place.h*sy<12?8:9;
  const lines=wrapAnswer(text,place.w*sx-3,size);
  const table=q.fields[0].type==='table';
  if(!table && lines.length*(size+2)<=place.h*sy && !place.choices){add(place.page,textBox(q.id,place,lines.join('\n'),size));continue;}
  const number=annexes.length+1;annexes.push({id:q.id,title:q.fields[0].ko,text,number});
  const reference=`별지 ${number} 참조`;
  // The supplied measured fallback areas are deliberately outside printed checkbox labels.
  add(place.page,textBox(q.id,place,reference,8));
 }
 for(let page=1;page<=22;page++)document=document.replace(`<!--DARI_PAGE_${page}-->`,(pages.get(page)??[]).join(''));
 let appendix='';
 if(annexes.length){
  appendix='<w:p><w:pPr><w:pageBreakBefore/><w:keepNext/></w:pPr>'+run('추가 답변',12,true)+'</w:p>';
  for(const a of annexes)appendix+=`<w:p><w:pPr><w:keepNext/><w:spacing w:before="240" w:after="120"/></w:pPr>${run(`별지 ${a.number} · 문항 ${a.id} ${a.title}`,11,true)}</w:p><w:p><w:pPr><w:widowControl/><w:spacing w:after="180" w:line="340" w:lineRule="exact"/></w:pPr>${run(a.text,11)}</w:p>`;
 }
 document=document.replace('<!--DARI_APPENDIX-->',appendix).replace('<w:pgMar w:top="0" w:bottom="0" w:left="0" w:right="0" w:header="0" w:footer="0"/>','<w:pgMar w:top="1000" w:bottom="1000" w:left="1000" w:right="1000" w:header="0" w:footer="0"/>');
 files['word/document.xml']=strToU8(document);
 return zipSync(files);
}
export async function downloadApplication(answers: Answers) {
 const response=await fetch(`${import.meta.env.BASE_URL}${wordTemplatePath}`);
 if(!response.ok)throw new Error('Official Word template unavailable');
 const bytes=applicationDocx(answers,new Uint8Array(await response.arrayBuffer()));
 const url=URL.createObjectURL(new Blob([bytes as BlobPart],{type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'}));
 const a=document.createElement('a');a.href=url;a.download='DARI-신청서.docx';a.click();
 setTimeout(()=>URL.revokeObjectURL(url),60000);
}
