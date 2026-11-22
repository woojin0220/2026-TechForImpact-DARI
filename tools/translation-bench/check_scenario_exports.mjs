/** In-memory export integration check; no document artifacts are delivered. */
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {applicationDocx} from '../../capacitor-web/src/application/docx.ts';
const require=createRequire(new URL('../../capacitor-web/package.json',import.meta.url));
const {unzipSync,strFromU8}=require('fflate');
const directory=process.argv[2];
if(!directory)throw Error('Pass the completed scenario result directory');
const rows=readFileSync(`${directory}/observations.jsonl`,'utf8').trim().split('\n').map(JSON.parse);
const latest=Math.max(...rows.map(r=>r.round));
const template=new Uint8Array(readFileSync(new URL('../../capacitor-web/public/forms/refugee-application-2019-word.docx',import.meta.url)));
const normalize=s=>s.replace(/\s+/g,'');
const escape=s=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const scenarios=[...new Set(rows.map(r=>r.scenario))];let answersChecked=0;
for(const scenario of scenarios){
 const items=rows.filter(r=>r.round===latest&&r.scenario===scenario);
 assert.equal(items.length,8,scenario);
 assert.ok(items.every(r=>!r.error),`${scenario}: a failed answer must not be exported`);
 const answers=Object.fromEntries(items.map(r=>[r.question_id,{source:r.source,language:'ru',korean:r.translation,translatedSource:r.source}]));
 const files=unzipSync(applicationDocx(answers,template));
 const xml=strFromU8(files['word/document.xml']);
 const allText=normalize([...xml.matchAll(/<w:t(?:\s[^>]*)?>(.*?)<\/w:t>/gs)].map(m=>m[1]).join(''));
 for(const item of items){assert.ok(allText.includes(normalize(escape(item.translation))),`${scenario}/${item.question_id}: missing answer`);answersChecked++;}
 for(let page=1;page<=22;page++)assert.ok(files[`word/media/page-${page}.jpg`],`${scenario}: original page ${page}`);
}
console.log(JSON.stringify({scenarios:scenarios.length,answersChecked,round:latest,originalPagesPerExport:22,note:'Structure and text retention only; no claim of visual or semantic correctness.'}));
