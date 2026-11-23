"""Expanded synthetic screening, frozen before running the new candidates.

Original 42 examples are unchanged. KEEP annotations explicitly test that incident
dates/negation are retained. No examples describe real applicants. The long texts
repeat neutral filler to stress input length, not to simulate natural language diversity.
"""
from fixtures import cases as original_cases, MARKER

EXTRA = {
    "ko": [
        ("code_switch", "제 이름은 [[person|오마르 알카림]]이고 여권에는 [[person|Omar Al-Karim]]으로 적혀 있습니다. 연락처는 [[email|omar.alkarim@example.org]]입니다."),
        ("noisy", "이름: [[person|남궁혜린]] / 여권: [[passport|N64918372]] / 이메일: [[email|hye.rin+case@example.org]]. 성을 [[person|남궁]], 이름을 [[person|혜린]]으로 읽어 주세요."),
        ("dob_event", "저는 [[dob|1987년 2월 9일]]에 태어났습니다. [[keep|2023년 11월 4일]] 조사를 받았지만 [[keep|구금되지는 않았습니다]]."),
        ("sensitive", "저의 배우자는 [[religion|불교]] 신자입니다. 저는 [[political|민주연합당]]을 지지한다는 이유로 위협받았습니다. 제 동생은 [[medical|간질]] 치료를 받습니다."),
        ("negative", "[[keep|경찰]]인지 확실하지 않습니다. [[keep|2024년 6월]]에 세 명을 봤으며 [[keep|직접 폭행당한 적은 없습니다]]."),
        ("long", "제 이름은 [[person|정유나]]입니다. {FILLER} 기록에 따르면 조력자는 [[person|아미르 라히미]]입니다. {FILLER} 마지막 연락 이메일은 [[email|yuna.final@example.org]]입니다."),
        ("boundary", "{BOUNDARY} 연락 이메일: [[email|boundary.contact+27@example.org]]. 확인 담당자는 [[person|서지후]]입니다."),
        ("date_only", "[[keep|2022년 9월 18일]] 집을 떠났고 [[keep|2023년 1월 7일]] 입국했습니다. 이것은 생년월일이 아니라 사건 날짜입니다."),
    ],
    "en": [
        ("code_switch", "My name is [[person|Omar Al-Karim]], written [[person|عمر الكريم]] on another document. Please contact [[email|omar.alkarim@example.org]]."),
        ("noisy", "Name: [[person|Nadya Petrova]]; passport: [[passport|N64918372]]; e-mail: [[email|nadya.p+case@example.org]]. A scanned note spells her name [[person|Nadya Pet rova]]."),
        ("dob_event", "I was born on [[dob|9 February 1987]]. I was questioned on [[keep|4 November 2023]], but [[keep|I was not detained]]."),
        ("sensitive", "My spouse follows [[religion|Buddhism]]. I was threatened for supporting the [[political|Democratic Alliance Party]]. My brother is being treated for [[medical|epilepsy]]."),
        ("negative", "I am not sure whether they were [[keep|police officers]]. I saw three people in [[keep|June 2024]] and [[keep|I was never directly assaulted]]."),
        ("long", "My name is [[person|Nadya Petrova]]. {FILLER} The person who helped was [[person|Amir Rahimi]]. {FILLER} My final contact email is [[email|nadya.final@example.org]]."),
        ("boundary", "{BOUNDARY} Contact email: [[email|boundary.contact+27@example.org]]. The reviewer is [[person|Jonas Mirek]]."),
        ("date_only", "I left home on [[keep|18 September 2022]] and entered the country on [[keep|7 January 2023]]. These are incident dates, not my date of birth."),
    ],
    "fr": [
        ("code_switch", "Je m'appelle [[person|Omar Al-Karim]], écrit [[person|عمر الكريم]] sur un autre document. Contactez [[email|omar.alkarim@example.org]]."),
        ("noisy", "Nom : [[person|Nadia Petrova]] ; passeport : [[passport|N64918372]] ; courriel : [[email|nadia.p+case@example.org]]. Une note scannée écrit son nom [[person|Nadia Pet rova]]."),
        ("dob_event", "Je suis née le [[dob|9 février 1987]]. J'ai été interrogée le [[keep|4 novembre 2023]], mais [[keep|je n'ai pas été détenue]]."),
        ("sensitive", "Mon conjoint pratique le [[religion|bouddhisme]]. J'ai été menacée pour mon soutien au [[political|Parti de l'Alliance démocratique]]. Mon frère est traité pour [[medical|épilepsie]]."),
        ("negative", "Je ne sais pas si c'étaient des [[keep|policiers]]. J'ai vu trois personnes en [[keep|juin 2024]] et [[keep|je n'ai jamais été directement agressée]]."),
        ("long", "Je m'appelle [[person|Nadia Petrova]]. {FILLER} La personne qui m'a aidée était [[person|Amir Rahimi]]. {FILLER} Mon dernier courriel est [[email|nadia.final@example.org]]."),
        ("boundary", "{BOUNDARY} Courriel de contact : [[email|boundary.contact+27@example.org]]. Le réviseur est [[person|Jonas Mirek]]."),
        ("date_only", "J'ai quitté mon domicile le [[keep|18 septembre 2022]] et je suis entrée dans le pays le [[keep|7 janvier 2023]]. Ce sont des dates d'événements, pas ma date de naissance."),
    ],
    "ru": [
        ("code_switch", "Меня зовут [[person|Омар Аль-Карим]], в другом документе написано [[person|Omar Al-Karim]]. Мой адрес почты: [[email|omar.alkarim@example.org]]."),
        ("noisy", "Имя: [[person|Надя Петрова]]; паспорт: [[passport|N64918372]]; почта: [[email|nadya.p+case@example.org]]. В скане имя записано как [[person|Надя Пет рова]]."),
        ("dob_event", "Я родилась [[dob|9 февраля 1987 года]]. Меня допрашивали [[keep|4 ноября 2023 года]], но [[keep|меня не задерживали]]."),
        ("sensitive", "Мой супруг исповедует [[religion|буддизм]]. Мне угрожали за поддержку [[political|Партии демократического альянса]]. Мой брат лечится от [[medical|эпилепсии]]."),
        ("negative", "Я не уверена, были ли они [[keep|полицейскими]]. Я видела трёх человек в [[keep|июне 2024 года]], и [[keep|я никогда не подвергалась прямому нападению]]."),
        ("long", "Меня зовут [[person|Надя Петрова]]. {FILLER} Мне помог [[person|Амир Рахими]]. {FILLER} Мой последний адрес почты: [[email|nadya.final@example.org]]."),
        ("boundary", "{BOUNDARY} Контактная почта: [[email|boundary.contact+27@example.org]]. Проверяющий: [[person|Йонас Мирек]]."),
        ("date_only", "Я покинула дом [[keep|18 сентября 2022 года]] и въехала в страну [[keep|7 января 2023 года]]. Это даты событий, а не дата моего рождения."),
    ],
    "ar": [
        ("code_switch", "اسمي [[person|عمر الكريم]]، ويُكتب [[person|Omar Al-Karim]] في وثيقة أخرى. بريدي هو [[email|omar.alkarim@example.org]]."),
        ("noisy", "الاسم: [[person|نادية بتروفا]]؛ جواز السفر: [[passport|N64918372]]؛ البريد: [[email|nadia.p+case@example.org]]. في الصورة كُتب الاسم [[person|نادية بتر وفا]]."),
        ("dob_event", "وُلدت في [[dob|٩ فبراير ١٩٨٧]]. تم استجوابي في [[keep|٤ نوفمبر ٢٠٢٣]]، لكن [[keep|لم يتم احتجازي]]."),
        ("sensitive", "زوجي يتبع [[religion|البوذية]]. تعرضت للتهديد بسبب دعمي [[political|لحزب التحالف الديمقراطي]]. يتلقى أخي العلاج من [[medical|الصرع]]."),
        ("negative", "لست متأكدة إن كانوا [[keep|رجال شرطة]]. رأيت ثلاثة أشخاص في [[keep|يونيو ٢٠٢٤]]، و[[keep|لم أتعرض لاعتداء مباشر قط]]."),
        ("long", "اسمي [[person|نادية بتروفا]]. {FILLER} الشخص الذي ساعدني هو [[person|أمير رحيمي]]. {FILLER} بريدي الأخير هو [[email|nadia.final@example.org]]."),
        ("boundary", "{BOUNDARY} البريد للتواصل: [[email|boundary.contact+27@example.org]]. المراجع هو [[person|يوناس ميريك]]."),
        ("date_only", "غادرت منزلي في [[keep|١٨ سبتمبر ٢٠٢٢]] ودخلت البلاد في [[keep|٧ يناير ٢٠٢٣]]. هذه تواريخ أحداث وليست تاريخ ميلادي."),
    ],
    "fa": [
        ("code_switch", "نام من [[person|عمر الکریم]] است و در سند دیگری [[person|Omar Al-Karim]] نوشته شده است. ایمیل من [[email|omar.alkarim@example.org]] است."),
        ("noisy", "نام: [[person|نادیا پترووا]]؛ گذرنامه: [[passport|N64918372]]؛ ایمیل: [[email|nadia.p+case@example.org]]. در اسکن نام به صورت [[person|نادیا پتر ووا]] آمده است."),
        ("dob_event", "من در [[dob|۹ فوریه ۱۹۸۷]] به دنیا آمدم. در [[keep|۴ نوامبر ۲۰۲۳]] از من بازجویی شد، ولی [[keep|بازداشت نشدم]]."),
        ("sensitive", "همسر من پیرو [[religion|آیین بودا]] است. به دلیل حمایت از [[political|حزب اتحاد دموکراتیک]] تهدید شدم. برادرم برای [[medical|صرع]] درمان می‌شود."),
        ("negative", "مطمئن نیستم که آنها [[keep|مأمور پلیس]] بودند. در [[keep|ژوئن ۲۰۲۴]] سه نفر را دیدم و [[keep|هرگز مستقیماً مورد حمله قرار نگرفتم]]."),
        ("long", "نام من [[person|نادیا پترووا]] است. {FILLER} شخصی که به من کمک کرد [[person|امیر رحیمی]] بود. {FILLER} آخرین ایمیل من [[email|nadia.final@example.org]] است."),
        ("boundary", "{BOUNDARY} ایمیل تماس: [[email|boundary.contact+27@example.org]]. بازبین [[person|یوناس میرک]] است."),
        ("date_only", "در [[keep|۱۸ سپتامبر ۲۰۲۲]] خانه را ترک کردم و در [[keep|۷ ژانویه ۲۰۲۳]] وارد کشور شدم. اینها تاریخ رویداد هستند، نه تاریخ تولد من."),
    ],
}

FILLER = {
    "ko": "그때 있었던 일을 순서대로 설명하려고 합니다. 정확하지 않은 부분은 모른다고 말하겠습니다. 다른 사람에게 들은 내용과 직접 본 내용을 구분하겠습니다. ",
    "en": "I am trying to describe what happened in order. I will say when I do not remember a detail. I will distinguish what I saw myself from what other people told me. ",
    "fr": "J'essaie de décrire les faits dans l'ordre. Je dirai quand je ne me souviens pas d'un détail. Je distinguerai ce que j'ai vu de ce que les autres m'ont raconté. ",
    "ru": "Я стараюсь описать события по порядку. Я скажу, если не помню подробность. Я буду различать то, что видела сама, и то, что рассказали другие люди. ",
    "ar": "أحاول وصف ما حدث بالترتيب. سأقول عندما لا أتذكر تفصيلاً. سأميز بين ما رأيته بنفسي وما أخبرني به أشخاص آخرون. ",
    "fa": "سعی می‌کنم رویدادها را به ترتیب شرح دهم. اگر جزئیاتی را به یاد نیاورم می‌گویم. آنچه را خودم دیده‌ام از آنچه دیگران گفته‌اند جدا می‌کنم. ",
}


def parse_marked(marked):
    parts, gold, protected, cursor, length = [], [], [], 0, 0
    for match in MARKER.finditer(marked):
        plain = marked[cursor:match.start()]
        parts.extend([plain, match[2]])
        length += len(plain)
        span = {"start": length, "end": length + len(match[2]), "label": match[1]}
        (protected if match[1] == "keep" else gold).append(span)
        length += len(match[2])
        cursor = match.end()
    parts.append(marked[cursor:])
    return "".join(parts), gold, protected


def cases():
    result = [{**row, "group": "original", "protected": []} for row in original_cases()]
    for language, examples in EXTRA.items():
        for group, marked in examples:
            # Approximately 5k chars (varies by language), with identifiers at start/middle/end.
            marked = marked.replace("{FILLER}", FILLER[language] * 18)
            marked = marked.replace("{BOUNDARY}", (FILLER[language] * 4)[:203])
            text, gold, protected = parse_marked(marked)
            result.append({"id": f"{language}-{group}", "language": language, "group": group,
                           "track": "sensitive" if group == "sensitive" else "long" if group in ["long", "boundary"] else "identifiers",
                           "text": text, "gold": gold, "protected": protected})
    return result


def windows(text, size=220, overlap=80):
    """Shared character windows: same input chunks for every model, no truncation."""
    if size <= overlap or overlap < 0:
        raise ValueError("Window size must exceed a nonnegative overlap")
    start = 0
    while start < len(text):
        end = min(start + size, len(text))
        yield start, text[start:end]
        if end == len(text):
            break
        start = end - overlap
