export type LanguageOption = {
  code: string;
  label: string;
  answerLabel: string;
  notApplicable: string;
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
  verify: boolean;
};

export type ChoiceAnswer = { kind: 'choice'; values: string[] };
export type TextAnswer = { kind: 'text'; text: string };
export type TableAnswer = { kind: 'table'; rows: Record<string, string>[] };
export type FieldAnswer = ChoiceAnswer | TextAnswer | TableAnswer;
export type Answers = Record<string, FieldAnswer>;

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
