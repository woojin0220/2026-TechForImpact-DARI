export type ApplicationQuestion = {
  number: string;
  korean: string;
  prompt: string;
};

export type LanguageOption = {
  code: string;
  label: string;
  answerLabel: string;
  questions: ApplicationQuestion[];
};

export type VerificationModel = {
  name: string;
  model: string;
  detail: string;
};

export type DraftEntry = {
  questionNumber: string;
  questionKorean: string;
  source: string;
  english: string;
  korean: string;
};

export type DistortionItem = {
  type: string;
  direction: string;
  severity: string;
  questionNumber?: string;
  sourceExcerpt: string;
  translationExcerpt: string;
  explanation: string;
};

export type VerificationReport = {
  summary: string;
  hasDistortion: boolean;
  items: DistortionItem[];
  limitations?: string[];
};
