/** Minimal HWP 5 record handling, independently implemented from Hancom's
 * published HWP 5.0 rev 1.3 specification (paragraph and table records). */
export type HwpRecord = {tag:number;level:number;data:Uint8Array};
export const view=(bytes:Uint8Array)=>new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
export function records(bytes:Uint8Array):HwpRecord[] {
  const result:HwpRecord[]=[]; let offset=0;
  while(offset<bytes.length) {
    if(offset+4>bytes.length) throw new Error('Truncated HWP record');
    const header=view(bytes).getUint32(offset,true);offset+=4;let size=header>>>20;
    if(size===4095) {if(offset+4>bytes.length) throw new Error('Truncated HWP record size');size=view(bytes).getUint32(offset,true);offset+=4;}
    if(offset+size>bytes.length) throw new Error('Truncated HWP payload');
    result.push({tag:header&1023,level:(header>>>10)&1023,data:bytes.slice(offset,offset+size)});offset+=size;
  }
  return result;
}
export function encodeRecords(items:HwpRecord[]):Uint8Array {
  const size=items.reduce((n,r)=>n+r.data.length+(r.data.length>=4095?8:4),0), out=new Uint8Array(size);let pos=0;
  for(const r of items) {
    view(out).setUint32(pos,(r.tag|(r.level<<10)|(Math.min(r.data.length,4095)<<20))>>>0,true);pos+=4;
    if(r.data.length>=4095) {view(out).setUint32(pos,r.data.length,true);pos+=4;}
    out.set(r.data,pos);pos+=r.data.length;
  }
  return out;
}
export function utf16(text:string):Uint8Array {const out=new Uint8Array(text.length*2);for(let i=0;i<text.length;i++) view(out).setUint16(i*2,text.charCodeAt(i),true);return out;}
export const decode=(bytes:Uint8Array)=>new TextDecoder('utf-16le').decode(bytes);
export type HwpParagraph = {index:number;end:number;textIndex:number;text:string;y:number;shape:number};
export type HwpCell = {index:number;end:number;page:number;row:number;col:number;rowspan:number;colspan:number;width:number;height:number;x:number;y:number;paras:HwpParagraph[]};
export function paragraphs(rs:HwpRecord[],start:number,end:number,level:number):HwpParagraph[] {
  const result:HwpParagraph[]=[];
  for(let i=start;i<end;i++) if(rs[i].tag===66 && rs[i].level===level) {
    let stop=i+1;while(stop<end && rs[stop].level>level) stop++;
    const textIndex=rs.findIndex((r,j)=>j>i&&j<stop&&r.tag===67&&r.level===level+1);
    const line=rs.slice(i+1,stop).find(r=>r.tag===69&&r.level===level+1);
    const shape=rs.slice(i+1,stop).find(r=>r.tag===68&&r.level===level+1);
    result.push({index:i,end:stop,textIndex,text:textIndex<0?'':decode(rs[textIndex].data),y:line&&line.data.length>=8?view(line.data).getInt32(4,true):0,shape:shape&&shape.data.length>=8?view(shape.data).getUint32(4,true):0});
  }
  return result;
}
function axis(cells:HwpCell[],position:'row'|'col',span:'rowspan'|'colspan',size:'height'|'width'):Map<number,number> {
  const values=new Map([[0,0]]);
  for(let n=0;n<cells.length+1;n++) {
    let changed=false;
    for(const cell of cells) {
      const a=cell[position],b=a+cell[span],length=cell[size];
      if(values.has(a)&&!values.has(b)) {values.set(b,values.get(a)!+length);changed=true;}
      else if(values.has(b)&&!values.has(a)) {values.set(a,values.get(b)!-length);changed=true;}
    }
    if(!changed) break;
  }
  return values;
}
/** Outer tables correspond to the 22 original sheets. Their cell coordinates use
 * HWPUNIT (1/7200 inch); templates have 20mm margins. Nested tables are retained. */
export function cells(rs:HwpRecord[]):HwpCell[] {
  const out:HwpCell[]=[];let page=0;
  for(let i=0;i<rs.length;i++) {
    if(rs[i].tag===77 && rs[i].level===2) page++;
    if(rs[i].tag!==72||rs[i].level!==2||rs[i].data.length<32) continue;
    let end=i+1;while(end<rs.length&&rs[end].level>=2&&!(rs[end].tag===72&&rs[end].level===2)) end++;
    const d=view(rs[i].data);
    out.push({index:i,end,page,col:d.getUint16(8,true),row:d.getUint16(10,true),colspan:d.getUint16(12,true),rowspan:d.getUint16(14,true),width:d.getInt32(16,true),height:d.getInt32(20,true),x:0,y:0,paras:paragraphs(rs,i+1,end,2)});
  }
  if(page!==22) throw new Error('Unexpected HWP template table structure');
  const scale=1100/842/100,margin=20/25.4*72*1100/842;
  for(let page=1;page<=22;page++) {
    const group=out.filter(cell=>cell.page===page),xs=axis(group,'col','colspan','width'),ys=axis(group,'row','rowspan','height');
    for(const cell of group) {
      if(!xs.has(cell.col)||!ys.has(cell.row)) throw new Error(`Unresolved HWP cell geometry on sheet ${page}`);
      cell.x=margin+xs.get(cell.col)!*scale;cell.y=margin+ys.get(cell.row)!*scale;
    }
  }
  return out;
}
