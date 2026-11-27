import * as CFB from 'cfb';
import {deflateSync,inflateSync} from 'fflate';
import {cells,decode,encodeRecords,records,utf16,view,type HwpCell,type HwpRecord} from '../export/hwpBinary.ts';
import {plainParagraph} from '../export/hwp.ts';
import {questions,type Answers} from './model.ts';
import {applicationLayout,wrapAnswer} from './answerLayout.ts';
import {statementSlots,placements} from './form2024.ts';
const scale=1100/842/100;

/** Fill the genuine 2024 HWP container. No HTML/DOCX file is renamed to .hwp. */
export async function applicationHwp(answers:Answers,supplied?:Uint8Array){
 const layout=applicationLayout(answers);
 const template=supplied??await(async()=>{const r=await fetch(`${import.meta.env?.BASE_URL??'/'}forms/refugee-application-2024.hwp`);if(!r.ok)throw Error('HWP template unavailable');return new Uint8Array(await r.arrayBuffer());})();
 const container=CFB.read(template,{type:'buffer'}),head=CFB.find(container,'/FileHeader'),body=CFB.find(container,'/BodyText/Section0'),info=CFB.find(container,'/DocInfo');
 if(!head||!body||!info)throw Error('Invalid HWP template');const header=new Uint8Array(head.content);
 if(new TextDecoder().decode(header.slice(0,17))!=='HWP Document File')throw Error('Invalid HWP signature');
 const flags=view(header).getUint32(36,true);if(flags&6)throw Error('Unsupported protected HWP');
 const unpack=(value:Uint8Array)=>flags&1?inflateSync(value):value;
 const rs=records(unpack(new Uint8Array(body.content))),all=cells(rs);
 if(!all[0].paras.map(p=>p.text).join('').includes('2024. 12. 3.'))throw Error('Wrong HWP revision');
 const base=all.find(c=>c.page===3&&c.paras.some(p=>p.text.startsWith('1.4 ')))?.paras.find(p=>!p.text.trim());
 if(!base)throw Error('HWP paragraph style missing');
 const shapes=records(unpack(new Uint8Array(info.content))).filter(r=>r.tag===21);
 const shape=shapes.findIndex(r=>r.data.length>=50&&view(r.data).getUint32(42,true)===900&&(view(r.data).getUint32(46,true)&3)===0);
 if(shape<0)throw Error('HWP body font style missing');
 const replacements=new Map<number,{end:number;items:HwpRecord[]}>(),additions=new Map<number,HwpRecord[]>(),used=new Set<number>();
 const annexes=layout.annexes.map(a=>({...a}));
 const cellAt=(page:number,x:number,y:number)=>all.filter(c=>c.page===page&&x>=c.x-3&&x<=c.x+c.width*scale+3&&y>=c.y-3&&y<=c.y+c.height*scale+3).sort((a,b)=>a.width*a.height-b.width*b.height)[0];
 const anchors=new Map(questions.map(q=>{const pattern=new RegExp('^\\s*'+q.id.replaceAll('.','\\.')+'(?![\\d])');return [q.id,all.find(c=>c.page===placements[q.id]?.page&&c.paras.some(p=>pattern.test(p.text)))];}));
 function scope(id:string){const first=anchors.get(id);if(!first)return[];const end=[...anchors.values()].filter((c):c is HwpCell=>!!c&&c.index>first.index).sort((a,b)=>a.index-b.index)[0]?.index??Infinity;return all.filter(c=>c.index>=first.index&&c.index<end);}
 function fill(cell:HwpCell,text:string,y:number,ruled=false){
  const blank=cell.paras.filter(p=>!p.text.trim()&&!used.has(p.index)).sort((a,b)=>Math.abs(cell.y+a.y*scale-y)-Math.abs(cell.y+b.y*scale-y))[0];
  if(blank){used.add(blank.index);const last=!!(view(rs[blank.index].data).getUint32(0,true)&0x80000000),cache=rs.slice(blank.index,blank.end).find(r=>r.tag===69)?.data;replacements.set(blank.index,{end:blank.end,items:plainParagraph(rs[blank.index],shape,text,2,last,false,cache)});}
  else{const previous=cell.paras.at(-1);if(!previous)throw Error('HWP answer paragraph missing');const items=replacements.get(previous.index)?.items,old=items?.[0]??rs[previous.index];view(old.data).setUint32(0,view(old.data).getUint32(0,true)&0x7fffffff,true);view(rs[cell.index].data).setUint16(0,view(rs[cell.index].data).getUint16(0,true)+1,true);additions.set(cell.end,[...(additions.get(cell.end)??[]),...plainParagraph(rs[base!.index],shape,text,2,true)]);}
  if(ruled){const list=view(rs[cell.index].data);list.setUint32(4,(list.getUint32(4,true)&~(3<<5))|(2<<5),true);list.setUint16(30,200,true);}
 }
 for(const item of layout.boxes){
  if(item.checkbox){
   const q=questions.find(q=>q.id===item.questionId)!,option=q.fields[0].options?.find(o=>o.ko===answers[q.id].korean.trim()||o.en===answers[q.id].korean.trim());if(!option)throw Error('HWP choice missing');
   const region=scope(q.id),fallback=cellAt(item.box.page,item.box.x+5,item.box.y+9);if(!region.length&&fallback)region.push(fallback);
   let changed=false;for(const para of region.flatMap(c=>c.paras)){const matches=[...para.text.matchAll(/\[ *\]/g)];for(let i=0;i<matches.length;i++){const m=matches[i],after=para.text.slice(m.index!+m[0].length,matches[i+1]?.index??para.text.length).replace(/\s/g,'').toLowerCase();if([option.ko,option.en].some(s=>after.startsWith(s.replace(/\s/g,'').toLowerCase()))){rs[para.textIndex].data=utf16(para.text.slice(0,m.index!+1)+'√'+para.text.slice(m.index!+2));changed=true;break;}}if(changed)break;}if(!changed)throw Error(`HWP choice label mismatch: ${q.id}`);continue;
  }
  if(item.questionId==='15'){const index=Number(item.id.split('-').at(-1))-1,slot=statementSlots[index],cell=all.find(c=>c.page===slot.page&&c.row===slot.row);if(!cell||cell.paras.some(p=>p.text.trim()))throw Error('HWP statement row mismatch');if(item.text)fill(cell,item.text,cell.y,true);continue;}
  const region=scope(item.questionId),distance=(c:HwpCell)=>Math.abs(c.page-item.box.page)*1100+Math.abs(c.y-item.box.y)+Math.abs(c.x-item.box.x);
  const blanks=region.filter(c=>c.paras.some(p=>!p.text.trim()&&!used.has(p.index))).sort((a,b)=>distance(a)-distance(b));
  const cell=blanks[0]??anchors.get(item.questionId)??cellAt(item.box.page,item.box.x+4,item.box.y+3);if(!cell)throw Error(`HWP answer cell missing: ${item.questionId}`);
  let text=item.text;const units=[...text].reduce((n,c)=>n+(c.charCodeAt(0)>255?1:.6),0);
  if(!/^별지 \d+ 참조$/.test(text)&&(text.includes('\n')||units>Math.max(6,Math.floor(item.box.w/15)))){const q=questions.find(q=>q.id===item.questionId)!;const number=annexes.length+1;annexes.push({id:q.id,title:q.fields[0].ko,text:answers[q.id].korean.trim(),number});text=`별지 ${number} 참조`;}
  fill(cell,text,cell.page===item.box.page?item.box.y:cell.y);
 }
 const out:HwpRecord[]=[];for(let i=0;i<rs.length;){out.push(...(additions.get(i)??[]));const r=replacements.get(i);if(r){out.push(...r.items);i=r.end;}else out.push(rs[i++]);}out.push(...(additions.get(rs.length)??[]));
 if(annexes.length){const last=out.filter(r=>r.tag===66&&r.level===0).at(-1);if(last)view(last.data).setUint32(0,view(last.data).getUint32(0,true)&0x7fffffff,true);}
 const lines:{text:string;pageBreak:boolean}[]=[];
 for(const a of annexes){lines.push({text:`별지 ${a.number} · 문항 ${a.id}`,pageBreak:true});for(const text of [a.title,...a.text.replace(/\r\n?/g,'\n').split('\n')])for(const line of wrapAnswer(text,430,9))lines.push({text:line,pageBreak:false});}
 let row=0,heading='';lines.forEach((line,i)=>{const continued=row>=40&&!line.pageBreak,br=line.pageBreak||continued;if(br)row=0;if(line.pageBreak)heading=line.text;if(continued){const p=plainParagraph(rs[base.index],shape,heading+' (계속)',0,false,true);view(p.find(r=>r.tag===69)!.data).setInt32(4,row++*1600,true);out.push(...p);}const p=plainParagraph(rs[base.index],shape,line.text,0,i===lines.length-1,br&&!continued);view(p.find(r=>r.tag===69)!.data).setInt32(4,row++*1600,true);out.push(...p);});
 CFB.utils.cfb_add(container,'/BodyText/Section0',flags&1?deflateSync(encodeRecords(out)):encodeRecords(out));CFB.utils.cfb_add(container,'/PrvText',utf16('난민인정신청서 작성본'));
 view(header).setUint32(36,flags&~8,true);CFB.utils.cfb_add(container,'/FileHeader',header);
 const clean=CFB.utils.cfb_new();container.FileIndex.forEach((entry,index)=>{const path=container.FullPaths[index];if(entry.type!==2||/\/Scripts\//.test(path)||/\/(PrvImage|PrvText)$/.test(path)||path.includes('Sh33tJ5'))return;CFB.utils.cfb_add(clean,'/'+path.split('/').slice(1).join('/'),new Uint8Array(entry.content));});
 return new Uint8Array(CFB.write(clean,{type:'buffer',fileType:'cfb'}));
}
