import { isCurrent, writtenAnswers, type Answers, type TranslationLanguage } from './model.ts';
import { preserveOriginal, requireTranslation } from './translationQuality.ts';

/** Keep completed edits; save each new translation so a retry resumes unfinished work. */
export async function prepareDownload(answers: Answers, translate: (text: string, language: string, questionId?: string,target?:TranslationLanguage) => Promise<string>,
 onUpdate: (answers: Answers) => void, onProgress: (done: number, total: number) => void): Promise<Answers> {
 let ready: Answers = Object.fromEntries(Object.entries(answers).map(([id,a])=>[id,{...a}]));
 const pending=writtenAnswers(ready).filter(({question,answer})=>!isCurrent(answer,question.id));
 onProgress(0,pending.length);
 for(const [index,{question,answer}] of pending.entries()) {
  const target=answer.targetLanguage??'ko';
  const korean=answer.language===target || preserveOriginal(answer.source,question.id) ? answer.source : await translate(answer.source,answer.language,question.id,target);
  requireTranslation(answer.source,answer.language,korean,question.id,target);
  ready={...ready,[question.id]:{...answer,korean,translatedSource:answer.source,translatedTarget:target,translatedLanguage:answer.language}};
  onUpdate(ready); onProgress(index+1,pending.length);
 }
 return ready;
}
