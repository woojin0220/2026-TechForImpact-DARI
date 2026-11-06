import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import * as CFB from 'cfb';
import {inflateSync} from 'fflate';
import {applicationSteps} from '../src/form/schema.ts';
import {buildApplicationPlan} from '../src/export/plan.ts';
import {createApplicationHwp,checkboxTarget} from '../src/export/hwp.ts';
import {records,cells,decode,encodeRecords,view} from '../src/export/hwpBinary.ts';
import {hwpTableRows} from '../src/export/hwpTables.ts';
const template=await readFile(new URL('../public/forms/refugee-application-2019.hwp',import.meta.url));
const source=CFB.read(template,{type:'buffer'});
const original=inflateSync(new Uint8Array(CFB.find(source,'/BodyText/Section0').content));
test('HWP record codec round trips the original body byte-for-byte',()=>{
  assert.deepEqual(encodeRecords(records(original)),original);
  assert.throws(()=>records(new Uint8Array([1,2,3])),/Truncated/);
});
test('all original checkbox options match actual HWP labels, including conditional child questions',()=>{
  const all=cells(records(original));const failures=[];
  for(const field of applicationSteps.flatMap(s=>s.fields).filter(f=>f.options&&!f.id.startsWith('16.'))) {
    for(const option of field.options) try {checkboxTarget({field},option.value,all);}catch(error){failures.push(error.message);}
  }
  assert.deepEqual(failures,[]);
});
test('actual HWP contains current Korean edits, long continuation, original form and blank declarations',async()=>{
  const session={scope:'test',form:{'1.1':{kind:'choice',values:['principal']},'1.2':{kind:'text',text:'가상'},'1.3':{kind:'text',text:'테스트'},'1.5':{kind:'text',text:'1990/01/01'},'1.8':{kind:'text',text:'교사'}},question14:{'14.1':{kind:'choice',values:['political']},'14.2':{kind:'choice',values:['yes']},'14.2-detail':{kind:'text',text:'2025년 봄쯤 위협받았지만 정확한 날짜는 기억나지 않습니다. 구금되거나 다치지 않았습니다. '.repeat(90)+'[진술 마지막]'}},facts:[],withdrawnFacts:[],draft:[]};
  const plan=buildApplicationPlan(session,false),before=JSON.stringify(plan);
  const output=await createApplicationHwp(plan,template);
  assert.deepEqual([...output.slice(0,8)],[208,207,17,224,161,177,26,225]);
  const c=CFB.read(output,{type:'buffer'}),body=records(inflateSync(new Uint8Array(CFB.find(c,'/BodyText/Section0').content)));
  const text=body.filter(r=>r.tag===67).map(r=>decode(r.data)).join('\n');
  const continuous=text.replace(/[\r\n]/g,'');
  for(const expected of ['가상','테스트','1990/01/01','교사','[✓] 주신청자','[✓] 정치적 의견','별지 1 참조','[진술 마지막]','정확한 날짜는 기억나지 않습니다.','난민신청자 본인 서약']) assert.ok(continuous.includes(expected),expected);
  const appendix=body.filter(r=>r.tag===67&&r.level===1&&!decode(r.data).endsWith('(계속)\r')).map(r=>decode(r.data)).join('').replace(/[\r\n]/g,'');
  assert.ok(appendix.includes(session.question14['14.2-detail'].text));
  assert.equal(JSON.stringify(plan),before);
  assert.ok(!CFB.find(c,'/Scripts/DefaultJScript'));
  assert.ok(!CFB.find(c,'/PrvImage'));
  const header=new Uint8Array(CFB.find(c,'/FileHeader').content);assert.equal(view(header).getUint32(36,true)&8,0);
  if(process.env.DARI_HWP_FIXTURE) await writeFile(process.env.DARI_HWP_FIXTURE,output);
});
test('all HWP table grids map to blank original cells, independently of PDF auto-height',()=>{
  const all=cells(records(original));
  for(const field of applicationSteps.flatMap(s=>s.fields).filter(f=>f.type==='table')) {
    const rows=hwpTableRows[field.id];assert.ok(rows,field.id);
    for(const slot of rows) {
      const targets=all.filter(c=>c.page===slot.page&&c.row===slot.row);
      assert.equal(targets.length,field.columns.length,field.id);
      assert.ok(targets.every(cell=>cell.paras.length&&cell.paras.every(p=>!p.text.trim())),field.id);
    }
  }
});
test('all answer fields survive HWP generation; reserved declaration pages stay unchanged',async()=>{
  const fields=applicationSteps.flatMap(s=>s.fields).filter(f=>!f.id.startsWith('16.'));
  const entries=fields.map(field=>({field,section:'QA',state:'answered',text:`VALUE_${field.id}`,value:field.options?{kind:'choice',values:[field.options[0].value]}:field.type==='table'?{kind:'table',rows:[Object.fromEntries(field.columns.map(c=>[c.id,'표값']))]}:{kind:'text',text:`VALUE_${field.id}`}}));
  const plan={entries,warnings:[],test:true,reviewed:false};
  const bytes=await createApplicationHwp(plan,template),cfb=CFB.read(bytes,{type:'buffer'});
  const body=records(inflateSync(new Uint8Array(CFB.find(cfb,'/BodyText/Section0').content)));
  const text=body.filter(r=>r.tag===67).map(r=>decode(r.data)).join('').replace(/[\r\n]/g,'');
  for(const entry of entries.filter(e=>e.value.kind==='text')) assert.ok(text.includes(entry.value.text),entry.field.id);
  assert.ok(!body.some(r=>r.tag===67&&r.level===1&&decode(r.data)==='\r'),'native Hancom rejects empty PARA_TEXT');
  const originalCells=cells(records(original)),updatedCells=cells(body);
  for(const page of [2,21,22]) {
    const pageText=cc=>cc.filter(c=>c.page===page).flatMap(c=>c.paras).map(p=>p.text).join('');
    assert.equal(pageText(updatedCells),pageText(originalCells),`reserved page ${page}`);
  }
});
