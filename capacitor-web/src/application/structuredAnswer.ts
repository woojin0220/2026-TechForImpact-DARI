import { localizedLabel } from '../form/localize.ts';
import type { Question } from './model.ts';
import type { FormField } from '../form/schema.ts';

export type FieldValue=string|string[]|Record<string,string>[];
export type FieldValues=Record<string,FieldValue>;
export function parseFieldValues(question:Question,input:unknown):FieldValues|undefined {
 if(!input||typeof input!=='object'||Array.isArray(input))return;
 const entries=Object.entries(input);
 for(const [id,value] of entries){
  const field=question.fields.find(f=>f.id===id);if(!field)return;
  if(field.type==='table'){
   if(!Array.isArray(value)||!value.every(row=>row&&typeof row==='object'&&!Array.isArray(row)&&Object.entries(row).every(([key,cell])=>field.columns?.some(c=>c.id===key)&&typeof cell==='string')))return;
  }else if(field.type==='multi'){
   if(!Array.isArray(value)||!value.every(v=>typeof v==='string'))return;
  }else if(typeof value!=='string')return;
 }
 return input as FieldValues;
}
export function visibleField(field:FormField,values:FieldValues) {
 return !field.when?.length||field.when.every(rule=>{
  const value=values[rule.id];
  return rule.anyOf.some(option=>typeof value==='string'?value===option:Array.isArray(value)&&value.includes(option as never));
 });
}
/** Serialize only answered, visible fields. Blank rows and hidden branches never become testimony. */
export function serializeFields(question:Question,values:FieldValues,language:string):string {
 const label=(ko:string,en:string)=>localizedLabel(language,ko,en);
 return question.fields.filter(f=>visibleField(f,values)).flatMap(field=>{
  const value=values[field.id];if(!value)return [];
  const title=label(field.ko,field.en);
  if(field.type==='table'&&Array.isArray(value)){
   const rows=(value as Record<string,string>[]).filter(row=>field.columns?.some(c=>row[c.id]?.trim()));
   return rows.length?[rows.map((row,i)=>`${i+1}. ${field.columns?.filter(c=>row[c.id]?.trim()).map(c=>`${label(c.ko,c.en)}: ${row[c.id]}`).join('\n')}`).join('\n\n')]:[];
  }
  const selected=(Array.isArray(value)?value:[value]) as string[];
  const text=selected.map(v=>{const o=field.options?.find(o=>o.value===v);return o?label(o.ko,o.en):v;}).filter(v=>v.trim()).join(', ');
  return text?[question.fields.length===1||field.options||field.type==='long'?text:`${title}\n${text}`]:[];
 }).join('\n\n');
}
