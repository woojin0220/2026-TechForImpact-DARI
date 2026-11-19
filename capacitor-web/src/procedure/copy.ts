const en = {
  title: 'Application procedure',
  back: 'Back to application',
  loadError: 'The procedure guide could not be opened here.',
  openSeparately: 'Open the guide separately',
};

export type ProcedureCopy = typeof en;

export const procedureCopies: Record<string, ProcedureCopy> = {
  en,
  ko: {
    title: '신청 절차',
    back: '신청서로 돌아가기',
    loadError: '이 화면에서 절차 안내를 열지 못했습니다.',
    openSeparately: '절차 안내 따로 열기',
  },
  fr: {
    title: 'Procédure de demande',
    back: 'Retour à la demande',
    loadError: 'Le guide de la procédure n’a pas pu être ouvert ici.',
    openSeparately: 'Ouvrir le guide séparément',
  },
  ru: {
    title: 'Порядок подачи заявления',
    back: 'Вернуться к заявлению',
    loadError: 'Не удалось открыть руководство на этой странице.',
    openSeparately: 'Открыть руководство отдельно',
  },
  ar: {
    title: 'إجراءات تقديم الطلب',
    back: 'العودة إلى الطلب',
    loadError: 'تعذّر فتح دليل الإجراءات هنا.',
    openSeparately: 'فتح الدليل بشكل منفصل',
  },
  fa: {
    title: 'مراحل درخواست',
    back: 'بازگشت به درخواست',
    loadError: 'باز کردن راهنما در این صفحه ممکن نشد.',
    openSeparately: 'باز کردن جداگانه راهنما',
  },
};

export function procedureCopyFor(language: string): ProcedureCopy {
  return procedureCopies[language] ?? en;
}
