const en = { search: 'Search posts', placeholder: 'Search titles and original text', submit: 'Search', clear: 'Clear search', latest: 'Latest', unanswered: 'No replies', noResults: 'No matching posts.', reset: 'Reset filters', moreFailed: 'Could not load more posts.', results: 'Results', notice: 'Organization notice' };
type Copy = typeof en;
const copies:Record<string,Copy> = {
 en,
 ko: { search:'게시글 검색',placeholder:'제목·본문 원문 검색',submit:'검색',clear:'검색 지우기',latest:'최신 글',unanswered:'답변 없는 질문',noResults:'조건에 맞는 글이 없어요.',reset:'검색·필터 초기화',moreFailed:'다음 글을 불러오지 못했어요.',results:'검색 결과',notice:'기관 공지' },
 fr: { search:'Rechercher',placeholder:'Titre et texte original',submit:'Rechercher',clear:'Effacer la recherche',latest:'Récents',unanswered:'Sans réponse',noResults:'Aucun résultat.',reset:'Réinitialiser les filtres',moreFailed:'Impossible de charger la suite.',results:'Résultats',notice:'Annonce d’organisme' },
 ru: { search:'Поиск публикаций',placeholder:'Поиск по заголовку и оригиналу',submit:'Найти',clear:'Очистить поиск',latest:'Новые',unanswered:'Без ответов',noResults:'Ничего не найдено.',reset:'Сбросить фильтры',moreFailed:'Не удалось загрузить ещё.',results:'Результаты',notice:'Объявление организации' },
 ar: { search:'البحث في المنشورات',placeholder:'البحث في العنوان والنص الأصلي',submit:'بحث',clear:'مسح البحث',latest:'الأحدث',unanswered:'بلا ردود',noResults:'لا توجد نتائج مطابقة.',reset:'إعادة ضبط البحث والتصفية',moreFailed:'تعذر تحميل المزيد.',results:'نتائج البحث',notice:'إعلان منظمة' },
 fa: { search:'جستجوی نوشته‌ها',placeholder:'جستجو در عنوان و متن اصلی',submit:'جستجو',clear:'پاک کردن جستجو',latest:'تازه‌ترین',unanswered:'بدون پاسخ',noResults:'نتیجه‌ای یافت نشد.',reset:'پاک کردن فیلترها',moreFailed:'بارگیری بیشتر ناموفق بود.',results:'نتایج جستجو',notice:'اطلاعیه سازمان' },
};
export const discoveryCopy = (language:string) => copies[language] ?? en;
