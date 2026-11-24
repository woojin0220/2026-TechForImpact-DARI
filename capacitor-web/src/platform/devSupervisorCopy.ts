const en = {
  enter: 'Enter as test Supervisor',
  hint: 'Development only · No email verification. Uses local sample community data.',
  active: 'Supervisor · Local test data',
  exit: 'Exit test account',
  profile: 'Test ID: {id}. This account is local to this tab and has no access to live community data. Sample member verification code: 123456.',
};
const copies: Record<string, typeof en> = {
  en,
  ko: {
    enter: 'Supervisor 테스트 계정으로 입장',
    hint: '개발용 · 이메일 인증 없이 로컬 샘플 커뮤니티를 이용해요.',
    active: 'Supervisor · 로컬 테스트 데이터',
    exit: '테스트 계정 나가기',
    profile: '테스트 ID: {id}. 이 탭에서만 사용하는 계정이며 실제 커뮤니티 데이터에 접근하지 않아요. 가상 회원 인증 코드: 123456.',
  },
  fr: {
    enter: 'Entrer avec le compte test Supervisor',
    hint: 'Développement uniquement · Sans vérification e-mail. Données communautaires de démonstration locales.',
    active: 'Supervisor · Données de test locales',
    exit: 'Quitter le compte test',
    profile: 'ID de test : {id}. Compte limité à cet onglet, sans accès aux données réelles. Code du membre fictif : 123456.',
  },
  ru: {
    enter: 'Войти в тестовый аккаунт Supervisor',
    hint: 'Только для разработки · Без подтверждения почты. Локальные демонстрационные данные.',
    active: 'Supervisor · Локальный тест',
    exit: 'Выйти из тестового аккаунта',
    profile: 'Тестовый ID: {id}. Аккаунт работает только в этой вкладке, без доступа к реальным данным. Код вымышленного участника: 123456.',
  },
  ar: {
    enter: 'الدخول بحساب Supervisor التجريبي',
    hint: 'للتطوير فقط · دون تحقق بالبريد. بيانات مجتمع تجريبية محلية.',
    active: 'Supervisor · بيانات اختبار محلية',
    exit: 'الخروج من الحساب التجريبي',
    profile: 'معرّف الاختبار: {id}. الحساب لهذه التبويبة فقط ولا يصل إلى البيانات الحقيقية. رمز العضو الافتراضي: 123456.',
  },
  fa: {
    enter: 'ورود با حساب آزمایشی Supervisor',
    hint: 'فقط برای توسعه · بدون تأیید ایمیل. داده‌های نمونه محلی انجمن.',
    active: 'Supervisor · داده‌های آزمایشی محلی',
    exit: 'خروج از حساب آزمایشی',
    profile: 'شناسه آزمایشی: {id}. حساب فقط در این زبانه است و به داده‌های واقعی دسترسی ندارد. کد عضو فرضی: 123456.',
  },
};
export const devSupervisorCopyFor = (language: string) => copies[language] ?? en;
