import type { VerificationReport } from '../types';

type DemoStatement = {
  source: string;
  english: string;
  korean: string;
};

const demoStatements: Record<string, Record<string, DemoStatement>> = {
  ru: {
    '14.1': {
      source: 'Я покинул свою страну после неоднократных угроз. Я боюсь возвращаться, потому что люди, которые угрожали мне, всё ещё находятся там.',
      english: 'I left my country after repeated threats. I am afraid to return because the people who threatened me are still there.',
      korean: '저는 반복적인 위협을 받은 뒤 본국을 떠났습니다. 저를 위협했던 사람들이 아직 그곳에 있기 때문에 돌아가는 것이 두렵습니다.',
    },
    '14.2': {
      source: 'Зимой 2021 года возле моего дома мне угрожали примерно три раза. Я не помню точных дат и не видел оружия.',
      english: 'In the winter of 2021, I was threatened five times near my home. I do not remember the exact dates, and I saw a weapon.',
      korean: '2021년 겨울, 저는 집 근처에서 다섯 차례 위협을 받았습니다. 정확한 날짜는 기억나지 않으며 무기를 보았습니다.',
    },
  },
  ar: {
    '14.1': {
      source: 'غادرت بلدي بعد تعرضي لتهديدات متكررة. أخشى العودة لأن الأشخاص الذين هددوني ما زالوا هناك.',
      english: 'I left my country after repeated threats. I am afraid to return because the people who threatened me are still there.',
      korean: '저는 반복적인 위협을 받은 뒤 본국을 떠났습니다. 저를 위협했던 사람들이 아직 그곳에 있기 때문에 돌아가는 것이 두렵습니다.',
    },
    '14.2': {
      source: 'في شتاء عام 2021 تعرضت للتهديد قرب منزلي نحو ثلاث مرات. لا أتذكر التواريخ الدقيقة ولم أر سلاحاً.',
      english: 'In the winter of 2021, I was threatened five times near my home. I do not remember the exact dates, and I saw a weapon.',
      korean: '2021년 겨울, 저는 집 근처에서 다섯 차례 위협을 받았습니다. 정확한 날짜는 기억나지 않으며 무기를 보았습니다.',
    },
  },
  fr: {
    '14.1': {
      source: 'J’ai quitté mon pays après avoir reçu des menaces répétées. J’ai peur d’y retourner parce que les personnes qui m’ont menacé s’y trouvent encore.',
      english: 'I left my country after repeated threats. I am afraid to return because the people who threatened me are still there.',
      korean: '저는 반복적인 위협을 받은 뒤 본국을 떠났습니다. 저를 위협했던 사람들이 아직 그곳에 있기 때문에 돌아가는 것이 두렵습니다.',
    },
    '14.2': {
      source: 'Pendant l’hiver 2021, j’ai été menacé près de chez moi environ trois fois. Je ne me souviens pas des dates exactes et je n’ai pas vu d’arme.',
      english: 'In the winter of 2021, I was threatened five times near my home. I do not remember the exact dates, and I saw a weapon.',
      korean: '2021년 겨울, 저는 집 근처에서 다섯 차례 위협을 받았습니다. 정확한 날짜는 기억나지 않으며 무기를 보았습니다.',
    },
  },
  fa: {
    '14.1': {
      source: 'پس از تهدیدهای مکرر کشورم را ترک کردم. از بازگشت می‌ترسم، زیرا افرادی که مرا تهدید کردند هنوز آنجا هستند.',
      english: 'I left my country after repeated threats. I am afraid to return because the people who threatened me are still there.',
      korean: '저는 반복적인 위협을 받은 뒤 본국을 떠났습니다. 저를 위협했던 사람들이 아직 그곳에 있기 때문에 돌아가는 것이 두렵습니다.',
    },
    '14.2': {
      source: 'در زمستان سال ۲۰۲۱ حدود سه بار نزدیک خانه‌ام تهدید شدم. تاریخ‌های دقیق را به یاد ندارم و سلاحی ندیدم.',
      english: 'In the winter of 2021, I was threatened five times near my home. I do not remember the exact dates, and I saw a weapon.',
      korean: '2021년 겨울, 저는 집 근처에서 다섯 차례 위협을 받았습니다. 정확한 날짜는 기억나지 않으며 무기를 보았습니다.',
    },
  },
};

export function getDemoStatement(language: string, questionNumber: string) {
  return demoStatements[language]?.[questionNumber] ?? demoStatements.ru['14.1'];
}

export function translateDemoText(text: string, targetLanguage: string) {
  for (const questions of Object.values(demoStatements)) {
    for (const statement of Object.values(questions)) {
      if (text.trim() === statement.source.trim() && targetLanguage === 'en') return statement.english;
      if (text.trim() === statement.english.trim() && targetLanguage === 'ko') return statement.korean;
    }
  }
  throw new Error('온라인 데모에서는 제공된 가상 사례만 번역할 수 있습니다. “가상 사례 불러오기”를 사용해 주세요.');
}

export const demoVerificationReport: VerificationReport = {
  hasDistortion: true,
  summary: '가상 사례의 14.2 번역에서 횟수와 무기 관련 의미가 달라진 것을 발견했습니다. 아래 항목을 원문 작성자에게 다시 확인해야 합니다.',
  items: [
    {
      type: '횟수 변경',
      direction: '유리하게 강화',
      severity: '높음',
      questionNumber: '14.2',
      sourceExcerpt: '약 세 번',
      translationExcerpt: 'five times',
      explanation: '원문의 대략적인 세 차례가 다섯 차례로 바뀌어 사건의 반복성이 강화되었습니다.',
    },
    {
      type: '부정 반전',
      direction: '유리하게 강화',
      severity: '높음',
      questionNumber: '14.2',
      sourceExcerpt: '무기를 보지 못했다',
      translationExcerpt: 'I saw a weapon',
      explanation: '무기를 보지 않았다는 진술이 무기를 보았다는 의미로 반전되었습니다.',
    },
  ],
  limitations: [
    '이 결과는 기능 설명을 위해 미리 작성된 가상 사례입니다.',
    '실제 번역 품질이나 난민 인정 가능성을 판단하지 않습니다.',
  ],
};
