export type AppTab = 'application' | 'scheduler' | 'community';
export const appTabs: AppTab[] = ['application', 'scheduler', 'community'];

const en = {
  navigation: 'Main menu',
  application: 'Application',
  scheduler: 'Schedule',
  community: 'Community',
  schedulerTitle: 'Schedule',
  communityTitle: 'Community',
  comingSoon: 'This feature is being prepared. Your application work is kept while you visit this tab.',
  backToApplication: 'Back to application',
};

export type TabsCopy = typeof en;

export const tabsCopies: Record<string, TabsCopy> = {
  en,
  ko: {
    navigation: '주 메뉴',
    application: '신청서',
    scheduler: '스케줄러',
    community: '커뮤니티',
    schedulerTitle: '스케줄러',
    communityTitle: '커뮤니티',
    comingSoon: '준비 중인 기능이에요. 이 탭을 보는 동안에도 작성 중인 신청서는 그대로 유지돼요.',
    backToApplication: '신청서로 돌아가기',
  },
  fr: {
    navigation: 'Menu principal',
    application: 'Demande',
    scheduler: 'Agenda',
    community: 'Communauté',
    schedulerTitle: 'Agenda',
    communityTitle: 'Communauté',
    comingSoon: 'Cette fonction est en préparation. Votre demande en cours est conservée pendant que vous consultez cet onglet.',
    backToApplication: 'Retour à la demande',
  },
  ru: {
    navigation: 'Главное меню',
    application: 'Заявление',
    scheduler: 'Расписание',
    community: 'Сообщество',
    schedulerTitle: 'Расписание',
    communityTitle: 'Сообщество',
    comingSoon: 'Эта функция готовится. Ваше заявление сохраняется, пока вы открываете эту вкладку.',
    backToApplication: 'Вернуться к заявлению',
  },
  ar: {
    navigation: 'القائمة الرئيسية',
    application: 'الطلب',
    scheduler: 'المواعيد',
    community: 'المجتمع',
    schedulerTitle: 'المواعيد',
    communityTitle: 'المجتمع',
    comingSoon: 'هذه الميزة قيد الإعداد. يبقى طلبك الحالي محفوظًا أثناء تصفحك لهذا القسم.',
    backToApplication: 'العودة إلى الطلب',
  },
  fa: {
    navigation: 'منوی اصلی',
    application: 'درخواست',
    scheduler: 'برنامه‌ها',
    community: 'انجمن',
    schedulerTitle: 'برنامه‌ها',
    communityTitle: 'انجمن',
    comingSoon: 'این بخش در حال آماده‌سازی است. درخواست در حال نوشتن شما هنگام دیدن این بخش حفظ می‌شود.',
    backToApplication: 'بازگشت به درخواست',
  },
};

export function tabsCopyFor(language: string): TabsCopy {
  return tabsCopies[language] ?? tabsCopies.en;
}

const TAB_KEY = 'dari.activeTab.v1';

/** Reads the last tab in this browser tab; anything unexpected falls back to the application. */
export function readActiveTab(storage: Pick<Storage, 'getItem'> | undefined = globalThis.sessionStorage): AppTab {
  try {
    const value = storage?.getItem(TAB_KEY);
    return appTabs.includes(value as AppTab) ? value as AppTab : 'application';
  } catch { return 'application'; }
}

export function writeActiveTab(tab: AppTab, storage: Pick<Storage, 'setItem'> | undefined = globalThis.sessionStorage) {
  try { storage?.setItem(TAB_KEY, tab); } catch { /* Tab memory is a convenience only. */ }
}
