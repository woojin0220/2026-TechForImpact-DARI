import type { Answers, FieldAnswer } from '../types';
import { applicationSteps, type FormField } from './schema';

const NOT_APPLICABLE = 'не применимо';
const TEST_DATE = '2025/03/15';

const narratives: Record<string, string> = {
  '14.1-detail': 'Это вымышленный пример для проверки приложения. После участия в мирной акции меня несколько раз вызывали на допрос. Я опасаюсь возвращения, потому что мне угрожали последствиями за общение с журналистами.',
  '14.2-detail': 'В марте 2025 года двое сотрудников полиции пришли ко мне домой, забрали телефон и отвезли в отделение. Меня допрашивали около шести часов и требовали назвать участников акции. Меня не били, но один сотрудник сказал, что в следующий раз последствия будут хуже.',
  '14.3-detail': 'Я боюсь, что при возвращении меня снова задержат из-за моего участия в мирной акции и общения с журналистами.',
  '14.4-detail': 'После моего отъезда сотрудники полиции один раз приходили к моему брату и спрашивали, где я нахожусь.',
  '14.5-yes': 'Я обратился в местное отделение полиции в марте 2025 года, но заявление не приняли и сказали, что не могут помочь.',
  '14.6-yes': 'В апреле 2025 года я временно жил у родственника в другом городе. Я уехал оттуда, потому что получил сообщение о том, что меня продолжают искать.',
  '14.9-detail': 'Я участвовал только в мирной акции и не призывал к насилию. Этот пример создан исключительно для проверки перевода.',
  '14.17': 'В июне 2025 года в Сеуле сотрудник общественной организации рассказал мне о процедуре подачи заявления на признание беженцем.',
  '15': 'Это вымышленная тестовая история. Она не является заявлением реального человека и не должна использоваться для подачи документов.',
};

function preferredChoice(field: FormField): FieldAnswer {
  const options = field.options ?? [];
  if (field.type === 'multi') {
    if (field.id === '14.1') return { kind: 'choice', values: ['political'] };
    return { kind: 'choice', values: options.length ? [options[0].value] : [] };
  }
  const preferred = options.find((option) => option.value === 'yes')
    ?? options.find((option) => option.value === 'confirmed')
    ?? options.find((option) => option.value === 'married')
    ?? options[0];
  return { kind: 'choice', values: preferred ? [preferred.value] : [] };
}

function demoAnswer(field: FormField): FieldAnswer {
  if (field.type === 'single' || field.type === 'multi') return preferredChoice(field);
  if (field.type === 'table') {
    return {
      kind: 'table',
      rows: [{ ...(field.columns ?? []).reduce<Record<string, string>>((row, column) => {
        row[column.id] = column.kind === 'date' ? TEST_DATE : NOT_APPLICABLE;
        return row;
      }, {}) }],
    };
  }
  if (field.type === 'date') return { kind: 'text', text: TEST_DATE };
  return { kind: 'text', text: narratives[field.id] ?? NOT_APPLICABLE };
}

/** A clearly fictional Russian scenario for exercising the whole MVP flow. */
export function createRussianDemoAnswers(): Answers {
  const answers: Answers = {};
  for (const step of applicationSteps) {
    for (const field of step.fields) answers[field.id] = demoAnswer(field);
  }
  return answers;
}

export const demoScenarioNotice = '가상 러시아어 사례입니다. 실제 인적사항·진술·증빙으로 사용하면 안 됩니다.';
