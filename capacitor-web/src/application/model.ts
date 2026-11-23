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
