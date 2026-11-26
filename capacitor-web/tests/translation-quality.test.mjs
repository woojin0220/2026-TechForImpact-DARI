import test from 'node:test';
import assert from 'node:assert/strict';
import { translationProblem, preserveOriginal } from '../src/application/translationQuality.ts';
import { isCurrent,reviewVersion } from '../src/application/model.ts';
import { prepareDownload } from '../src/application/prepareDownload.ts';

const saved = (source,korean=source,language='ru')=>({source,korean,language,translatedSource:source});
test('copied or mostly Russian answers are not complete, including preexisting saved results',()=>{
 const source='Не применимо: паспорт находится у меня.';
 assert.equal(translationProblem(source,'ru',source),'UNTRANSLATED_ANSWER');
 assert.equal(translationProblem(source,'ru','...'),'UNTRANSLATED_ANSWER');
 assert.equal(isCurrent(saved(source),'9.8'),false);
 assert.equal(translationProblem(source,'ru','해당 없음. Паспорт находится у меня.'),'UNTRANSLATED_ANSWER');
});
test('preserved names and identifiers still require explicit review before download',async()=>{
 const values={'1.2':'ПРИМЕРОВ','1.3':'АЛЕКСЕЙ УЧЕБНЫЙ','9.3':'2024/01/10','10.3':'C-3','11.6':'demo-applicant@example.invalid'};
 const answers=Object.fromEntries(Object.entries(values).map(([id,text])=>{assert.ok(preserveOriginal(text,id));const a=saved(text);a.reviewed=reviewVersion(a);return [id,a];}));
 const ready=await prepareDownload(answers);for(const [id,text]of Object.entries(values))assert.equal(ready[id].korean,text);
 assert.equal(preserveOriginal('Не исповедую религию.','1.11'),false);
});

test('valid Korean can retain foreign names, acronyms and uncertainty',()=>{
 assert.equal(translationProblem('Мать: Елена Примерова.','ru','어머니는 Елена Примерова입니다.'),null);
 assert.equal(translationProblem('Мать: Елена Ивановна Примерова.','ru','어머니는 Елена Ивановна Примерова입니다.'),null);
 assert.equal(translationProblem('Я не знаю, были ли они сотрудниками полиции.','ru','그들이 경찰관이었는지는 모릅니다.'),null);
 assert.equal(translationProblem('UNHCR','en','유엔난민기구(UNHCR)'),null);
});
test('cached untranslated sentences block download instead of automatically retrying a model',async()=>{
 const source='Не применимо: паспорт находится у меня.';let calls=0;const a=saved(source);a.reviewed=reviewVersion(a);
 await assert.rejects(prepareDownload({'9.8':a},()=>{calls++}),/REVIEW_REQUIRED/);assert.equal(calls,0);assert.equal(a.korean,source);
});
