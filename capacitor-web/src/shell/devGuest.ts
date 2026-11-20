/** A local development convenience; never creates a session or changes API permissions. */
export const DEV_GUEST_KEY = 'dari:dev:guest';

export function canUseDevGuest(development: boolean, status: string) {
  return development && status === 'signedOut';
}

export function readDevGuest(development: boolean) {
  if (!development) return false;
  try { return sessionStorage.getItem(DEV_GUEST_KEY) === '1'; } catch { return false; }
}

export function writeDevGuest(enabled: boolean) {
  try {
    if (enabled) sessionStorage.setItem(DEV_GUEST_KEY, '1');
    else sessionStorage.removeItem(DEV_GUEST_KEY);
  } catch { /* Private browsing can disable storage; the in-memory choice still works. */ }
}

const en = {
  enter: 'Test without signing in',
  hint: 'Development only. Try the application and scheduler. The community still requires sign-in.',
  active: 'Test mode · Not signed in',
  exit: 'Back to sign-in',
};
const copies: Record<string, typeof en> = {
  en,
  ko: {
    enter: '로그인 없이 테스트하기',
    hint: '개발용 · 신청서와 스케줄러를 확인할 수 있어요. 커뮤니티는 로그인이 필요해요.',
    active: '테스트 모드 · 로그인하지 않은 상태',
    exit: '로그인으로 돌아가기',
  },
  fr: {
    enter: 'Tester sans se connecter',
    hint: 'Développement uniquement. Essayez le formulaire et le calendrier. La communauté nécessite une connexion.',
    active: 'Mode test · Non connecté',
    exit: 'Revenir à la connexion',
  },
  ru: {
    enter: 'Тестировать без входа',
    hint: 'Только для разработки. Доступны заявление и планировщик. Для сообщества нужен вход.',
    active: 'Тестовый режим · Вход не выполнен',
    exit: 'Вернуться ко входу',
  },
  ar: {
    enter: 'التجربة دون تسجيل الدخول',
    hint: 'للتطوير فقط. يمكنك تجربة الطلب والجدول. يتطلب المجتمع تسجيل الدخول.',
    active: 'وضع الاختبار · لم يتم تسجيل الدخول',
    exit: 'العودة إلى تسجيل الدخول',
  },
  fa: {
    enter: 'آزمایش بدون ورود',
    hint: 'فقط برای توسعه. فرم درخواست و برنامه‌ریز را امتحان کنید. انجمن به ورود نیاز دارد.',
    active: 'حالت آزمایشی · وارد نشده‌اید',
    exit: 'بازگشت به ورود',
  },
};

export function devGuestCopyFor(language: string) {
  return copies[language] ?? en;
}
