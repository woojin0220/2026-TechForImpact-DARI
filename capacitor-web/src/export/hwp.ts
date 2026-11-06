import * as CFB from 'cfb';
import {deflateSync,inflateSync} from 'fflate';
import {cells,decode,encodeRecords,paragraphs,records,utf16,view,type HwpCell,type HwpParagraph,type HwpRecord} from './hwpBinary.ts';
import type {ApplicationPlan,ExportEntry} from './plan.ts';
import {placements} from './placements.ts';
import {hwpTableRows} from './hwpTables.ts';
import {statementSlots,wrapStatement} from './statement.ts';

const SCALE=1100/842/100;
const normalize=(s:string)=>s.replace(/[\s.,’'()ㆍ·]/g,'').toLowerCase();
function cellAt(all:HwpCell[],page:number,x:number,y:number) {
  const candidates=all.filter(c=>c.page===page&&x>=c.x-3&&x<c.x+c.width*SCALE+3&&y>=c.y-3&&y<c.y+c.height*SCALE+3);
  // Tolerance may touch the next row. Prefer the actual interior.
  return candidates.sort((a,b)=>{
    const distance=(c:HwpCell)=>Math.max(c.x-x,0,x-c.x-c.width*SCALE)+Math.max(c.y-y,0,y-c.y-c.height*SCALE);
    return distance(a)-distance(b);
  })[0];
}
export function checkboxTarget(entry:ExportEntry,key:string,all:HwpCell[]) {
  const point=placements[entry.field.id]?.choices?.[key];
  if(!point) throw new Error(`HWP option placement missing: ${entry.field.id}/${key}`);
  const place=placements[entry.field.id],cell=cellAt(all,place.page,...point);
  const primary=!entry.field.id.includes('-')?questionCell(all,entry.field.id):undefined;
  const scope=primary?all.filter(c=>c.page===primary.page&&c.index>=primary.index):cell?[cell]:[];
  if(!scope.length) throw new Error(`HWP cell missing: ${entry.field.id}`);
  const option=entry.field.options?.find(o=>o.value===key);
  const names=[option?.ko,option?.en].filter((s):s is string=>!!s).map(normalize);
  const candidates:{para:HwpParagraph;offset:number;distance:number}[]=[];
  for(const owner of scope) for(const para of owner.paras) {
    const matches=[...para.text.matchAll(/\[ *\]/g)];
    for(let i=0;i<matches.length;i++) {
      const match=matches[i],end=matches[i+1]?.index??para.text.length;
      const after=normalize(para.text.slice(match.index!+match[0].length,end));
      if(names.some(name=>after.startsWith(name))) candidates.push({para,offset:match.index!+1,distance:primary?para.index-primary.index:Math.abs(owner.y+para.y*SCALE+15-point[1])});
    }
  }
  const target=candidates.sort((a,b)=>a.distance-b.distance)[0];
  if(!target) throw new Error(`HWP checkbox label does not match template: ${entry.field.id}/${key}`);
  return target;
}
function questionCell(all:HwpCell[],id:string) {
  const pattern=new RegExp('^\\s*'+id.replaceAll('.','\\.')+(id.includes('.')?'(?![\\d.])':'\\.\\s'));
  return all.find(cell=>cell.page===placements[id]?.page&&cell.paras.some(para=>pattern.test(para.text)));
}
function plainParagraph(template:HwpRecord,shape:number,text:string,level:number,last:boolean,pageBreak=false,cache?:Uint8Array):HwpRecord[] {
  if(/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(text)) throw new Error('Unsupported control character in HWP answer. No content was removed.');
  const value=text.replace(/\r\n?/g,'\n').replace(/\t/g,'    ')+'\r';
  const header=template.data.slice();
  view(header).setUint32(0,(value.length|(last?0x80000000:0))>>>0,true);
  view(header).setUint32(4,value.includes('\n')?1<<10:0,true);
  header[11]=pageBreak?4:0;
  view(header).setUint16(12,1,true);view(header).setUint16(14,0,true);view(header).setUint16(16,1,true);
  const chars=new Uint8Array(8);view(chars).setUint32(4,shape,true);
  const line=cache?.slice(0,36)??new Uint8Array(36);
  view(line).setUint32(0,0,true);
  if(!cache) [1000,1000,850,600,0,47889,0x60000].forEach((n,i)=>view(line).setInt32(8+i*4,n,true));
  view(line).setUint32(32,view(line).getUint32(32,true)&~(1<<16),true);
  // Hancom's native loader rejects a PARA_TEXT record containing only CR.
  // Empty paragraphs use the header's implicit paragraph break, as in source.
  return [{tag:66,level,data:header},...(text?[{tag:67,level:level+1,data:utf16(value)}]:[]),{tag:68,level:level+1,data:chars},{tag:69,level:level+1,data:line}];
}
export async function createApplicationHwp(plan:ApplicationPlan,supplied?:Uint8Array):Promise<Uint8Array> {
  const template=supplied??await (async()=>{const response=await fetch(`${import.meta.env?.BASE_URL??'/'}forms/refugee-application-2019.hwp`);if(!response.ok)throw new Error('HWP template could not be loaded');return new Uint8Array(await response.arrayBuffer());})();
  const container=CFB.read(template,{type:'buffer'});
  const headerEntry=CFB.find(container,'/FileHeader'),body=CFB.find(container,'/BodyText/Section0');
  if(!headerEntry||!body) throw new Error('Not an HWP 5 template');
  const fileHeader=new Uint8Array(headerEntry.content);
  if(new TextDecoder().decode(fileHeader.slice(0,17))!=='HWP Document File') throw new Error('Invalid HWP template signature');
  const flags=view(fileHeader).getUint32(36,true);
  if(flags&6) throw new Error('Encrypted/distribution HWP cannot be filled');
  const rs=records(flags&1?inflateSync(new Uint8Array(body.content)):new Uint8Array(body.content));
  const all=cells(rs);
  const originalFirst=all[0].paras.map(p=>p.text).join('');
  if(!originalFirst.includes('2019. 12. 31.')) throw new Error('HWP template revision mismatch');
  const base=all.find(c=>c.paras.some(p=>p.index===316))?.paras.find(p=>p.index===316);
  if(!base||base.text.trim()) throw new Error('HWP paragraph template mismatch');
  const answerShape=all.flatMap(c=>c.paras).find(p=>p.index===337)?.shape;
  if(answerShape===undefined) throw new Error('HWP answer font style missing');
  const replacements=new Map<number,{end:number;items:HwpRecord[]}>();
  const additions=new Map<number,HwpRecord[]>();
  const used=new Set<number>();
  let annexNo=0;
  const annexes:{entry:ExportEntry;number:number}[]=[];
  function fill(cell:HwpCell,text:string,y:number,center=false) {
    // Only data-only cells may be centered: leave the official question labels
    // and their paragraph layout unchanged in mixed question/answer cells.
    if(center&&cell.paras.every(p=>!p.text.trim())) {
      const first=cell.paras[0],list=view(rs[cell.index].data);
      list.setUint16(0,1,true);
      list.setUint32(4,(list.getUint32(4,true)&~(3<<5))|(1<<5),true);
      const cache=rs.slice(first.index,first.end).find(r=>r.tag===69)?.data.slice();
      if(cache)view(cache).setInt32(4,0,true);
      replacements.set(first.index,{end:cell.end,items:plainParagraph(rs[first.index],answerShape!,text,2,true,false,cache)});
      cell.paras.forEach(p=>used.add(p.index));
      return;
    }
    const blank=cell.paras.filter(p=>!p.text.trim()&&!used.has(p.index)).sort((a,b)=>Math.abs(cell.y+a.y*SCALE-y)-Math.abs(cell.y+b.y*SCALE-y))[0];
    if(blank) {
      used.add(blank.index);
      const last=!!(view(rs[blank.index].data).getUint32(0,true)&0x80000000);
      const cache=rs.slice(blank.index,blank.end).find(r=>r.tag===69)?.data;
      replacements.set(blank.index,{end:blank.end,items:plainParagraph(rs[blank.index],answerShape!,text,2,last,false,cache)});
    } else {
      // A few date/occupation cells contain no empty paragraph in the source.
      // Append to that cell's list and update both list count and final marker.
      const previous=cell.paras.at(-1)!;
      const old=replacements.get(previous.index)?.items[0]??rs[previous.index];
      view(old.data).setUint32(0,view(old.data).getUint32(0,true)&0x7fffffff,true);
      const list=rs[cell.index];view(list.data).setUint16(0,view(list.data).getUint16(0,true)+1,true);
      const existing=additions.get(cell.end)??[];
      if(existing.length) view(existing[existing.length-4].data).setUint32(0,view(existing[existing.length-4].data).getUint32(0,true)&0x7fffffff,true);
      additions.set(cell.end,[...existing,...plainParagraph(rs[base!.index],answerShape!,text,2,true)]);
    }
  }
  function annex(entry:ExportEntry,cell:HwpCell,y:number) {
    const number=++annexNo;annexes.push({entry,number});fill(cell,`별지 ${number} 참조`,y,entry.value?.kind==='table');
  }
  for(const entry of plan.entries) {
    if(!entry.text) continue;
    const p=placements[entry.field.id];if(!p)throw new Error(`HWP field missing: ${entry.field.id}`);
    if(entry.value?.kind==='choice') {
      for(const key of entry.value.values) {
        const target=checkboxTarget(entry,key,all),r=rs[target.para.textIndex];
        const text=decode(r.data);r.data=utf16(text.slice(0,target.offset)+'✓'+text.slice(target.offset+1));
      }
      continue;
    }
    if(entry.value?.kind==='status'&&(entry.field.type==='single'||entry.field.type==='multi')) {
      // Unknown / not-applicable is not a yes/no choice. Keep boxes unchecked
      // and state the applicant's explicit answer on a question-numbered sheet.
      annexes.push({entry,number:++annexNo});continue;
    }
    const parentId=entry.field.id.split('-')[0];
    const semantic=entry.value?.kind!=='table'?questionCell(all,parentId):undefined;
    const tableRows=hwpTableRows[entry.field.id]?.map(slot=>all.filter(c=>c.page===slot.page&&c.row===slot.row).sort((a,b)=>a.col-b.col));
    const cell=(entry.field.id==='15'?all.find(c=>c.index===4450):undefined)??tableRows?.[0]?.[0]??(semantic?.page===p.page?semantic:undefined)??cellAt(all,p.page,p.x+4,p.y+3);if(!cell)throw new Error(`HWP answer cell missing: ${entry.field.id}`);
    if(entry.field.id==='15') {
      const targets=statementSlots.map(slot=>all.find(c=>c.page===slot.page&&c.row===slot.row));
      if(targets.some(c=>!c||c.paras.some(p=>p.text.trim())))throw new Error('HWP ruled statement rows do not match template');
      const lines=wrapStatement(entry.text,line=>[...line].reduce((n,ch)=>n+(ch.charCodeAt(0)>255?1:.6),0)<=43);
      const fillRuled=(target:HwpCell,line:string)=>{
        if(!line)return;
        fill(target,line,target.y,true);
        const list=view(rs[target.index].data);
        list.setUint32(4,(list.getUint32(4,true)&~(3<<5))|(2<<5),true);
        list.setUint16(30,200,true); // 2pt bottom inset above the original rule.
      };
      if(lines.length<=targets.length)lines.forEach((line,i)=>fillRuled(targets[i]!,line));
      else {const number=++annexNo;annexes.push({entry,number});fillRuled(targets[0]!,`별지 ${number} 참조`);}
      continue;
    }
    // The original fields are fixed-size review boxes. Keep ample headroom for
    // differences in installed HWP fonts; overflow never expands original sheets.
    const units=[...entry.text].reduce((sum,char)=>sum+(char.charCodeAt(0)>255?1:.6),0);
    const capacity=Math.max(6,Math.floor(p.w/15));
    if(entry.value?.kind==='table'&&entry.value.rows.length) {
      const rows=entry.value.rows;
      if(!tableRows||tableRows.some(row=>row.length!==entry.field.columns?.length||row.some(c=>c.paras.some(p=>p.text.trim())))) throw new Error(`HWP table structure mismatch: ${entry.field.id}`);
      const fits=rows.length<=tableRows.length&&rows.every((row,r)=>(entry.field.columns??[]).every((col,c)=>!/[\r\n]/.test(row[col.id]??'')&&[...(row[col.id]??'')].reduce((sum,ch)=>sum+(ch.charCodeAt(0)>255?1:.5),0)*14<=tableRows[r][c].width*SCALE-14));
      if(fits) rows.forEach((row,r)=>(entry.field.columns??[]).forEach((col,c)=>{
        const target=tableRows[r][c];
        if(!target)throw new Error(`HWP table cell missing: ${entry.field.id}/${r}/${col.id}`);
        if(row[col.id]?.trim())fill(target,row[col.id].trim(),target.y+14,true);
      }));
      else annex(entry,cell,p.y);
    } else if(units>capacity||entry.text.includes('\n')) annex(entry,cell,p.y);
    else fill(cell,entry.field.id==='1.13'?'모국어: '+entry.text:entry.field.id==='1.13-other'?'기타 언어: '+entry.text:entry.text,p.y);
  }
  const out:HwpRecord[]=[];
  for(let i=0;i<rs.length;) {
    out.push(...(additions.get(i)??[]));
    const replacement=replacements.get(i);
    if(replacement){out.push(...replacement.items);i=replacement.end;}else out.push(rs[i++]);
  }
  out.push(...(additions.get(rs.length)??[]));
  const rootParagraphs=out.filter(r=>r.tag===66&&r.level===0);
  if(rootParagraphs.length) {const last=rootParagraphs.at(-1)!;view(last.data).setUint32(0,view(last.data).getUint32(0,true)&0x7fffffff,true);}
  const tail:string[]=[];
  for(const a of annexes) tail.push(`별지 ${a.number} / 문항 ${a.entry.field.id}`,a.entry.field.ko,...a.entry.text.split('\n'),'');
  tail.push('DARI 출력 검토 목록 (신청서 답변이 아닙니다)',...plan.warnings);
  for(const entry of plan.entries.filter(e=>e.state!=='answered'&&e.state!=='not_applicable')) tail.push(`[${entry.state==='missing'?'미작성':'확인 필요'}] ${entry.field.id} ${entry.field.ko}${entry.text?' / '+entry.text:''}`);
  tail.push('이 문서는 사용자 검토용입니다. 서약, 서명, 동의 표시와 제출은 본인이 별도로 진행해야 합니다.');
  const wrapped:{text:string;pageBreak:boolean}[]=[];
  for(const text of tail) {
    let line='',units=0,first=true;
    for(const char of text) {
      const w=char.charCodeAt(0)>255?1:.6;
      if(units+w>43) {wrapped.push({text:line,pageBreak:first&&(text.startsWith('별지 ')||text.startsWith('DARI 출력 검토 목록'))});first=false;line='';units=0;}
      line+=char;units+=w;
    }
    wrapped.push({text:line,pageBreak:first&&(text.startsWith('별지 ')||text.startsWith('DARI 출력 검토 목록'))});
  }
  let row=0,heading='DARI 출력 검토 목록';
  wrapped.forEach((line,index)=>{
    const automatic=row>=40&&!line.pageBreak;
    const pageBreak=index===0||line.pageBreak||automatic;if(pageBreak)row=0;
    if(line.pageBreak)heading=line.text;
    if(automatic) {
      const continued=plainParagraph(rs[base.index],answerShape,heading+' (계속)',0,false,true);
      view(continued.find(r=>r.tag===69)!.data).setInt32(4,row++*1600,true);out.push(...continued);
    }
    const para=plainParagraph(rs[base.index],answerShape,line.text,0,index===wrapped.length-1,pageBreak&&!automatic);
    view(para.find(r=>r.tag===69)!.data).setInt32(4,row++*1600,true);out.push(...para);
  });
  CFB.utils.cfb_add(container,'/BodyText/Section0',flags&1?deflateSync(encodeRecords(out)):encodeRecords(out));
  CFB.utils.cfb_add(container,'/PrvText',utf16(['DARI 사용자 검토용',...plan.entries.filter(e=>e.text).map(e=>`${e.field.id}: ${e.text}`)].join('\r\n').slice(0,4000)));
  view(fileHeader).setUint32(36,flags&~8,true);CFB.utils.cfb_add(container,'/FileHeader',fileHeader);
  // Rebuild directory entries instead of retaining freed slots/tree pointers
  // from the original compound file. No original scripts or stale preview image.
  const clean=CFB.utils.cfb_new();
  container.FileIndex.forEach((entry,index)=>{
    const path=container.FullPaths[index];
    if(entry.type===2&&!/\/Scripts\//.test(path)&&!path.endsWith('/PrvImage')) CFB.utils.cfb_add(clean,'/'+path.split('/').slice(1).join('/'),new Uint8Array(entry.content));
  });
  return new Uint8Array(CFB.write(clean,{type:'buffer',fileType:'cfb'}));
}
