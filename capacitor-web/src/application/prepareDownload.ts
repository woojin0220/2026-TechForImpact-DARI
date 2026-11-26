import { isCurrent,isReviewed,writtenAnswers,type Answers } from './model.ts';
export function pendingReviews(answers:Answers){
 return writtenAnswers(answers).filter(({question,answer})=>!isReviewed(answer,question.id)).map(({question,answer})=>({id:question.id,reason:(isCurrent(answer,question.id)?'review':'translation') as 'review'|'translation'}));
}
/** Download never translates or silently acknowledges an answer. */
export async function prepareDownload(answers:Answers):Promise<Answers>{
 if(pendingReviews(answers).length)throw new Error('REVIEW_REQUIRED');
 return structuredClone(answers);
}
