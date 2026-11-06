import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import * as CFB from 'cfb';
import {inflateSync} from 'fflate';
import {PDFDocument} from 'pdf-lib';
import {fullExportFixture,fullFixtureMetadata} from './export-full-fixture.mjs';
import {buildApplicationPlan} from '../src/export/plan.ts';
import {createApplicationHwp} from '../src/export/hwp.ts';
import {createApplicationPdf} from '../src/export/pdf.ts';
import {cells,records,view} from '../src/export/hwpBinary.ts';
import {hwpTableRows} from '../src/export/hwpTables.ts';
import {statementSlots,wrapStatement} from '../src/export/statement.ts';

test('full fictional metadata derives complete visible answers and centers HWP table data',async()=>{
  const session=fullExportFixture(),plan=buildApplicationPlan(session,true);
  plan.warnings.unshift('가상 사례로 전체 작성 완료 상태를 가정한 출력 예시입니다. 실제 신청이나 제출에 사용하지 마세요.');
  assert.equal(session.scope,'full');
  assert.equal(session.form['1.7'].text,'러시아');
  assert.equal(session.form['1.13'].text,'러시아어');
  assert.equal(session.form['1.2'].text,'SOKOLOV');
  assert.ok(!session.form['1.13-fluent'].values.includes('ko'));
  assert.ok(session.facts.length>100);
  assert.ok(session.draft.every(d=>d.factIds.length&&d.sourceIds.length));
  assert.deepEqual(plan.entries.filter(e=>e.state==='missing'||e.state==='review').map(e=>e.field.id),[]);
  assert.deepEqual(session.question14['14.2'].values,['yes']);
  assert.ok(session.question14['14.2-detail'].text.includes('실제 소속은 확인하지 못했습니다'));
  const template=await readFile(new URL('../public/forms/refugee-application-2019.hwp',import.meta.url));
  const hwp=await createApplicationHwp(plan,template);
  const cfb=CFB.read(hwp,{type:'buffer'});
  const rs=records(inflateSync(new Uint8Array(CFB.find(cfb,'/BodyText/Section0').content)));
  const all=cells(rs);
  const familySlot=hwpTableRows['4'][0];
  const family=all.filter(c=>c.page===familySlot.page&&c.row===familySlot.row);
  assert.equal(family.length,5);
  for(const cell of family){
    assert.equal((view(rs[cell.index].data).getUint32(4,true)>>5)&3,1,'vertical center');
    assert.equal(view(rs[cell.index].data).getUint16(0,true),1,'no spare blank paragraphs');
    assert.equal(cell.paras.length,1);
    assert.equal(cell.paras[0].y,0,'no cached top offset');
  }
  const statement=session.question14['15'].text;
  const lines=wrapStatement(statement,line=>[...line].reduce((n,ch)=>n+(ch.charCodeAt(0)>255?1:.6),0)<=43);
  assert.ok(lines.length>8&&lines.length<=30,'statement continues onto page 20');
  const filled=statementSlots.map(slot=>all.find(c=>c.page===slot.page&&c.row===slot.row));
  lines.forEach((line,i)=>{
    assert.equal(filled[i].paras.map(p=>p.text).join('').replace(/\r/g,''),line);
    if(line){
      assert.equal((view(rs[filled[i].index].data).getUint32(4,true)>>5)&3,2,'statement baseline aligned to the rule');
      assert.equal(view(rs[filled[i].index].data).getUint16(30,true),200);
    }
  });
  assert.equal(wrapStatement(statement,()=>true).join('\n'),statement);
  const metadata=JSON.parse(fullFixtureMetadata(session));
  assert.equal(metadata.demoOnly,true);
  assert.equal(metadata.metadata.facts.length,session.facts.length);
  const pdf=await createApplicationPdf({...plan,test:true},{
    template:await readFile(new URL('../public/forms/refugee-application-2019.pdf',import.meta.url)),
    font:await readFile(new URL('../public/fonts/NanumGothic-Regular.ttf',import.meta.url)),
  });
  assert.equal((await PDFDocument.load(pdf)).getPageCount(),24,'short one-line fields stay on the original sheets');
  if(process.env.DARI_FULL_EXPORT_DIR){
    const dir=process.env.DARI_FULL_EXPORT_DIR;await mkdir(dir,{recursive:true});
    await writeFile(join(dir,'DARI-Aleksei-Sokolov.hwp'),hwp);
    await writeFile(join(dir,'DARI-Aleksei-Sokolov.pdf'),pdf);
    await writeFile(join(dir,'DARI-Aleksei-Sokolov-metadata.json'),fullFixtureMetadata(session));
  }
});
