import {PDFDocument,rgb,type PDFPage} from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import type {Answers} from './model.ts';
import {applicationLayout} from './answerLayout.ts';
import {wrapText} from '../export/pdf.ts';

export async function applicationPdf(answers:Answers,supplied?:{template:Uint8Array;font:Uint8Array}){
 const layout=applicationLayout(answers);
 const asset=async(path:string)=>{const r=await fetch(`${import.meta.env?.BASE_URL??'/'}${path}`);if(!r.ok)throw Error('Export asset unavailable');return new Uint8Array(await r.arrayBuffer());};
 const [template,fontBytes]=supplied?[supplied.template,supplied.font]:await Promise.all([asset('forms/refugee-application-2024.pdf'),asset('fonts/NanumGothic-Regular.ttf')]);
 const pdf=await PDFDocument.load(template);if(pdf.getPageCount()!==22)throw Error('Wrong official PDF template');pdf.registerFontkit(fontkit);
 const font=await pdf.embedFont(fontBytes,{subset:false}),supported=new Set(font.getCharacterSet());
 for(const text of [...layout.boxes.map(b=>b.text),...layout.annexes.flatMap(a=>[a.title,a.text])])if([...text].some(c=>!['\n','\r','\t'].includes(c)&&!supported.has(c.codePointAt(0)!)))throw Error('Unsupported PDF character. No answer was removed.');
 pdf.setTitle('난민인정신청서 작성본');pdf.setAuthor('DARI');pdf.setCreator('DARI');pdf.setProducer('DARI');pdf.setSubject('2024-12-03 form; handwritten declaration and signature remain blank');
 const pages=pdf.getPages();
 for(const item of layout.boxes){const page=pages[item.box.page-1],sx=page.getWidth()/778,sy=page.getHeight()/1100;
  if(item.checkbox){const x=(item.box.x+5)*sx,y=page.getHeight()-(item.box.y+9)*sy;page.drawLine({start:{x:x-3*sx,y},end:{x:x-1*sx,y:y-3*sy},thickness:1});page.drawLine({start:{x:x-1*sx,y:y-3*sy},end:{x:x+4*sx,y:y+4*sy},thickness:1});}
  else item.text.split('\n').forEach((line,i)=>{if(line)page.drawText(line,{x:item.box.x*sx,y:page.getHeight()-item.box.y*sy-item.size-i*(item.size+2),font,size:item.size});});
 }
 for(const annex of layout.annexes){let page:PDFPage,y=0,part=0;const next=()=>{page=pdf.addPage([595.28,841.89]);part++;page.drawText(`별지 ${annex.number} · 문항 ${annex.id}${part>1?` · 계속 ${part}`:''}`,{x:45,y:794,font,size:12});const heading=wrapText(annex.title,505,font,10);heading.forEach((s,i)=>page.drawText(s,{x:45,y:770-i*15,font,size:10}));y=744-heading.length*15;page.drawText(`${annex.number} - ${part}`,{x:505,y:30,font,size:8,color:rgb(.45,.45,.45)});};next();for(const line of wrapText(annex.text.replace(/\r\n?/g,'\n'),505,font,11)){if(y<58)next();if(line)page!.drawText(line,{x:45,y,font,size:11});y-=17;}}
 return pdf.save();
}
