import { applicationSteps } from '../form/schema.ts';
import { translationProblem } from './translationQuality.ts';

/** Suffix fields belong to the same printed question (e.g. 14.1-detail). */
export const questions = Array.from(new Set(applicationSteps.flatMap(s => s.fields.map(f => f.id.split('-')[0])))).map(id => {
  const steps = applicationSteps.filter(s => s.fields.some(f => f.id.split('-')[0] === id));
  return { id, sectionKo: steps[0].sectionKo, sectionEn: steps[0].sectionEn,
    fields: steps.flatMap(s => s.fields.filter(f => f.id.split('-')[0] === id)) };
});
/** The landing list follows the large printed section numbers. */
export const questionGroups = Array.from(new Set(questions.map(q => q.id.split('.')[0]))).map(id => {
  const items = questions.filter(q => q.id.split('.')[0] === id);
  return { id, ko: items[0].sectionKo, en: items[0].sectionEn, questions: items };
});
/** Keep each printed question together even when its details span form steps. */
export function sectionsForGroup(groupId: string) {
 const bundles: Record<string,[string,string,string,number,number][]>={
  '7':[['service','복무 여부와 기간','Service and dates',1,4],['unit','소속과 전역','Unit and discharge',5,9]],
  '9':[['document','여권 소지와 발급','Passport and issue details',1,4],['acquisition','여권 취득 경위','How the passport was obtained',5,7],['missing','여권이 없는 경우','If you do not have a passport',8,11]],
  '10':[['visa','사증 발급','Visa details',1,6],['arrival','입국 경위','Arrival in Korea',7,11],['passport-identity','여권상 인적사항','Identity on your passport',12,15]],
  '12':[['departure','본국 출국','Leaving your home country',1,4],['permission','출국 허가','Permission to leave',5,8],['other-travel','다른 나라 방문과 처분','Other travel and immigration decisions',9,10]],
  '14':[['grounds','신청 사유와 피해','Reasons, harm and fear',1,3],['protection','가족의 피해와 보호 요청','Family harm and seeking protection',4,6],['activities','출국과 활동 이력','Departure and activities',7,10],['family-claims','다른 신청 이력과 가족','Other applications and family',11,15],['evidence','증거와 신청 경위','Evidence and application history',16,18]],
 };
 if(bundles[groupId])return bundles[groupId].map(([key,ko,en,from,to])=>({id:`${groupId}-${key}`,ko,en,questions:questions.filter(q=>q.id.split('.')[0]===groupId && Number(q.id.split('.')[1])>=from && Number(q.id.split('.')[1])<=to)}));
 const seen=new Set<string>();
 return applicationSteps.flatMap(step=>{
  const items=questions.filter(q=>q.id.split('.')[0]===groupId && !seen.has(q.id) && step.fields.some(f=>f.id.split('-')[0]===q.id));
  items.forEach(q=>seen.add(q.id));
  return items.length ? [{id:step.id,ko:step.titleKo,en:step.titleEn,questions:items}] : [];
 });
}
export const supportsConversation = (question: Question) => (question.id.startsWith('14.') || question.id==='15') && question.fields.some(f=>f.type==='long');
export type Question = typeof questions[number];
export const isQuickQuestion = (question: Question) => question.fields.every(f => f.type !== 'long' && f.type !== 'table');
export type Answer = { source: string; language: string; korean: string; translatedSource: string };
export type Answers = Record<string, Answer>;
export const isCurrent = (answer: Answer, questionId?: string) => !!answer.source.trim() && answer.source === answer.translatedSource && !translationProblem(answer.source, answer.language, answer.korean, questionId);
export function writtenAnswers(answers: Answers) {
  return questions.flatMap(question => answers[question.id]?.source.trim() ? [{ question, answer: answers[question.id] }] : []);
}
export const ANSWERS_KEY = 'dari.question-translations.v1';
export function loadAnswers(key = ANSWERS_KEY): { language: string; answers: Answers; problem?: boolean } {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return { language: '', answers: {} };
    const saved = JSON.parse(raw);
    if (!saved || !['ko','en','fr','ru','ar','fa'].includes(saved.language) || typeof saved.answers !== 'object' || !saved.answers) throw Error();
    const answers: Answers = {};
    for (const q of questions) {
      const a = saved.answers[q.id];
      if (a && ['source','language','korean','translatedSource'].every(k => typeof a[k] === 'string')) answers[q.id] = a;
    }
    return { language: saved.language, answers };
  } catch { return { language: '', answers: {}, problem: true }; }
}
export function saveAnswers(language: string, answers: Answers, key = ANSWERS_KEY) {
  try { sessionStorage.setItem(key, JSON.stringify({ language, answers })); return true; } catch { return false; }
}
