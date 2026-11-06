import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { PDFDocument } from 'pdf-lib';
import { applicationSteps } from '../src/form/schema.ts';
import { buildApplicationPlan } from '../src/export/plan.ts';
import { placements, tableLayouts } from '../src/export/placements.ts';
import { createApplicationPdf, wrapText } from '../src/export/pdf.ts';

const session = (overrides={}) => ({scope:'full',form:{},question14:{},facts:[],withdrawnFacts:[],draft:[],...overrides});
test('every non-consent field has a version-specific placement in applicant pages',()=>{
  for(const field of applicationSteps.flatMap(s=>s.fields).filter(f=>!f.id.startsWith('16.'))) {
    const place=placements[field.id]; assert.ok(place,field.id);
    assert.ok(place.page>=3 && place.page<=19,field.id);
    assert.ok(place.x>=75 && place.y>=90 && place.x+place.w<=702 && place.y+place.h<=1020,field.id);
    if(field.options) for(const option of field.options) assert.ok(place.choices?.[option.value],`${field.id}/${option.value}`);
    if(field.type==='table') assert.equal(tableLayouts[field.id].columns.length,field.columns.length+1,field.id);
  }
});
test('uses current edited Korean answers; hidden answers are excluded; no inferred defaults',()=>{
  const input=session({form:{'1.2':{kind:'text',text:'가상'},'9.1':{kind:'choice',values:['no']},'9.2':{kind:'text',text:'stale issuer'}},question14:{'14.2':{kind:'choice',values:['yes']},'14.2-detail':{kind:'text',text:'수정된 한국어 진술'}},draft:[{questionId:'14.2',text:'이전 초안'}]});
  const before=JSON.stringify(input),plan=buildApplicationPlan(input,false);
  assert.equal(plan.entries.find(e=>e.field.id==='14.2-detail').text,'수정된 한국어 진술');
  assert.equal(plan.entries.find(e=>e.field.id==='1.3').state,'missing');
  assert.ok(!plan.entries.some(e=>e.field.id==='9.2'));
  assert.ok(!plan.entries.some(e=>e.field.id.startsWith('16.')));
  assert.equal(JSON.stringify(input),before);
});
test('unknown, not applicable and incomplete table cells remain distinct',()=>{
  const plan=buildApplicationPlan(session({form:{'1.2':{kind:'status',status:'unknown'},'1.3':{kind:'status',status:'not_applicable'},'4':{kind:'table',rows:[{name:'가상 이름'}]},'5':{kind:'table',rows:[]}}}),true);
  assert.equal(plan.entries.find(e=>e.field.id==='1.2').state,'unknown');
  assert.equal(plan.entries.find(e=>e.field.id==='1.3').state,'not_applicable');
  assert.equal(plan.entries.find(e=>e.field.id==='4').state,'review');
  assert.equal(plan.entries.find(e=>e.field.id==='5').state,'not_applicable');
  assert.match(plan.entries.find(e=>e.field.id==='4').text,/\[미작성\]/);
});
test('wrapping never drops long words, Korean text or paragraph breaks',()=>{
  const font={widthOfTextAtSize:s=>[...s].length};
  const text='가나다라마\nhttps://test.example/averylongurl\n\n끝';
  const lines=wrapText(text,5,font,9);
  assert.equal(lines.join('').replaceAll('\n',''),text.replaceAll('\n',''));
  assert.ok(lines.includes(''));
});
test('generates local 22-page original plus numbered continuation sheets and checklist',async()=>{
  const plan=buildApplicationPlan(session({scope:'test',form:{'1.2':{kind:'text',text:'가상 성'},'1.3':{kind:'text',text:'테스트 이름'},'4':{kind:'table',rows:[{relationship:'부',name:'가상 아버지',birth:'1960/01/01',nationality:'가상국',city:'가상시'}]}},question14:{'14.2':{kind:'choice',values:['yes']},'14.2-detail':{kind:'text',text:'2025년 봄쯤 위협을 받았지만 정확한 날짜는 기억나지 않습니다. 직접 확인하지 못했습니다. '.repeat(100)+'[끝까지 유지]'}}}),false);
  const assets={template:await readFile(new URL('../public/forms/refugee-application-2019.pdf',import.meta.url)),font:await readFile(new URL('../public/fonts/NanumGothic-Regular.ttf',import.meta.url))};
  const bytes=await createApplicationPdf(plan,assets);
  const pdf=await PDFDocument.load(bytes);
  assert.ok(pdf.getPageCount()>25); assert.equal(pdf.getAuthor(),'DARI');
  assert.equal(pdf.getForm().getFields().length,0);
  // Optional fixture for rendering QA. Never contains real applicant data.
  if(process.env.DARI_EXPORT_FIXTURE) await writeFile(process.env.DARI_EXPORT_FIXTURE,bytes);
  const broken=structuredClone(plan); broken.entries.find(e=>e.field.id==='1.2').text='😀';
  await assert.rejects(()=>createApplicationPdf(broken,assets),/Unsupported characters/);
});
