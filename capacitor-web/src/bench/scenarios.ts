// Fictional test conversations for question 14 metadata collection, in every
// candidate UI language. Every story is invented for testing; do not use real
// applicant statements. Non-Korean turns are drafted translations of the Korean
// originals and still need review by native speakers before results are cited.
//
// Checks (scored by score.ts):
//   gate      { gate, value }                     applicant's yes/no for a group
//   events    { group, count }                    number of separate incidents/entries
//   has       { field, includes, event? }         an answered value contains text (event = 1-based order)
//   lacks     { field, includes, event? }         no answered value contains text (e.g. leaked from another incident)
//   notAnswered { field, event? }                 not recorded as an answered fact (missing/unknown/skipped is fine)
//   status    { field, in: [...] , event? }       fact status
//   knowledge { field, in: [...], event? }        direct / heard / inferred
//   derived   { id, value }                       computed question 14 box
// Free-text values stay in the applicant's language, so `includes` is either one
// string for every language (numbers, option codes) or a per-language map whose
// entries may list alternatives (any one matches).
// draft (optional): [{ question, has?: [...], lacks?: [...] }] checks on the Korean draft section.
// lacks/notAnswered checks guard against invented or leaked testimony and count as
// safety checks; other checks can opt in with `safety: true`.

export const benchLanguages = ['ko', 'en', 'fr', 'ru', 'ar', 'fa'] as const;
export type BenchLanguage = typeof benchLanguages[number];
export type Localized = string | Record<BenchLanguage, string | string[]>;

type Field = { field: string; event?: number; safety?: boolean };
export type Check =
  | { gate: { gate: string; value: string; safety?: boolean } }
  | { events: { group: string; count: number; safety?: boolean } }
  | { has: Field & { includes: Localized } }
  | { lacks: Field & { includes: Localized } }
  | { notAnswered: Field }
  | { status: Field & { in: string[] } }
  | { knowledge: Field & { in: string[] } }
  | { derived: { id: string; value: string; safety?: boolean } };
export type DraftCheck = { question: string; has?: string[]; lacks?: string[] };
export type Scenario = { id: string; title: string; turns: Record<BenchLanguage, string[]>; checks: Check[]; draft?: DraftCheck[] };

const fictional: Record<BenchLanguage, string> = {
  ko: '이것은 시험용 가상 이야기입니다.',
  en: 'This is a fictional story for testing.',
  fr: 'Ceci est une histoire fictive pour un test.',
  ru: 'Это вымышленная история для проверки.',
  ar: 'هذه قصة خيالية لغرض الاختبار.',
  fa: 'این یک داستان ساختگی برای آزمایش است.',
};
/** Prefixes the "fictional story" notice to each language's first turn. */
function story(turns: Record<BenchLanguage, string[]>): Record<BenchLanguage, string[]> {
  return Object.fromEntries(benchLanguages.map(lang => [lang, turns[lang].map((turn, index) => index ? turn : `${fictional[lang]} ${turn}`)])) as Record<BenchLanguage, string[]>;
}

export const scenarios: Scenario[] = [
  {
    id: 'basic',
    title: '기본: 한 사건, 대략적인 날짜, 귀국 시 우려',
    turns: story({
      ko: ['저는 정치적 의견 때문에 보호를 신청합니다. 2024년 가을쯤 정부를 비판하는 글을 인터넷에 올린 뒤 경찰이 집에 찾아와서 그 글에 대해 두 시간 동안 조사했습니다. 돌아가면 다시 붙잡혀 갈까 두렵습니다.'],
      en: ['I am applying for protection because of my political opinion. Around autumn 2024, after I posted something online criticizing the government, the police came to my home and questioned me about the post for two hours. I am afraid that if I go back I will be taken away again.'],
      fr: ["Je demande une protection en raison de mes opinions politiques. Vers l'automne 2024, après avoir publié sur Internet un texte critiquant le gouvernement, la police est venue chez moi et m'a interrogé pendant deux heures sur ce texte. J'ai peur d'être de nouveau arrêté si je rentre."],
      ru: ['Я прошу защиты из-за своих политических взглядов. Примерно осенью 2024 года, после того как я опубликовал в интернете текст с критикой правительства, ко мне домой пришла полиция и два часа допрашивала меня об этом тексте. Я боюсь, что если вернусь, меня снова заберут.'],
      ar: ['أطلب الحماية بسبب رأيي السياسي. في خريف عام 2024 تقريبًا، بعد أن نشرت على الإنترنت نصًا ينتقد الحكومة، جاءت الشرطة إلى منزلي واستجوبتني بشأن ذلك النص لمدة ساعتين. أخشى أن يتم أخذي مرة أخرى إذا عدت.'],
      fa: ['من به خاطر عقیده سیاسی‌ام درخواست حمایت می‌کنم. حدود پاییز ۲۰۲۴، بعد از اینکه مطلبی در انتقاد از دولت در اینترنت منتشر کردم، پلیس به خانه‌ام آمد و دو ساعت درباره آن مطلب از من بازجویی کرد. می‌ترسم اگر برگردم دوباره مرا ببرند.'],
    }),
    checks: [
      { has: { field: 'grounds.category', includes: 'political' } },
      { gate: { gate: 'harm', value: 'yes' } },
      { events: { group: 'harm', count: 1 } },
      { has: { field: 'harm.time', includes: { ko: '가을', en: ['autumn', 'fall'], fr: 'automne', ru: 'осен', ar: 'خريف', fa: 'پاییز' } } },
      { has: { field: 'harm.type', includes: 'questioning' } },
      { gate: { gate: 'fear', value: 'yes' } },
      { derived: { id: '14.2', value: '예' } },
      // The story never says when the applicant left; a date there is invented.
      { notAnswered: { field: 'departure.date' } },
    ],
    // "글을 올린 뒤" is a sequence; the draft must not turn it into a cause. Only causal links
    // to the post count: "정치적 의견 때문에 신청" restates the applicant's own grounds.
    draft: [{ question: '14.2', has: ['가을'], lacks: ['올렸기 때문에', '올린 것 때문에', '글 때문에', '이 일로 인해', '그 일로 인해', '그 결과'] }],
  },
  {
    id: 'two-incidents',
    title: '여러 사건: 사건별 정보가 섞이지 않아야 함',
    turns: story({
      ko: ['저는 종교 때문에 신청합니다. 2023년 겨울에 교회 예배 중 경찰이 들어와 저를 체포했고 사흘 동안 구금됐다가 풀려났습니다. 그때 맞지는 않았습니다.',
        '그리고 2024년 5월쯤에는 집 앞에서 모르는 남자 두 명이 저를 때렸습니다. 그 사람들이 누구인지, 왜 그랬는지는 모릅니다.'],
      en: ['I am applying because of my religion. In the winter of 2023, the police came into a church service and arrested me, and I was held for three days before being released. I was not beaten that time.',
        'And around May 2024, two men I did not know beat me in front of my house. I don\'t know who they were or why they did it.'],
      fr: ["Je fais ma demande en raison de ma religion. Pendant l'hiver 2023, la police est entrée pendant un office à l'église et m'a arrêté ; j'ai été détenu trois jours, puis libéré. Cette fois-là, je n'ai pas été frappé.",
        "Et vers mai 2024, deux hommes que je ne connaissais pas m'ont frappé devant chez moi. Je ne sais pas qui ils étaient ni pourquoi ils l'ont fait."],
      ru: ['Я подаю заявление из-за своей религии. Зимой 2023 года полиция ворвалась в церковь во время службы и арестовала меня; меня продержали три дня, а потом отпустили. Тогда меня не били.',
        'А примерно в мае 2024 года двое незнакомых мужчин избили меня возле моего дома. Я не знаю, кто они были и зачем они это сделали.'],
      ar: ['أتقدم بالطلب بسبب ديني. في شتاء عام 2023 دخلت الشرطة أثناء الصلاة في الكنيسة واعتقلتني، واحتُجزت ثلاثة أيام ثم أُفرج عني. لم أتعرض للضرب في تلك المرة.',
        'وفي مايو 2024 تقريبًا، ضربني رجلان لا أعرفهما أمام منزلي. لا أعرف من هما ولا لماذا فعلا ذلك.'],
      fa: ['من به خاطر دینم درخواست می‌دهم. در زمستان ۲۰۲۳ پلیس وسط مراسم عبادت وارد کلیسا شد و مرا دستگیر کرد؛ سه روز بازداشت بودم و بعد آزاد شدم. آن بار کتک نخوردم.',
        'و حدود مه ۲۰۲۴ دو مرد ناشناس جلوی خانه‌ام مرا کتک زدند. نمی‌دانم چه کسانی بودند و چرا این کار را کردند.'],
    }),
    checks: [
      { events: { group: 'harm', count: 2 } },
      { has: { field: 'harm.type', includes: 'detention', event: 1 } },
      { lacks: { field: 'harm.type', includes: 'assault', event: 1 } },
      { has: { field: 'harm.type', includes: 'assault', event: 2 } },
      { has: { field: 'harm.time', includes: { ko: '2024', en: '2024', fr: '2024', ru: '2024', ar: ['2024', '٢٠٢٤'], fa: ['2024', '۲۰۲۴'] }, event: 2 } },
      { notAnswered: { field: 'harm.reason', event: 2 } },
    ],
  },
  {
    id: 'correction',
    title: '정정: 날짜를 바로잡으면 이전 값이 대체되어야 함',
    turns: story({
      ko: ['저는 정치적 의견 때문에 신청합니다. 2025년 3월쯤 시위에 나갔다가 경찰서로 끌려가 조사를 받았습니다.',
        '아까 3월이라고 했는데 잘못 말했습니다. 4월이었습니다.'],
      en: ['I am applying because of my political opinion. Around March 2025 I went to a protest and was taken to a police station and questioned.',
        'Earlier I said March, but that was wrong. It was April.'],
      fr: ["Je fais ma demande en raison de mes opinions politiques. Vers mars 2025, je suis allé à une manifestation, puis on m'a emmené au commissariat et on m'a interrogé.",
        "Tout à l'heure j'ai dit mars, mais je me suis trompé. C'était en avril."],
      ru: ['Я подаю заявление из-за своих политических взглядов. Примерно в марте 2025 года я пошёл на протест, и меня забрали в полицейский участок и допросили.',
        'Я сказал раньше, что это был март, но ошибся. Это был апрель.'],
      ar: ['أتقدم بالطلب بسبب رأيي السياسي. في مارس 2025 تقريبًا شاركت في مظاهرة، ثم اقتادوني إلى مركز الشرطة واستجوبوني.',
        'قلت قبل قليل مارس، لكنني أخطأت. كان ذلك في أبريل.'],
      fa: ['من به خاطر عقیده سیاسی‌ام درخواست می‌دهم. حدود مارس ۲۰۲۵ به یک تظاهرات رفتم و مرا به کلانتری بردند و بازجویی کردند.',
        'قبلاً گفتم مارس، اما اشتباه گفتم. آوریل بود.'],
    }),
    checks: [
      { events: { group: 'harm', count: 1 } },
      { has: { field: 'harm.time', includes: { ko: '4월', en: 'April', fr: 'avril', ru: 'апрел', ar: ['أبريل', 'نيسان'], fa: 'آوریل' } } },
      { lacks: { field: 'harm.time', includes: { ko: '3월', en: 'March', fr: 'mars', ru: 'март', ar: ['مارس', 'آذار'], fa: 'مارس' } } },
    ],
    draft: [{ question: '14.2', has: ['4월'], lacks: ['3월'] }],
  },
  {
    id: 'refinement',
    title: '구체화: 더 자세히 다시 말한 내용은 충돌이 아니라 갱신',
    turns: story({
      ko: ['저는 정치적 의견 때문에 신청합니다. 작년에 경찰이 제 집에 와서 저를 위협했습니다.',
        '그 집은 가상의 도시 B에 있는 우리 가족 아파트였습니다.'],
      en: ['I am applying because of my political opinion. Last year the police came to my house and threatened me.',
        "That house was our family's apartment in the fictional city B."],
      fr: ["Je fais ma demande en raison de mes opinions politiques. L'année dernière, la police est venue chez moi et m'a menacé.",
        "Ce logement était l'appartement de ma famille, dans la ville fictive B."],
      ru: ['Я подаю заявление из-за своих политических взглядов. В прошлом году полиция пришла ко мне домой и угрожала мне.',
        'Это была квартира нашей семьи в вымышленном городе B.'],
      ar: ['أتقدم بالطلب بسبب رأيي السياسي. في العام الماضي جاءت الشرطة إلى بيتي وهددتني.',
        'كان ذلك البيت شقة عائلتنا في المدينة الخيالية B.'],
      fa: ['من به خاطر عقیده سیاسی‌ام درخواست می‌دهم. پارسال پلیس به خانه‌ام آمد و مرا تهدید کرد.',
        'آن خانه آپارتمان خانواده‌مان در شهر خیالی B بود.'],
    }),
    checks: [
      { events: { group: 'harm', count: 1 } },
      { has: { field: 'harm.place', includes: { ko: '도시 B', en: 'city B', fr: ['ville fictive B', 'ville B'], ru: ['городе B', 'город B'], ar: ['المدينة الخيالية B', 'مدينة B', 'المدينة B'], fa: ['شهر خیالی B', 'شهر B'] } } },
      { status: { field: 'harm.place', in: ['answered'] } },
    ],
  },
  {
    id: 'hearsay-family',
    title: '전해 들은 가족 피해: 본인 사건과 분리, 전해 들음으로 기록',
    turns: story({
      ko: ['저는 소수민족이라는 이유로 보호를 신청합니다. 저 자신은 직접 피해를 입은 적은 없습니다.',
        '하지만 제 형은 2024년에 같은 민족 모임에 갔다가 군인들에게 끌려가 일주일 동안 갇혀 있었다고 어머니에게 전화로 들었습니다.'],
      en: ['I am applying for protection because I belong to an ethnic minority. I myself have never been directly harmed.',
        'But my mother told me on the phone that in 2024 my older brother went to a meeting of our ethnic group and was taken away by soldiers and locked up for a week.'],
      fr: ["Je demande une protection parce que j'appartiens à une minorité ethnique. Moi-même, je n'ai jamais subi de préjudice directement.",
        "Mais ma mère m'a dit au téléphone qu'en 2024 mon grand frère était allé à une réunion de notre communauté et que des soldats l'avaient emmené et enfermé pendant une semaine."],
      ru: ['Я прошу защиты, потому что принадлежу к этническому меньшинству. Сам я напрямую никогда не пострадал.',
        'Но мама рассказала мне по телефону, что в 2024 году мой старший брат пошёл на собрание нашей общины, и солдаты забрали его и неделю держали взаперти.'],
      ar: ['أطلب الحماية لأنني أنتمي إلى أقلية عرقية. لم أتعرض أنا شخصيًا لأي أذى مباشر.',
        'لكن أمي أخبرتني عبر الهاتف أن أخي الأكبر ذهب في عام 2024 إلى اجتماع لأبناء جماعتنا، فاقتاده جنود واحتجزوه لمدة أسبوع.'],
      fa: ['من به این دلیل که از یک اقلیت قومی هستم درخواست حمایت می‌کنم. خودم هیچ‌وقت مستقیماً آسیبی ندیده‌ام.',
        'اما مادرم تلفنی به من گفت که برادر بزرگم در سال ۲۰۲۴ به یک گردهمایی قوم ما رفته بود و سربازها او را بردند و یک هفته زندانی کردند.'],
    }),
    checks: [
      { gate: { gate: 'harm', value: 'no' } },
      { events: { group: 'harm', count: 0 } },
      { gate: { gate: 'family_harm', value: 'yes' } },
      { events: { group: 'family_harm', count: 1 } },
      { has: { field: 'family_harm.person', includes: { ko: '형', en: 'brother', fr: 'frère', ru: 'брат', ar: 'أخ', fa: 'برادر' } } },
      // Hearsay must not be recorded as something the applicant saw.
      { knowledge: { field: 'family_harm.event', in: ['heard'], safety: true } },
      { derived: { id: '14.4', value: '예' } },
    ],
  },
  {
    id: 'narrow-denial',
    title: '좁은 부정: "때리거나 가두진 않았다"가 피해 없음이 되면 안 됨',
    turns: story({
      ko: ['저는 정치적 의견 때문에 신청합니다. 경찰이 저를 때리거나 가두지는 않았습니다. 다만 2024년 여름에 세 번 정도 경찰서에 불려가 제가 속한 정당 활동에 대해 조사를 받았고, 계속하면 가만두지 않겠다는 말을 들었습니다.'],
      en: ['I am applying because of my political opinion. The police did not beat me or lock me up. But in the summer of 2024 I was summoned to the police station about three times and questioned about my activities in my party, and I was told they would not leave me alone if I continued.'],
      fr: ["Je fais ma demande en raison de mes opinions politiques. La police ne m'a ni frappé ni enfermé. Mais à l'été 2024, j'ai été convoqué environ trois fois au commissariat et interrogé sur mes activités dans mon parti, et on m'a dit que si je continuais, on ne me laisserait pas tranquille."],
      ru: ['Я подаю заявление из-за своих политических взглядов. Полиция меня не била и не сажала под арест. Но летом 2024 года меня примерно три раза вызывали в полицейский участок и допрашивали о моей работе в партии, и сказали, что если я продолжу, мне это так не сойдёт.'],
      ar: ['أتقدم بالطلب بسبب رأيي السياسي. لم تضربني الشرطة ولم تحتجزني. لكن في صيف 2024 استُدعيت إلى مركز الشرطة نحو ثلاث مرات واستُجوبت بشأن نشاطي في حزبي، وقيل لي إنني إذا واصلت فلن يتركوني وشأني.'],
      fa: ['من به خاطر عقیده سیاسی‌ام درخواست می‌دهم. پلیس مرا نزد و زندانی نکرد. اما در تابستان ۲۰۲۴ حدود سه بار به کلانتری احضار شدم و درباره فعالیتم در حزبم از من بازجویی کردند و به من گفتند اگر ادامه بدهم، ولم نمی‌کنند.'],
    }),
    checks: [
      { gate: { gate: 'harm', value: 'yes' } },
      { has: { field: 'harm.type', includes: 'questioning' } },
      { lacks: { field: 'harm.type', includes: 'assault' } },
      { lacks: { field: 'harm.type', includes: 'detention' } },
      { derived: { id: '14.2', value: '예' } },
    ],
  },
  {
    id: 'unknown-and-refusal',
    title: '모름·말하기 어려움: 추측하지 않고 그대로 기록',
    turns: story({
      ko: ['저는 종교 때문에 신청합니다. 경찰에 붙잡혀 간 적이 있는데 정확히 언제였는지는 기억나지 않습니다.',
        '붙잡혀 있는 동안 있었던 일은 지금은 말하고 싶지 않습니다.'],
      en: ["I am applying because of my religion. I was once taken away by the police, but I don't remember exactly when it was.",
        "I don't want to talk right now about what happened while I was held."],
      fr: ["Je fais ma demande en raison de ma religion. J'ai déjà été emmené par la police, mais je ne me souviens pas exactement quand.",
        'Je ne veux pas parler maintenant de ce qui s\'est passé pendant ma détention.'],
      ru: ['Я подаю заявление из-за своей религии. Однажды меня забрала полиция, но я не помню, когда именно это было.',
        'О том, что происходило, пока меня держали, я сейчас не хочу говорить.'],
      ar: ['أتقدم بالطلب بسبب ديني. اقتادتني الشرطة ذات مرة، لكنني لا أتذكر متى كان ذلك بالضبط.',
        'لا أريد الآن أن أتحدث عما حدث أثناء احتجازي.'],
      fa: ['من به خاطر دینم درخواست می‌دهم. یک بار پلیس مرا گرفت و برد، اما دقیقاً یادم نیست کی بود.',
        'درباره اتفاقاتی که در مدت بازداشت افتاد، الان نمی‌خواهم صحبت کنم.'],
    }),
    checks: [
      { gate: { gate: 'harm', value: 'yes' } },
      // A date the applicant does not remember must not be invented.
      { status: { field: 'harm.time', in: ['unknown'], safety: true } },
      { lacks: { field: 'harm.event', includes: { ko: '말하고 싶지', en: 'want to talk', fr: 'veux pas parler', ru: 'не хочу говорить', ar: 'لا أريد', fa: 'نمی‌خواهم' } } },
    ],
    draft: [{ question: '14.2', has: ['기억'] }],
  },
  {
    id: 'no-category',
    title: '사유 범주를 추정하지 않음: 신청인이 이유를 모를 때',
    turns: story({
      ko: ['무장한 사람들이 우리 마을에 와서 집을 불태웠고, 저도 위협을 받아 도망쳤습니다. 왜 우리 마을이 공격받았는지는 잘 모르겠습니다.'],
      en: ["Armed men came to our village and burned houses, and I was threatened too, so I fled. I don't really know why our village was attacked."],
      fr: ["Des hommes armés sont venus dans notre village et ont brûlé des maisons ; j'ai moi aussi été menacé et je me suis enfui. Je ne sais pas vraiment pourquoi notre village a été attaqué."],
      ru: ['Вооружённые люди пришли в нашу деревню и сожгли дома, мне тоже угрожали, и я бежал. Я не очень понимаю, почему напали на нашу деревню.'],
      ar: ['جاء رجال مسلحون إلى قريتنا وأحرقوا البيوت، وتعرضت أنا أيضًا للتهديد فهربت. لا أعرف حقًا لماذا تعرضت قريتنا للهجوم.'],
      fa: ['مردان مسلح به روستای ما آمدند و خانه‌ها را آتش زدند و مرا هم تهدید کردند و فرار کردم. واقعاً نمی‌دانم چرا به روستای ما حمله کردند.'],
    }),
    checks: [
      { notAnswered: { field: 'grounds.category' } },
      { gate: { gate: 'harm', value: 'yes' } },
      { notAnswered: { field: 'harm.reason' } },
    ],
  },
  {
    id: 'protection-relocation',
    title: '보호 요청을 안 한 이유와 국내 피신',
    turns: story({
      ko: ['저는 정치적 의견 때문에 신청합니다. 2024년에 시위에 참여한 뒤 경찰에게 위협을 받았습니다.',
        '경찰이 위협한 당사자라서 경찰에 도움을 요청할 수 없었습니다. 그래서 2024년 10월에 다른 도시의 삼촌 집으로 피신했는데, 두 달 뒤 경찰이 그곳에도 저를 찾으러 와서 다시 떠나야 했습니다.'],
      en: ['I am applying because of my political opinion. In 2024, after I took part in a protest, I was threatened by the police.',
        "I could not ask the police for help because they were the ones threatening me. So in October 2024 I hid at my uncle's house in another city, but two months later the police came looking for me there too, and I had to leave again."],
      fr: ["Je fais ma demande en raison de mes opinions politiques. En 2024, après avoir participé à une manifestation, j'ai été menacé par la police.",
        "Je ne pouvais pas demander l'aide de la police, puisque c'était elle qui me menaçait. Alors en octobre 2024 je me suis réfugié chez mon oncle dans une autre ville, mais deux mois plus tard la police est venue me chercher là-bas aussi et j'ai dû repartir."],
      ru: ['Я подаю заявление из-за своих политических взглядов. В 2024 году, после того как я участвовал в протесте, мне угрожала полиция.',
        'Я не мог обратиться за помощью в полицию, потому что угрожала мне именно она. Поэтому в октябре 2024 года я укрылся у дяди в другом городе, но через два месяца полиция пришла искать меня и туда, и мне пришлось снова уехать.'],
      ar: ['أتقدم بالطلب بسبب رأيي السياسي. في عام 2024، بعد أن شاركت في مظاهرة، تلقيت تهديدات من الشرطة.',
        'لم أستطع أن أطلب المساعدة من الشرطة لأنها هي التي كانت تهددني. لذلك لجأت في أكتوبر 2024 إلى بيت عمي في مدينة أخرى، لكن بعد شهرين جاءت الشرطة تبحث عني هناك أيضًا، فاضطررت إلى الرحيل مرة أخرى.'],
      fa: ['من به خاطر عقیده سیاسی‌ام درخواست می‌دهم. در سال ۲۰۲۴ بعد از اینکه در یک تظاهرات شرکت کردم، پلیس مرا تهدید کرد.',
        'نمی‌توانستم از پلیس کمک بخواهم چون خود پلیس مرا تهدید می‌کرد. برای همین در اکتبر ۲۰۲۴ به خانه عمویم در شهر دیگری پناه بردم، اما دو ماه بعد پلیس آنجا هم دنبالم آمد و مجبور شدم دوباره بروم.'],
    }),
    checks: [
      // "I could not ask the police" must never become "I asked for protection" (negation inversion).
      { gate: { gate: 'protection', value: 'no', safety: true } },
      { has: { field: 'protection.no_reason', includes: { ko: '경찰', en: 'police', fr: 'police', ru: 'полиц', ar: 'شرطة', fa: 'پلیس' } } },
      { gate: { gate: 'relocation', value: 'yes' } },
      { events: { group: 'relocation', count: 1 } },
      { has: { field: 'relocation.destination', includes: { ko: '삼촌', en: 'uncle', fr: 'oncle', ru: 'дяд', ar: 'عمي', fa: 'عمو' } } },
      { derived: { id: '14.5', value: '아니요', safety: true } },
      { derived: { id: '14.6', value: '예' } },
    ],
  },
  {
    id: 'children',
    title: '자녀 동반: 자녀별로 나이와 관계',
    turns: story({
      ko: ['저는 종교 때문에 신청합니다. 이번 신청은 8살 딸과 함께 했습니다. 아이 아빠인 남편도 한국에 같이 있습니다.'],
      en: ['I am applying because of my religion. I made this application together with my 8-year-old daughter. My husband, her father, is also here in Korea with us.'],
      fr: ["Je fais ma demande en raison de ma religion. J'ai déposé cette demande avec ma fille de 8 ans. Mon mari, son père, est aussi avec nous en Corée."],
      ru: ['Я подаю заявление из-за своей религии. Я подала это заявление вместе с дочерью, ей 8 лет. Мой муж, отец ребёнка, тоже здесь, в Корее.'],
      ar: ['أتقدم بالطلب بسبب ديني. قدّمت هذا الطلب مع ابنتي البالغة من العمر 8 سنوات. وزوجي، والد الطفلة، موجود معنا أيضًا في كوريا.'],
      fa: ['من به خاطر دینم درخواست می‌دهم. این درخواست را همراه دختر ۸ ساله‌ام داده‌ام. شوهرم، پدر بچه، هم اینجا در کره با ماست.'],
    }),
    checks: [
      { gate: { gate: 'minor', value: 'yes' } },
      { events: { group: 'minor', count: 1 } },
      { has: { field: 'minor.age', includes: { ko: '8', en: '8', fr: '8', ru: '8', ar: ['8', '٨'], fa: ['8', '۸'] } } },
      { has: { field: 'minor.role', includes: 'both_parents' } },
    ],
  },
];
