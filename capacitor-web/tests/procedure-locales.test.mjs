import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const languages=['ko','en','fr','ru','ar','fa'];
const catalog=Object.fromEntries(languages.map(lang=>[lang,JSON.parse(fs.readFileSync(new URL('../src/procedure/locales/'+lang+'.json',import.meta.url),'utf8'))]));
test('every supported procedure language has a complete nonempty catalog',()=>{
 const keys=Object.keys(catalog.ko).sort();
 for(const lang of languages){assert.deepEqual(Object.keys(catalog[lang]).sort(),keys,lang);for(const key of keys)assert.ok(typeof catalog[lang][key]==='string'&&catalog[lang][key].trim(),lang+'/'+key);}
});
test('translated HTML fragments preserve controls and attributes',()=>{
 const tags=s=>s.match(/<[^>]*>/g)||[];
 for(const [key,source] of Object.entries(catalog.ko))if(source.includes('<'))for(const lang of languages)assert.deepEqual(tags(catalog[lang][key]),tags(source),lang+'/'+key);
});
test('non-Korean procedure catalogs do not fall back to Korean text',()=>{
 for(const lang of languages.filter(x=>x!=='ko'))for(const [key,value] of Object.entries(catalog[lang]))assert.ok(!/[가-힣]/.test(value),lang+'/'+key);
});
