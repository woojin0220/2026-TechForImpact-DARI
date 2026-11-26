/* DARI local calendar; stored on this device, without a server or SMS. */
(function () {
  'use strict';
  var root = document.getElementById('dari-calendar-root');
  if (!root || root.dataset.dariCalendarReady) return;
  root.dataset.dariCalendarReady = 'true';
  // The host guide delegates actions on document; calendar controls own their actions.
  root.addEventListener('click', function (event) { event.stopPropagation(); });
  var STORAGE_KEY = window.DariProcedureScope.key('dari.scheduler.calendar.v1');
  var VIEW_KEY = window.DariProcedureScope.key('dari.scheduler.calendar.view.v1');
  var DEFAULT_ZONE = 'Asia/Seoul';
  var ZONES = [
    ['Asia/Seoul', 'kr'], ['Asia/Tokyo', 'jp'], ['America/New_York', 'usEast'],
    ['America/Los_Angeles', 'usWest'], ['Europe/London', 'uk'], ['Europe/Paris', 'fr'],
    ['Europe/Berlin', 'de'], ['Europe/Moscow', 'ru'], ['Asia/Dubai', 'ae'],
    ['Asia/Tehran', 'ir'], ['Asia/Riyadh', 'sa'], ['Australia/Sydney', 'au'], ['UTC', 'utc']
  ];
  var TEXT = {
    ko: {
      title:'나의 일정', eyebrow:'CALENDAR', description:'지원 준비와 생활에 필요한 일정을 등록하세요. 선택한 국가·도시의 시간을 기준으로 표시합니다.',
      reference:'기준 국가·도시', currentTime:'현재 기준 시간', add:'일정 등록', today:'오늘', prev:'이전 달', next:'다음 달',
      empty:'등록된 일정이 없습니다. 이 날짜에 일정을 추가해 보세요.', count:'일정 {n}개', edit:'수정', remove:'삭제',
      confirmDelete:'이 일정을 삭제할까요?', confirm:'삭제하기', cancel:'취소', newTitle:'일정 등록', editTitle:'일정 수정',
      formHint:'입력 시간 기준: {zone}. * 표시는 필수 항목입니다.', eventTitle:'일정 제목 *', date:'날짜 *', time:'시간 *', note:'메모 (선택)',
      titlePlaceholder:'예: 지원 서류 제출', notePlaceholder:'준비할 것, 장소 등을 적어 두세요.', save:'저장', update:'변경 저장',
      missing:'제목, 날짜, 시간을 입력해 주세요.', invalidDate:'1900년부터 2100년 사이의 올바른 날짜와 시간을 입력해 주세요.',
      gap:'이 지역은 시계가 앞으로 이동하여 이 시간이 존재하지 않습니다. 다른 시간을 선택해 주세요.',
      overlap:'이 지역은 시계가 뒤로 이동하여 이 시간이 두 번 발생합니다. 혼동을 피할 수 있는 다른 시간을 선택해 주세요.',
      saved:'일정을 저장했습니다.', deleted:'일정을 삭제했습니다.', zoneChanged:'기준 도시가 변경되었습니다. 저장된 일정은 새 기준 시간으로 표시됩니다.',
      loadError:'저장된 일정을 불러오지 못했습니다. 기존 데이터는 유지되며, 저장된 일정을 초기화하기 전에는 현재 변경 사항이 저장되지 않습니다.',
      resetSaved:'저장된 일정 초기화', resetConfirm:'저장된 일정 데이터를 모두 지우고 새로 시작할까요?', resetAction:'초기화',
      saveError:'이 브라우저에서 일정을 저장할 수 없습니다. 현재 화면의 변경 사항은 새로고침하면 사라질 수 있습니다.',
      limit:'최대 1,000개의 일정을 저장할 수 있습니다.', footer:'일정은 이 브라우저에 저장됩니다. 기준 도시를 바꾸면 같은 일정을 해당 지역의 시간으로 볼 수 있습니다.',
      weekdays:['월','화','수','목','금','토','일'],
      zones:{kr:'대한민국 · 서울',jp:'일본 · 도쿄',usEast:'미국 · 뉴욕',usWest:'미국 · 로스앤젤레스',uk:'영국 · 런던',fr:'프랑스 · 파리',de:'독일 · 베를린',ru:'러시아 · 모스크바',ae:'아랍에미리트 · 두바이',ir:'이란 · 테헤란',sa:'사우디아라비아 · 리야드',au:'호주 · 시드니',utc:'세계 표준시 · UTC'}
    },
    en: {
      title:'My schedule', eyebrow:'CALENDAR', description:'Plan application tasks and everyday appointments. Dates and times follow your selected country and city.',
      reference:'Reference country / city', currentTime:'Current reference time', add:'Add schedule', today:'Today', prev:'Previous month', next:'Next month',
      empty:'No schedules for this day. Add one to get started.', count:'{n} scheduled', edit:'Edit', remove:'Delete',
      confirmDelete:'Delete this schedule?', confirm:'Delete', cancel:'Cancel', newTitle:'Add schedule', editTitle:'Edit schedule',
      formHint:'Time is entered for {zone}. Fields marked * are required.', eventTitle:'Title *', date:'Date *', time:'Time *', note:'Notes (optional)',
      titlePlaceholder:'e.g. Submit application documents', notePlaceholder:'Add preparations, location, or other details.', save:'Save', update:'Save changes',
      missing:'Enter a title, date, and time.', invalidDate:'Enter a valid date and time between 1900 and 2100.',
      gap:'This local time does not exist because the clocks move forward. Choose another time.',
      overlap:'This local time occurs twice because the clocks move back. Choose another time to avoid ambiguity.',
      saved:'Schedule saved.', deleted:'Schedule deleted.', zoneChanged:'Reference city changed. Saved schedules now use its local time.',
      loadError:'Saved schedules could not be loaded. Existing data is preserved, and changes cannot be saved until the saved calendar is reset.',
      resetSaved:'Reset saved calendar', resetConfirm:'Clear all saved calendar data and start again?', resetAction:'Reset',
      saveError:'This browser could not save the calendar. Changes in this view may be lost when you reload.',
      limit:'You can save up to 1,000 schedules.', footer:'Schedules are stored in this browser. Change the reference city to see the same schedules in its local time.',
      weekdays:['Mon','Tue','Wed','Thu','Fri','Sat','Sun'],
      zones:{kr:'South Korea · Seoul',jp:'Japan · Tokyo',usEast:'United States · New York',usWest:'United States · Los Angeles',uk:'United Kingdom · London',fr:'France · Paris',de:'Germany · Berlin',ru:'Russia · Moscow',ae:'UAE · Dubai',ir:'Iran · Tehran',sa:'Saudi Arabia · Riyadh',au:'Australia · Sydney',utc:'Universal time · UTC'}
    },
    fr: {
      title:'Mon agenda', eyebrow:'CALENDRIER', description:'Planifiez vos démarches et vos rendez-vous. Les dates et heures suivent le pays et la ville sélectionnés.',
      reference:'Pays / ville de référence', currentTime:'Heure de référence actuelle', add:'Ajouter un événement', today:"Aujourd’hui", prev:'Mois précédent', next:'Mois suivant',
      empty:'Aucun événement ce jour. Ajoutez-en un pour commencer.', count:'{n} événement(s)', edit:'Modifier', remove:'Supprimer',
      confirmDelete:'Supprimer cet événement ?', confirm:'Supprimer', cancel:'Annuler', newTitle:'Ajouter un événement', editTitle:'Modifier un événement',
      formHint:'Heure saisie pour {zone}. Les champs marqués * sont obligatoires.', eventTitle:'Titre *', date:'Date *', time:'Heure *', note:'Notes (facultatif)',
      titlePlaceholder:'Ex. : déposer le dossier de candidature', notePlaceholder:'Préparatifs, lieu ou autres informations.', save:'Enregistrer', update:'Enregistrer les modifications',
      missing:'Indiquez un titre, une date et une heure.', invalidDate:'Saisissez une date et une heure valides entre 1900 et 2100.',
      gap:'Cette heure locale n’existe pas en raison du passage à l’heure d’été. Choisissez une autre heure.',
      overlap:'Cette heure locale se produit deux fois lors du recul de l’horloge. Choisissez une autre heure pour éviter toute ambiguïté.',
      saved:'Événement enregistré.', deleted:'Événement supprimé.', zoneChanged:'Ville de référence modifiée. Les événements utilisent désormais son heure locale.',
      loadError:'Impossible de charger les événements enregistrés. Les données existantes sont conservées. Réinitialisez l’agenda pour enregistrer de nouvelles modifications.',
      resetSaved:'Réinitialiser l’agenda enregistré', resetConfirm:'Effacer toutes les données de l’agenda et recommencer ?', resetAction:'Réinitialiser',
      saveError:'Ce navigateur n’a pas pu enregistrer l’agenda. Les modifications risquent d’être perdues au rechargement.',
      limit:'Vous pouvez enregistrer jusqu’à 1 000 événements.', footer:'Les événements sont enregistrés dans ce navigateur. Changez la ville de référence pour les afficher à son heure locale.',
      weekdays:['lun.','mar.','mer.','jeu.','ven.','sam.','dim.'],
      zones:{kr:'Corée du Sud · Séoul',jp:'Japon · Tokyo',usEast:'États-Unis · New York',usWest:'États-Unis · Los Angeles',uk:'Royaume-Uni · Londres',fr:'France · Paris',de:'Allemagne · Berlin',ru:'Russie · Moscou',ae:'Émirats arabes unis · Dubaï',ir:'Iran · Téhéran',sa:'Arabie saoudite · Riyad',au:'Australie · Sydney',utc:'Temps universel · UTC'}
    },
    ru: {
      title:'Мои планы', eyebrow:'КАЛЕНДАРЬ', description:'Планируйте подачу документов и повседневные дела. Даты и время отображаются для выбранных страны и города.',
      reference:'Страна / город отсчёта', currentTime:'Текущее время в выбранном городе', add:'Добавить событие', today:'Сегодня', prev:'Предыдущий месяц', next:'Следующий месяц',
      empty:'На этот день событий нет. Добавьте первое событие.', count:'Событий: {n}', edit:'Изменить', remove:'Удалить',
      confirmDelete:'Удалить это событие?', confirm:'Удалить', cancel:'Отмена', newTitle:'Новое событие', editTitle:'Изменение события',
      formHint:'Время вводится для {zone}. Поля со знаком * обязательны.', eventTitle:'Название *', date:'Дата *', time:'Время *', note:'Заметки (необязательно)',
      titlePlaceholder:'Например: подать документы', notePlaceholder:'Что подготовить, место встречи и другие сведения.', save:'Сохранить', update:'Сохранить изменения',
      missing:'Введите название, дату и время.', invalidDate:'Введите корректную дату и время в диапазоне с 1900 по 2100 год.',
      gap:'Такого местного времени нет из-за перевода часов вперёд. Выберите другое время.',
      overlap:'Это местное время повторяется при переводе часов назад. Выберите другое время, чтобы избежать неоднозначности.',
      saved:'Событие сохранено.', deleted:'Событие удалено.', zoneChanged:'Город отсчёта изменён. События отображаются по его местному времени.',
      loadError:'Не удалось загрузить сохранённые события. Исходные данные сохранены. Новые изменения нельзя сохранить до сброса календаря.',
      resetSaved:'Сбросить сохранённый календарь', resetConfirm:'Удалить все сохранённые данные календаря и начать заново?', resetAction:'Сбросить',
      saveError:'Браузер не смог сохранить календарь. Изменения могут исчезнуть после перезагрузки.',
      limit:'Можно сохранить не более 1 000 событий.', footer:'События сохраняются в этом браузере. Смените город отсчёта, чтобы увидеть те же события по его местному времени.',
      weekdays:['пн','вт','ср','чт','пт','сб','вс'],
      zones:{kr:'Южная Корея · Сеул',jp:'Япония · Токио',usEast:'США · Нью-Йорк',usWest:'США · Лос-Анджелес',uk:'Великобритания · Лондон',fr:'Франция · Париж',de:'Германия · Берлин',ru:'Россия · Москва',ae:'ОАЭ · Дубай',ir:'Иран · Тегеран',sa:'Саудовская Аравия · Эр-Рияд',au:'Австралия · Сидней',utc:'Всемирное время · UTC'}
    },
    ar: {
      title:'مواعيدي', eyebrow:'التقويم', description:'نظّم خطوات التقديم ومواعيدك اليومية. تُعرض التواريخ والأوقات بحسب الدولة والمدينة المختارتين.',
      reference:'الدولة / المدينة المرجعية', currentTime:'الوقت المرجعي الحالي', add:'إضافة موعد', today:'اليوم', prev:'الشهر السابق', next:'الشهر التالي',
      empty:'لا توجد مواعيد في هذا اليوم. أضف موعدًا للبدء.', count:'عدد المواعيد: {n}', edit:'تعديل', remove:'حذف',
      confirmDelete:'هل تريد حذف هذا الموعد؟', confirm:'حذف', cancel:'إلغاء', newTitle:'إضافة موعد', editTitle:'تعديل موعد',
      formHint:'يُدخل الوقت وفق {zone}. الحقول بعلامة * مطلوبة.', eventTitle:'العنوان *', date:'التاريخ *', time:'الوقت *', note:'ملاحظات (اختياري)',
      titlePlaceholder:'مثال: تقديم مستندات الطلب', notePlaceholder:'أضف التحضيرات أو المكان أو أي تفاصيل أخرى.', save:'حفظ', update:'حفظ التغييرات',
      missing:'أدخل العنوان والتاريخ والوقت.', invalidDate:'أدخل تاريخًا ووقتًا صحيحين بين عامي 1900 و2100.',
      gap:'هذا الوقت المحلي غير موجود بسبب تقديم الساعة. اختر وقتًا آخر.',
      overlap:'يتكرر هذا الوقت المحلي مرتين بسبب تأخير الساعة. اختر وقتًا آخر لتجنب الالتباس.',
      saved:'تم حفظ الموعد.', deleted:'تم حذف الموعد.', zoneChanged:'تم تغيير المدينة المرجعية. تُعرض المواعيد الآن بتوقيتها المحلي.',
      loadError:'تعذر تحميل المواعيد المحفوظة. تبقى البيانات الحالية كما هي، ولا يمكن حفظ التغييرات حتى إعادة تعيين التقويم المحفوظ.',
      resetSaved:'إعادة تعيين التقويم المحفوظ', resetConfirm:'هل تريد مسح جميع بيانات التقويم المحفوظة والبدء من جديد؟', resetAction:'إعادة تعيين',
      saveError:'تعذر حفظ التقويم في هذا المتصفح. قد تضيع التغييرات عند إعادة تحميل الصفحة.',
      limit:'يمكن حفظ 1000 موعد كحد أقصى.', footer:'تُحفظ المواعيد في هذا المتصفح. غيّر المدينة المرجعية لعرض المواعيد نفسها بتوقيتها المحلي.',
      weekdays:['الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت','الأحد'],
      zones:{kr:'كوريا الجنوبية · سيول',jp:'اليابان · طوكيو',usEast:'الولايات المتحدة · نيويورك',usWest:'الولايات المتحدة · لوس أنجلوس',uk:'المملكة المتحدة · لندن',fr:'فرنسا · باريس',de:'ألمانيا · برلين',ru:'روسيا · موسكو',ae:'الإمارات · دبي',ir:'إيران · طهران',sa:'السعودية · الرياض',au:'أستراليا · سيدني',utc:'التوقيت العالمي · UTC'}
    },
    fa: {
      title:'برنامه‌های من', eyebrow:'تقویم', description:'کارهای درخواست و قرارهای روزمره را برنامه‌ریزی کنید. تاریخ و ساعت بر اساس کشور و شهر انتخاب‌شده نمایش داده می‌شوند.',
      reference:'کشور / شهر مرجع', currentTime:'زمان فعلی شهر مرجع', add:'افزودن برنامه', today:'امروز', prev:'ماه قبل', next:'ماه بعد',
      empty:'برای این روز برنامه‌ای ثبت نشده است. یک برنامه اضافه کنید.', count:'تعداد برنامه‌ها: {n}', edit:'ویرایش', remove:'حذف',
      confirmDelete:'این برنامه حذف شود؟', confirm:'حذف', cancel:'انصراف', newTitle:'افزودن برنامه', editTitle:'ویرایش برنامه',
      formHint:'زمان بر اساس {zone} وارد می‌شود. فیلدهای دارای * الزامی هستند.', eventTitle:'عنوان *', date:'تاریخ *', time:'ساعت *', note:'یادداشت (اختیاری)',
      titlePlaceholder:'مثلاً: ارسال مدارک درخواست', notePlaceholder:'آمادگی‌ها، مکان یا جزئیات دیگر را وارد کنید.', save:'ذخیره', update:'ذخیره تغییرات',
      missing:'عنوان، تاریخ و ساعت را وارد کنید.', invalidDate:'تاریخ و ساعت معتبری بین سال‌های ۱۹۰۰ تا ۲۱۰۰ میلادی وارد کنید.',
      gap:'به دلیل جلو کشیدن ساعت، این زمان محلی وجود ندارد. زمان دیگری انتخاب کنید.',
      overlap:'به دلیل عقب کشیدن ساعت، این زمان محلی دو بار رخ می‌دهد. برای جلوگیری از ابهام زمان دیگری انتخاب کنید.',
      saved:'برنامه ذخیره شد.', deleted:'برنامه حذف شد.', zoneChanged:'شهر مرجع تغییر کرد. برنامه‌ها اکنون با زمان محلی آن نمایش داده می‌شوند.',
      loadError:'بارگیری برنامه‌های ذخیره‌شده ممکن نشد. داده‌های موجود حفظ می‌شوند و تا بازنشانی تقویم، تغییرات تازه ذخیره نخواهند شد.',
      resetSaved:'بازنشانی تقویم ذخیره‌شده', resetConfirm:'همه داده‌های ذخیره‌شده تقویم پاک شوند و دوباره شروع کنید؟', resetAction:'بازنشانی',
      saveError:'ذخیره تقویم در این مرورگر ممکن نشد. با بارگیری دوباره، تغییرات ممکن است از بین بروند.',
      limit:'حداکثر ۱۰۰۰ برنامه می‌توانید ذخیره کنید.', footer:'برنامه‌ها در این مرورگر ذخیره می‌شوند. شهر مرجع را تغییر دهید تا همان برنامه‌ها را با زمان محلی آن ببینید.',
      weekdays:['دوشنبه','سه‌شنبه','چهارشنبه','پنجشنبه','جمعه','شنبه','یکشنبه'],
      zones:{kr:'کره جنوبی · سئول',jp:'ژاپن · توکیو',usEast:'ایالات متحده · نیویورک',usWest:'ایالات متحده · لس‌آنجلس',uk:'بریتانیا · لندن',fr:'فرانسه · پاریس',de:'آلمان · برلین',ru:'روسیه · مسکو',ae:'امارات · دبی',ir:'ایران · تهران',sa:'عربستان سعودی · ریاض',au:'استرالیا · سیدنی',utc:'زمان جهانی · UTC'}
    }
  };
  var locales = {ko:'ko-KR',en:'en-US',fr:'fr-FR',ru:'ru-RU',ar:'ar',fa:'fa'};
  var state = {timezone:DEFAULT_ZONE,events:[]};
  var warningKey = '', statusKey = '', formErrorKey = '', deleteId = null;
  var loadBlocked = false, resetPending = false;
  var formState = null;
  var partFormatters = Object.create(null);
  var lang = getLanguage();
  var elements = {};
  function getLanguage() {
    var value = (window.DariProcedureI18n && window.DariProcedureI18n.language) || document.documentElement.lang || 'ko';
    value = String(value).toLowerCase().split('-')[0];
    return TEXT[value] ? value : 'ko';
  }
  function t(key, args) {
    var value = TEXT[lang][key] || TEXT.en[key] || key;
    if (args) Object.keys(args).forEach(function (name) { value = value.replace('{' + name + '}', String(args[name])); });
    return value;
  }
  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function button(text, className, action) {
    var node = el('button', 'dari-cal-btn' + (className ? ' ' + className : ''), text);
    node.type = 'button';
    if (action) node.addEventListener('click', action);
    return node;
  }
  function zoneLabel(zone) {
    var match = ZONES.find(function (item) { return item[0] === (zone || state.timezone); });
    return TEXT[lang].zones[match ? match[1] : 'kr'];
  }
  function pad(number) { return String(number).padStart(2, '0'); }
  function partsAt(instant, zone) {
    if (!partFormatters[zone]) partFormatters[zone] = new Intl.DateTimeFormat('en-GB-u-ca-gregory-nu-latn', {
      timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'
    });
    var parts = {};
    partFormatters[zone].formatToParts(new Date(instant)).forEach(function (part) {
      if (part.type !== 'literal') parts[part.type] = Number(part.value);
    });
    return parts;
  }
  function dateKey(parts) { return parts.year + '-' + pad(parts.month) + '-' + pad(parts.day); }
  function localDateKey(instant) { return dateKey(partsAt(instant, state.timezone)); }
  function dateFromKey(key) { return new Date(key + 'T12:00:00Z'); }
  function shiftDay(key, amount) {
    var value = dateFromKey(key);
    value.setUTCDate(value.getUTCDate() + amount);
    return value.toISOString().slice(0,10);
  }
  function displayDate(key, options) {
    return new Intl.DateTimeFormat(locales[lang], Object.assign({calendar:'gregory',timeZone:'UTC'}, options)).format(dateFromKey(key));
  }
  function offsetAt(instant, zone) {
    var p = partsAt(instant, zone);
    return Date.UTC(p.year,p.month-1,p.day,p.hour,p.minute,p.second) - Math.floor(instant / 1000) * 1000;
  }
  function offsetLabel(instant) {
    var total = Math.round(offsetAt(instant, state.timezone) / 60000);
    return 'UTC' + (total >= 0 ? '+' : '−') + pad(Math.floor(Math.abs(total) / 60)) + ':' + pad(Math.abs(total) % 60);
  }
  function localToInstant(date, time, zone) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return {error:'invalidDate'};
    var numbers = (date + '-' + time.replace(':','-')).split('-').map(Number);
    var year=numbers[0], month=numbers[1], day=numbers[2], hour=numbers[3], minute=numbers[4];
    var wall = Date.UTC(year,month-1,day,hour,minute,0);
    var check = new Date(wall);
    if (year < 1900 || year > 2100 || check.getUTCFullYear() !== year || check.getUTCMonth() !== month-1 || check.getUTCDate() !== day || hour > 23 || minute > 59) return {error:'invalidDate'};
    var offsets = new Set();
    for (var delta=-48; delta<=48; delta+=6) offsets.add(offsetAt(wall + delta*3600000,zone));
    var matches = [];
    offsets.forEach(function (offset) {
      var candidate = wall - offset;
      var p = partsAt(candidate, zone);
      if (p.year===year && p.month===month && p.day===day && p.hour===hour && p.minute===minute && p.second===0) matches.push(candidate);
    });
    if (!matches.length) return {error:'gap'};
    if (matches.length > 1) return {error:'overlap'};
    return {instant:new Date(matches[0]).toISOString()};
  }
  function validState(value) {
    if (!value || value.version!==1 || !ZONES.some(function (zone) {return zone[0]===value.timezone;}) || !Array.isArray(value.events) || value.events.length>1000) return false;
    var ids = new Set();
    return value.events.every(function (event) {
      if (!event || typeof event.id!=='string' || !event.id || event.id.length>100 || ids.has(event.id) || typeof event.title!=='string' || !event.title.trim() || event.title.length>120 || typeof event.note!=='string' || event.note.length>2000 || typeof event.start!=='string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(event.start)) return false;
      var date = new Date(event.start);
      if (!Number.isFinite(date.getTime()) || date.toISOString()!==event.start || date.getUTCFullYear()<1899 || date.getUTCFullYear()>2101) return false;
      ids.add(event.id);
      return true;
    });
  }
  function loadState() {
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw === null) return;
      var value = JSON.parse(raw);
      if (!validState(value)) throw new Error('Invalid calendar data');
      state = {timezone:value.timezone,events:value.events.map(function (event) { return {id:event.id,title:event.title,start:event.start,note:event.note,place:typeof event.place==='string'?event.place.slice(0,240):''}; })};
    } catch (error) { warningKey = 'loadError'; loadBlocked = true; }
  }
  function persist() {
    if (loadBlocked) { warningKey = 'loadError'; return false; }
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({version:1,timezone:state.timezone,events:state.events}));
      warningKey = '';
      return true;
    } catch (error) { warningKey = 'saveError'; return false; }
  }
  loadState();
  var selectedDay = localDateKey(Date.now());
  var month = selectedDay.slice(0,7);
  var lastToday = selectedDay;
  function validView(value) {
    if(!value||typeof value.selectedDay!=='string'||typeof value.month!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value.selectedDay)||value.month!==value.selectedDay.slice(0,7))return false;
    var date=dateFromKey(value.selectedDay);
    return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value.selectedDay&&date.getUTCFullYear()>=1900&&date.getUTCFullYear()<=2100;
  }
  function loadView() {
    try{var raw=window.localStorage.getItem(VIEW_KEY);if(raw===null)return;var value=JSON.parse(raw);if(validView(value)){selectedDay=value.selectedDay;month=value.month;}}catch(error){/* Schedule-data errors are reported separately; an unavailable view falls back to today. */}
  }
  function persistView() {
    try{window.localStorage.setItem(VIEW_KEY,JSON.stringify({selectedDay:selectedDay,month:month}));return true;}catch(error){warningKey='saveError';return false;}
  }
  function resolveDraftInstant(zone) {
    if(formState.resolvedStart){
      var known=partsAt(formState.resolvedStart,zone);
      if(dateKey(known)===formState.date&&pad(known.hour)+':'+pad(known.minute)===formState.time)return {instant:formState.resolvedStart};
    }
    return localToInstant(formState.date,formState.time,zone);
  }
  loadView();
  function updateMessages() {
    if (!elements.warning) return;
    elements.warning.replaceChildren();
    if(warningKey)elements.warning.append(el('span','',t(warningKey)));
    if(loadBlocked){
      var resetControls=el('div','dari-cal-delete-confirm');
      if(resetPending){
        resetControls.append(el('span','',t('resetConfirm')));
        var resetButton=button(t('resetAction'),'dari-cal-btn-small',function(){window.DariCalendar.reset();});
        resetButton.id='dari-cal-confirm-reset';
        resetControls.append(resetButton,button(t('cancel'),'dari-cal-btn-small',function(){resetPending=false;updateMessages();}));
      }else{
        var requestReset=button(t('resetSaved'),'dari-cal-btn-small',function(){resetPending=true;updateMessages();});
        requestReset.id='dari-cal-reset-saved';resetControls.append(requestReset);
      }
      elements.warning.append(resetControls);
    }
    elements.warning.hidden = !warningKey;
    elements.status.textContent = statusKey ? t(statusKey) : '';
    elements.status.hidden = !statusKey;
    elements.formError.textContent = formErrorKey ? t(formErrorKey) : '';
    elements.formError.hidden = !formErrorKey;
  }
  function updateClock() {
    if (!elements.clock || !root.isConnected) return;
    var now = Date.now();
    var p = partsAt(now,state.timezone);
    elements.clock.textContent = pad(p.hour) + ':' + pad(p.minute) + ':' + pad(p.second);
    elements.clock.setAttribute('datetime',new Date(now).toISOString());
    elements.clockDate.textContent = displayDate(dateKey(p),{year:'numeric',month:'short',day:'numeric'}) + ' · ' + offsetLabel(now);
    if (lastToday!==dateKey(p)) { lastToday=dateKey(p); renderGrid(); }
  }
  var compact=document.documentElement.classList.contains('dari-embedded');
  function homeText(index){var copies=window.DariSchedulerHomeCopy;return (copies[lang]||copies.en)[index];}
  function build() {
    root.replaceChildren();
    root.lang = lang;
    root.dir = lang==='ar'||lang==='fa' ? 'rtl' : 'ltr';
    var panel = el('div','dari-cal-panel');
    var header = el('div','dari-cal-header');
    var intro = el('div','dari-cal-intro');
    if(compact)intro.append(el('h2','',homeText(5)));else intro.append(el('p','dari-cal-eyebrow',t('eyebrow')),el('h2','',t('title')),el('p','dari-cal-description',t('description')));
    var add = button(t('add'),'dari-cal-btn-primary',function () { openForm(null); });
    add.id='dari-cal-add'; elements.add=add; intro.append(add);
    var reference = el('div','dari-cal-reference');
    var label=el('label','',t('reference')); label.htmlFor='dari-cal-zone';
    var select=el('select'); select.id='dari-cal-zone';
    ZONES.forEach(function(zone){var option=el('option','',TEXT[lang].zones[zone[1]]); option.value=zone[0]; select.append(option);});
    select.value=state.timezone;
    select.addEventListener('change',function () {
      var draft=formState?resolveDraftInstant(state.timezone):null;
      state.timezone=select.value;
      // Keep both saved and unsaved draft instants stable when changing their displayed timezone.
      if(formState&&draft&&draft.instant){var p=partsAt(draft.instant,state.timezone);formState.date=dateKey(p);formState.time=pad(p.hour)+':'+pad(p.minute);formState.resolvedStart=draft.instant;}
      formErrorKey='';
      persist(); statusKey='zoneChanged'; lastToday=localDateKey(Date.now());
      renderGrid(); renderAgenda(); renderForm(); updateClock(); updateMessages();
    });
    elements.zone=select;
    elements.clock=el('time','dari-cal-clock'); elements.clock.id='dari-cal-clock';
    elements.clockDate=el('div','dari-cal-clock-date'); elements.clockDate.id='dari-cal-clock-date';
    reference.append(label,select,el('p','dari-cal-clock-label',t('currentTime')),elements.clock,elements.clockDate);
    header.append(intro);if(!compact)header.append(reference);panel.append(header);
    if(compact){elements.upcoming=el('div','scheduler-upcoming');panel.append(elements.upcoming);}
    var calendarHost=panel;
    if(compact){calendarHost=el('details','scheduler-calendar');calendarHost.append(el('summary','',homeText(11)));panel.append(calendarHost);elements.browse=calendarHost;}
    var nav=el('div','dari-cal-month-nav');
    elements.monthTitle=el('h3','dari-cal-month-title'); elements.monthTitle.id='dari-cal-month'; elements.monthTitle.setAttribute('aria-live','polite');
    var actions=el('div','dari-cal-nav-actions');
    var previous=button(root.dir==='rtl'?'›':'‹','dari-cal-arrow',function(){changeMonth(-1);}); previous.id='dari-cal-prev'; previous.setAttribute('aria-label',t('prev'));
    var today=button(t('today'),'dari-cal-btn-small',function(){selectedDay=localDateKey(Date.now());month=selectedDay.slice(0,7);persistView();renderGrid();renderAgenda();updateMessages();}); today.id='dari-cal-today';
    var next=button(root.dir==='rtl'?'‹':'›','dari-cal-arrow',function(){changeMonth(1);}); next.id='dari-cal-next'; next.setAttribute('aria-label',t('next'));
    actions.append(previous,today,next); nav.append(elements.monthTitle,actions); calendarHost.append(nav);
    elements.grid=el('div','dari-cal-grid'); elements.grid.id='dari-cal-grid'; elements.grid.setAttribute('aria-labelledby','dari-cal-month');
    calendarHost.append(elements.grid);
    elements.agenda=el('div','dari-cal-agenda'); elements.agenda.id='dari-cal-agenda'; calendarHost.append(elements.agenda);
    if(compact){var settings=el('details','scheduler-settings');settings.append(el('summary','',homeText(8)),reference);calendarHost.append(settings);}
    elements.form=el('form','dari-cal-form'); elements.form.id='dari-cal-form'; elements.form.noValidate=true; elements.form.addEventListener('submit',submitForm); panel.append(elements.form);if(compact){var formDialog=el('dialog','scheduler-dialog scheduler-form-dialog');formDialog.setAttribute('aria-label',t('newTitle'));formDialog.append(elements.form);panel.append(formDialog);elements.formDialog=formDialog;formDialog.addEventListener('cancel',function(){formState=null;renderForm();});}
    elements.formError=el('p','dari-cal-message dari-cal-error'); elements.formError.id='dari-cal-form-error'; elements.formError.setAttribute('role','alert'); elements.formError.hidden=true;
    elements.warning=el('div','dari-cal-message'); elements.warning.id='dari-cal-warning'; elements.warning.setAttribute('role','status'); panel.append(elements.warning);
    elements.status=el('p','dari-cal-message'); elements.status.id='dari-cal-status'; elements.status.setAttribute('role','status'); panel.append(elements.status);
    if(!compact)panel.append(el('p','dari-cal-footer',t('footer')));root.append(panel);
    renderGrid(); renderAgenda(); renderForm(); updateClock(); updateMessages();
  }
  function changeMonth(direction) {
    var date = dateFromKey(month+'-01');
    date.setUTCMonth(date.getUTCMonth()+direction);
    if(date.getUTCFullYear()<1900 || date.getUTCFullYear()>2100) return;
    month=date.toISOString().slice(0,7); selectedDay=month+'-01'; persistView();renderGrid();renderAgenda();updateMessages();
  }
  function renderGrid() {
    elements.monthTitle.textContent=displayDate(month+'-01',{year:'numeric',month:'long'});
    elements.grid.replaceChildren();
    TEXT[lang].weekdays.forEach(function(day){elements.grid.append(el('div','dari-cal-weekday',day));});
    var first=month+'-01'; var weekday=(dateFromKey(first).getUTCDay()+6)%7;
    var start=shiftDay(first,-weekday);
    var counts=Object.create(null);
    state.events.forEach(function(event){var key=localDateKey(event.start);counts[key]=(counts[key]||0)+1;});
    var today=localDateKey(Date.now());
    for(var index=0;index<42;index++){
      (function(key){
        var outside=key.slice(0,7)!==month;
        var cell=button('','',function(){selectedDay=key;month=key.slice(0,7);deleteId=null;persistView();renderGrid();renderAgenda();updateMessages();});
        cell.className='dari-cal-day'+(outside?' dari-cal-outside':'')+(key===selectedDay?' dari-cal-selected':'')+(key===today?' dari-cal-today':'');
        cell.dataset.date=key; cell.setAttribute('aria-pressed',String(key===selectedDay));
        if(key===today)cell.setAttribute('aria-current','date');
        cell.setAttribute('aria-label',displayDate(key,{year:'numeric',month:'long',day:'numeric',weekday:'long'})+', '+t('count',{n:counts[key]||0}));
        cell.append(el('span','dari-cal-day-num',String(Number(key.slice(8)))));
        var dots=el('span','dari-cal-dots'); dots.setAttribute('aria-hidden','true');
        for(var dot=0;dot<Math.min(3,counts[key]||0);dot++)dots.append(el('span','dari-cal-dot'));
        cell.append(dots); elements.grid.append(cell);
      })(shiftDay(start,index));
    }
  }
  function renderUpcoming(){
    if(!elements.upcoming)return;elements.upcoming.replaceChildren();
    var events=state.events.filter(function(event){return new Date(event.start).getTime()>=Date.now();}).sort(function(a,b){return a.start.localeCompare(b.start);}).slice(0,2);
    if(!events.length){elements.upcoming.append(el('p','scheduler-empty',homeText(6)));return;}
    events.forEach(function(event,index){
      var row=button('','scheduler-appointment',function(){openForm(event);});
      if(index===0)row.classList.add('is-next');
      var time=partsAt(event.start,state.timezone),key=localDateKey(event.start),date=el('span','scheduler-date');
      date.append(el('small','scheduler-date-month',displayDate(key,{month:'short'})),el('b','',new Intl.NumberFormat(lang).format(Number(key.slice(-2)))),el('small','scheduler-date-weekday',displayDate(key,{weekday:'short'})));
      var zoneLabel=new Intl.DateTimeFormat(lang,{timeZone:state.timezone,timeZoneName:'short'}).formatToParts(new Date(event.start)).find(function(part){return part.type==='timeZoneName';}).value;
      var content=el('span','scheduler-appointment-content');var titleNode=el('strong','',event.title);titleNode.title=event.title;content.append(titleNode,el('small','scheduler-appointment-time',pad(time.hour)+':'+pad(time.minute)+' · '+zoneLabel));
      function detailLine(className,value,path){var line=el('span',className);var icon=document.createElementNS('http://www.w3.org/2000/svg','svg');icon.setAttribute('viewBox','0 0 24 24');icon.setAttribute('aria-hidden','true');var shape=document.createElementNS(icon.namespaceURI,'path');shape.setAttribute('d',path);shape.setAttribute('fill','none');shape.setAttribute('stroke','currentColor');shape.setAttribute('stroke-width','1.6');shape.setAttribute('stroke-linecap','round');shape.setAttribute('stroke-linejoin','round');icon.append(shape);line.append(icon,el('span','',value));return line;}
      if(event.place)content.append(detailLine('scheduler-appointment-place',event.place,'M12 21s7-6 7-12a7 7 0 1 0-14 0c0 6 7 12 7 12Z M12 6a3 3 0 1 0 0 6 3 3 0 0 0 0-6'));
      if(event.note)content.append(detailLine('scheduler-appointment-note',event.note,'M7 3h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z M9 8h6 M9 12h6 M9 16h4'));
      var placeNode=content.querySelector('.scheduler-appointment-place');if(placeNode)placeNode.setAttribute('aria-label',homeText(14)+': '+event.place);var noteNode=content.querySelector('.scheduler-appointment-note');if(noteNode)noteNode.setAttribute('aria-label',t('note')+': '+event.note);var arrow=el('span','scheduler-appointment-arrow','›');arrow.setAttribute('aria-hidden','true');row.append(date,content,arrow);elements.upcoming.append(row);
    });
  }
  function renderAgenda() {
    renderUpcoming();
    elements.agenda.replaceChildren();
    var events=state.events.filter(function(event){return compact||localDateKey(event.start)===selectedDay;}).sort(function(a,b){return a.start.localeCompare(b.start)||a.title.localeCompare(b.title);});
    var heading=el('div','dari-cal-agenda-heading');
    heading.append(el('h3','dari-cal-agenda-title',displayDate(selectedDay,{month:'long',day:'numeric',weekday:'long'})),el('span','dari-cal-count',t('count',{n:events.length})));
    elements.agenda.append(heading);
    if(!events.length){elements.agenda.append(el('p','dari-cal-empty',t('empty')));return;}
    var list=el('ul','dari-cal-event-list');
    events.forEach(function(event){
      var item=el('li','dari-cal-event'); item.dataset.eventId=event.id;
      var p=partsAt(event.start,state.timezone);
      var eventTime=el('time','dari-cal-event-time',(compact?displayDate(localDateKey(event.start),{month:'short',day:'numeric'})+' · ':'')+pad(p.hour)+':'+pad(p.minute));eventTime.dateTime=event.start;
      var body=el('div','dari-cal-event-body');body.append(el('p','dari-cal-event-title',event.title));
      if(event.place)body.append(el('p','dari-cal-event-note',event.place));if(event.note)body.append(el('p','dari-cal-event-note',event.note));
      if(deleteId===event.id){
        var confirmation=el('div','dari-cal-delete-confirm');confirmation.append(el('span','',t('confirmDelete')));
        var yes=button(t('confirm'),'dari-cal-btn-small dari-cal-btn-primary',function(){state.events=state.events.filter(function(entry){return entry.id!==event.id;});if(formState&&formState.id===event.id){formState=null;renderForm();}deleteId=null;statusKey=persist()?'deleted':'';renderGrid();renderAgenda();updateMessages();});
        yes.dataset.action='confirm-delete'; confirmation.append(yes,button(t('cancel'),'dari-cal-btn-small',function(){deleteId=null;renderAgenda();}));body.append(confirmation);
      }
      var actions=el('div','dari-cal-event-actions');
      var edit=button(t('edit'),'dari-cal-btn-small',function(){openForm(event);});edit.dataset.action='edit';edit.setAttribute('aria-label',t('edit')+': '+event.title);
      var remove=button(t('remove'),'dari-cal-btn-small',function(){deleteId=event.id;renderAgenda();var confirmButton=elements.agenda.querySelector('[data-action="confirm-delete"]');if(confirmButton)confirmButton.focus({preventScroll:true});});remove.dataset.action='delete';remove.setAttribute('aria-label',t('remove')+': '+event.title);
      actions.append(edit,remove);item.append(eventTime,body,actions);list.append(item);
    });
    elements.agenda.append(list);
  }
  function openForm(event) {
    formErrorKey='';statusKey='';deleteId=null;
    if(event){var p=partsAt(event.start,state.timezone);formState={id:event.id,title:event.title,date:dateKey(p),time:pad(p.hour)+':'+pad(p.minute),note:event.note,place:event.place||'',resolvedStart:event.start};}
    else formState={id:null,title:'',date:selectedDay,time:'09:00',note:'',place:''};
    renderAgenda();renderForm();updateMessages();
    var title=elements.form.querySelector('#dari-cal-title');if(title)title.focus({preventScroll:true});
    if(!compact)elements.form.scrollIntoView({block:'nearest',behavior:'smooth'});
  }
  function field(labelText,name,type) {
    var wrap=el('div','dari-cal-field');var label=el('label','',labelText);label.htmlFor='dari-cal-'+name;
    var input=el(type==='textarea'?'textarea':'input');input.id='dari-cal-'+name;input.name=name;
    if(type!=='textarea')input.type=type;
    input.value=formState[name]||'';
    if(name!=='note'&&name!=='place')input.required=true;
    if(name==='title'){input.maxLength=120;input.placeholder=t('titlePlaceholder');}
    if(name==='place'){input.maxLength=240;input.placeholder=homeText(27);}
    if(name==='note'){input.maxLength=2000;input.placeholder=compact?homeText(22):t('notePlaceholder');input.rows=3;}
    if(name==='date'){input.min='1900-01-01';input.max='2100-12-31';}
    if(name==='time')input.step='60';
    input.addEventListener('input',function(){if(formState)formState[name]=input.value;});
    wrap.append(label,input);return wrap;
  }
  function renderForm() {
    elements.form.replaceChildren();elements.form.hidden=!formState;
    if(!formState){if(elements.formDialog&&elements.formDialog.open)elements.formDialog.close();return;}
    if(elements.formDialog&&!elements.formDialog.open){positionEmbeddedDialog(elements.formDialog);elements.formDialog.showModal();}
    elements.form.append(el('h3','dari-cal-form-heading',t(formState.id?'editTitle':'newTitle')),el('p','dari-cal-form-hint',t('formHint',{zone:zoneLabel()})));
    if(compact){var types=el('div','scheduler-event-types');var typeLabel=el('p','scheduler-label',homeText(13));elements.form.append(typeLabel,types);[16,17,18,19,20].forEach(function(index){var choice=button(homeText(index),'',function(){formState.title=homeText(index);elements.form.querySelector('#dari-cal-title').value=formState.title;types.querySelectorAll('button').forEach(function(b){b.setAttribute('aria-pressed',String(b===choice));});});choice.setAttribute('aria-pressed',String(formState.title===homeText(index)));types.append(choice);});}
    elements.form.append(field(t('eventTitle'),'title','text'));
    var row=el('div','dari-cal-field-row');row.append(field(t('date'),'date','date'),field(t('time'),'time','time'));elements.form.append(row);if(compact)elements.form.append(field(homeText(14),'place','text'));elements.form.append(field(compact?homeText(15):t('note'),'note','textarea'));
    elements.form.append(elements.formError);
    var actions=el('div','dari-cal-form-actions');var save=button(t(formState.id?'update':'save'),'dari-cal-btn-primary');save.type='submit';save.id='dari-cal-save';
    actions.append(save,button(t('cancel'),'',function(){formState=null;formErrorKey='';renderForm();updateMessages();elements.add&&elements.add.focus();}));elements.form.append(actions);
    updateMessages();
  }
  function submitForm(event) {
    event.preventDefault();if(!formState)return;
    // Read fields directly as well as tracking input events (browser autofill may skip input).
    ['title','date','time','note'].forEach(function(name){formState[name]=elements.form.elements.namedItem(name).value;});
    formErrorKey='';var title=formState.title.trim();
    if(!title||!formState.date||!formState.time){formErrorKey='missing';updateMessages();return;}
    if(!formState.id&&state.events.length>=1000){formErrorKey='limit';updateMessages();return;}
    var result=resolveDraftInstant(state.timezone);
    if(result.error){formErrorKey=result.error;updateMessages();return;}
    var id=formState.id || (window.crypto&&typeof window.crypto.randomUUID==='function'?window.crypto.randomUUID():'event-'+Date.now()+'-'+Math.random().toString(36).slice(2));
    var place=compact?elements.form.elements.namedItem('place').value.trim().slice(0,240):(formState.place||'');var entry={id:id,title:title.slice(0,120),start:result.instant,note:formState.note.trim().slice(0,2000),place:place};
    var index=state.events.findIndex(function(value){return value.id===id;});
    if(index===-1)state.events.push(entry);else state.events[index]=entry;
    selectedDay=formState.date;month=selectedDay.slice(0,7);formState=null;deleteId=null;var eventSaved=persist();var viewSaved=persistView();statusKey=eventSaved&&viewSaved?'saved':'';
    renderGrid();renderAgenda();renderForm();updateMessages();
  }
  function syncLanguage() {var next=getLanguage();if(next!==lang){lang=next;build();}}
  var languageObserver=new MutationObserver(syncLanguage);
  languageObserver.observe(document.documentElement,{attributes:true,attributeFilter:['lang','dir']});
  window.addEventListener('dari:languagechange',syncLanguage);
  window.addEventListener('storage',function(event){
    if(event.key===VIEW_KEY){if(event.newValue!==null){try{var view=JSON.parse(event.newValue);if(validView(view)){selectedDay=view.selectedDay;month=view.month;renderGrid();renderAgenda();}}catch(error){/* Ignore malformed view preferences. */}}return;}
    if(event.key!==STORAGE_KEY&&event.key!==null)return;
    if(event.newValue===null){state={timezone:DEFAULT_ZONE,events:[]};warningKey='';loadBlocked=false;resetPending=false;}
    else{try{var value=JSON.parse(event.newValue);if(!validState(value))throw new Error('Invalid calendar data');state={timezone:value.timezone,events:value.events};warningKey='';loadBlocked=false;resetPending=false;}catch(error){warningKey='loadError';loadBlocked=true;updateMessages();return;}}
    formState=null;deleteId=null;statusKey='';formErrorKey='';selectedDay=localDateKey(Date.now());month=selectedDay.slice(0,7);lastToday=selectedDay;loadView();build();
  });
  window.DariCalendar={
    reset:function(){
      state={timezone:DEFAULT_ZONE,events:[]};formState=null;deleteId=null;statusKey='';formErrorKey='';warningKey='';resetPending=false;
      try{window.localStorage.removeItem(STORAGE_KEY);window.localStorage.removeItem(VIEW_KEY);loadBlocked=false;}catch(error){warningKey='saveError';loadBlocked=true;}
      selectedDay=localDateKey(Date.now());month=selectedDay.slice(0,7);lastToday=selectedDay;build();
    },
    refreshLanguage:syncLanguage
  };
  build();
  var clockTimer=window.setInterval(function(){if(!root.isConnected){window.clearInterval(clockTimer);languageObserver.disconnect();return;}syncLanguage();updateClock();},1000);
})();
