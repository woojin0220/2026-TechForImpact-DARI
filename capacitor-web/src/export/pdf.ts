import { PDFDocument, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import type { ApplicationPlan, ExportEntry } from './plan.ts';
import { placements, tableLayouts } from './placements.ts';
import {statementSlots,wrapStatement} from './statement.ts';

export const templateUrl = `${import.meta.env?.BASE_URL ?? '/'}forms/refugee-application-2019.pdf`;
const fontUrl = `${import.meta.env?.BASE_URL ?? '/'}fonts/NanumGothic-Regular.ttf`;
/** Character wrapping also handles long URLs, Korean text and explicit newlines.
 * No content is truncated to make it fit. */
export function wrapText(text: string, width: number, font: Pick<PDFFont, 'widthOfTextAtSize'>, size: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.replace(/\t/g, '    ').split('\n')) {
    let line = '';
    for (const char of paragraph) {
      if (line && font.widthOfTextAtSize(line + char, size) > width) { lines.push(line); line = ''; }
      line += char;
    }
    lines.push(line);
  }
  return lines;
}
async function asset(url: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`PDF asset could not be loaded (${response.status}).`);
  return response.arrayBuffer();
}
export async function createApplicationPdf(plan: ApplicationPlan, supplied?: { template: ArrayBuffer | Uint8Array; font: ArrayBuffer | Uint8Array }): Promise<Uint8Array> {
  const [template, fontBytes] = supplied ? [supplied.template, supplied.font] : await Promise.all([asset(templateUrl), asset(fontUrl)]);
  const pdf = await PDFDocument.load(template);
  if (pdf.getPageCount() !== 22) throw new Error('Wrong application template. Expected 22 pages.');
  pdf.registerFontkit(fontkit);
  const font = await pdf.embedFont(fontBytes, { subset: false });
  const supported = new Set(font.getCharacterSet());
  const unsupported = plan.entries.filter(entry => [...entry.text].some(char => !['\n', '\r', '\t'].includes(char) && !supported.has(char.codePointAt(0)!)));
  if (unsupported.length) throw new Error(`Unsupported characters in fields: ${unsupported.map(entry => entry.field.id).join(', ')}. No text was removed. / 해당 문항에 출력 폰트가 지원하지 않는 문자가 있습니다. 원문은 삭제하지 않았습니다.`);
  // Ignore export-machine metadata; generated files must not contain its username.
  pdf.setTitle('DARI 난민인정신청서 - 사용자 검토용');
  pdf.setAuthor('DARI'); pdf.setCreator('DARI local PDF export'); pdf.setProducer('DARI');
  pdf.setSubject('Provided 2019.12.31 HWP template; not an automatic submission');
  const pages = pdf.getPages();
  // Every output remains explicitly a review copy; signatures and consent are manual.
  for (const page of pages) page.drawText(plan.test ? 'DARI TEST - NOT FOR SUBMISSION' : 'DARI - 사용자 검토용 / REVIEW COPY', { x: 57, y: page.getHeight() - 39, font, size: 8, color: rgb(.55,.25,.1) });
  let appendixCount = 0;
  const annexes: { entry: ExportEntry; number: number }[] = [];
  for (const entry of plan.entries) {
    if (!entry.text) continue;
    const place = placements[entry.field.id];
    if (!place) throw new Error(`Unmapped application field: ${entry.field.id}`);
    const page = pages[place.page - 1];
    const sx = page.getWidth() / 778, sy = page.getHeight() / 1100;
    if(entry.field.id==='15') {
      const lines=wrapStatement(entry.text,line=>font.widthOfTextAtSize(line,9)<=467);
      if(lines.length<=statementSlots.length){
        lines.forEach((line,i)=>{
          const slot=statementSlots[i],target=pages[slot.page-1];
          if(line)target.drawText(line,{x:63,y:target.getHeight()-slot.bottom+2,font,size:9});
        });
      }else{
        const number=++appendixCount;annexes.push({entry,number});
        page.drawText(`별지 ${number} 참조`,{x:63,y:page.getHeight()-statementSlots[0].bottom+2,font,size:9});
      }
      continue;
    }
    if(entry.value?.kind==='table' && entry.value.rows.length) {
      const layout=tableLayouts[entry.field.id];
      if(!layout) throw new Error(`Unmapped table: ${entry.field.id}`);
      const rows=entry.value.rows;
      const fits=rows.length<=layout.rows.length && rows.every((row,index)=>{
        const slot=layout.rows[index];
        return (entry.field.columns??[]).every((column,c)=>wrapText(row[column.id]?.trim()||'',(layout.columns[c+1]-layout.columns[c]-12)*sx,font,8).length*11<=(slot.height-10)*sy);
      });
      if(fits) {
        rows.forEach((row,index)=>{
          const slot=layout.rows[index], target=pages[slot.page-1];
          (entry.field.columns??[]).forEach((column,c)=>{
            const lines=wrapText(row[column.id]?.trim()||'',(layout.columns[c+1]-layout.columns[c]-12)*sx,font,8);
            const blockHeight=8+(lines.length-1)*11;
            lines.forEach((line,l)=>target.drawText(line,{x:(layout.columns[c]+6)*sx,y:target.getHeight()-slot.y*sy-(slot.height*sy-blockHeight)/2-8-l*11,font,size:8}));
          });
        });
        continue;
      }
    }
    if (entry.value?.kind === 'choice' && place.choices) {
      for (const key of entry.value.values) {
        const point = place.choices[key];
        if (!point) throw new Error(`Unmapped option: ${entry.field.id}/${key}`);
        const [x, y] = point;
        // A vector check mark is independent of installed checkbox fonts.
        page.drawLine({ start: {x:(x-3)*sx,y:page.getHeight()-y*sy}, end:{x:(x-1)*sx,y:page.getHeight()-(y+3)*sy}, thickness:1 });
        page.drawLine({ start: {x:(x-1)*sx,y:page.getHeight()-(y+3)*sy}, end:{x:(x+4)*sx,y:page.getHeight()-(y-4)*sy}, thickness:1 });
      }
      // The applicant's own “기타” wording has no box on the form: keep it on a numbered sheet.
      if (entry.value.other?.trim() && entry.value.values.includes('other')) annexes.push({entry, number: ++appendixCount});
      continue;
    }
    const size = 9, lineHeight = 13;
    const width = place.w * sx;
    const lines = wrapText(entry.text, width, font, size);
    // Overflow tables move intact to numbered additional sheets. Unknown choice
    // answers leave boxes unchecked and remain on the review checklist.
    const textHeight=size+Math.max(0,lines.length-1)*lineHeight;
    const useAnnex = (entry.value?.kind === 'table' && entry.value.rows.length > 0) || !!place.choices || textHeight > place.h * sy;
    if (useAnnex) {
      const number = ++appendixCount;
      annexes.push({entry, number});
      if (!place.choices) {
        const reference = `별지 ${number} 참조`;
        page.drawText(reference, {x:place.x*sx, y:page.getHeight()-place.y*sy-size, size:Math.min(size, width/font.widthOfTextAtSize(reference,1)), font});
      }
    } else lines.forEach((line,index) => page.drawText(line, {x:place.x*sx,y:page.getHeight()-place.y*sy-size-index*lineHeight,font,size}));
  }
  // Stable appendices follow all 22 original pages. Repeated headings identify both
  // the official question and continuation, including after a page break.
  for (const {entry, number} of annexes) {
    let page: PDFPage; let y = 0; let part = 0;
    const newPage = () => {
      page = pdf.addPage([595,842]); part++;
      page.drawText(`별지 ${number} / 문항 ${entry.field.id}${part > 1 ? ` / 계속 ${part}` : ''}`,{x:45,y:798,font,size:12});
      const heading = wrapText(entry.field.ko,505,font,10);
      heading.forEach((line,index)=>page.drawText(line,{x:45,y:774-index*15,font,size:10}));
      y=749-heading.length*15;
      page.drawText('DARI 사용자 검토용 / 서명 및 제출은 별도',{x:45,y:30,font,size:8});
    };
    newPage();
    for (const line of wrapText(entry.text,505,font,10)) {
      if (y<60) newPage();
      page!.drawText(line,{x:45,y,font,size:10}); y-=16;
    }
  }
  // Separate review checklist: missing never becomes 'not applicable'.
  let checkPage: PDFPage; let checkY=0;
  const checkNew = () => { checkPage=pdf.addPage([595,842]); checkPage.drawText('DARI 출력 검토 목록 / 신청서 답변이 아닙니다',{x:45,y:798,font,size:12}); checkY=769; };
  const checkLine = (text: string) => { for(const line of wrapText(text,505,font,9)) { if(checkY<55) checkNew(); checkPage!.drawText(line,{x:45,y:checkY,font,size:9});checkY-=14; } checkY-=5; };
  checkNew(); plan.warnings.forEach(checkLine);
  for(const entry of plan.entries.filter(entry=>entry.state!=='answered' && entry.state!=='not_applicable')) checkLine(`[${entry.state === 'missing' ? '미작성' : '확인 필요'}] ${entry.field.id} ${entry.field.ko}${entry.text ? `: ${entry.text}` : ''}`);
  checkLine('별지는 해당 문항의 답변입니다. 이 검토 목록은 제출용 신청서와 구분하세요. 성명 등 직접 입력한 내용의 언어 및 표기, 자필 서약과 서명, 사진과 증빙자료를 직접 확인하세요.');
  return pdf.save();
}
