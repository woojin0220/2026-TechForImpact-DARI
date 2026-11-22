"""Invented screening examples, not applicant records or native-reviewed evaluation data.

[[type|text]] marks each expected occurrence. Event dates are deliberately unmarked.
Sensitive attributes are evaluated separately from the common identifier taxonomy.
"""
import re

MARKER = re.compile(r"\[\[([a-z_]+)\|([^\]]+)\]\]")

EXAMPLES = {
    "ko": [
        "제 이름은 [[person|김하린]]입니다. 이메일은 [[email|harin.kim@example.org]]이고 전화번호는 [[phone|010-4827-1936]]입니다.",
        "제 생년월일은 [[dob|1991년 8월 17일]]이고 여권번호는 [[passport|M73829164]]입니다.",
        "저는 [[address|서울시 가상구 새봄로 27번길 14, 302호]]에 살고 있습니다. 제 형 [[person|김도윤]]은 다른 곳에 삽니다.",
        "2024년 3월 12일 경찰이 집에 왔습니다. 저는 체포되거나 구금되지 않았고, 정확한 시간은 기억나지 않습니다.",
        "[[person|레일라 누리]]가 저를 도왔습니다. 다음 날 [[person|레일라 누리]]에게 전화했습니다. 친구 [[person|사미르 하산]]도 함께 있었습니다.",
        "[[person|박서윤]]의 연락처가 바뀌었습니다. 이전 이메일 [[email|old.seoyun@example.org]] 대신 [[email|new.seoyun@example.org]]를 사용합니다.",
        "저는 [[religion|기독교]]로 개종했습니다. [[political|새빛당]]에서 활동했고 [[medical|외상 후 스트레스 장애]] 진단을 받았습니다.",
    ],
    "en": [
        "My name is [[person|Leila Nouri]]. My email is [[email|leila.nouri@example.org]] and my phone number is [[phone|+44 7700 900123]].",
        "My date of birth is [[dob|17 August 1991]] and my passport number is [[passport|P73829164]].",
        "I live at [[address|14 Willow Lane, Flat 302, London]]. My brother [[person|Samir Hassan]] lives elsewhere.",
        "On 12 March 2024 the police came to my home. I was not arrested or detained, and I do not remember the exact time.",
        "[[person|Leila Nouri]] helped me. The next day I called [[person|Leila Nouri]]. My friend [[person|Samir Hassan]] was also there.",
        "[[person|Mariam Farah]] changed her contact details. She now uses [[email|new.mariam@example.org]] instead of [[email|old.mariam@example.org]].",
        "I converted to [[religion|Christianity]]. I was active in the [[political|New Dawn Party]] and was diagnosed with [[medical|post-traumatic stress disorder]].",
    ],
    "fr": [
        "Je m'appelle [[person|Leïla Nouri]]. Mon adresse électronique est [[email|leila.nouri@example.org]] et mon numéro de téléphone est [[phone|+33 6 12 34 56 78]].",
        "Ma date de naissance est le [[dob|17 août 1991]] et mon numéro de passeport est [[passport|P73829164]].",
        "J'habite au [[address|14 rue des Saules, appartement 302, Lyon]]. Mon frère [[person|Samir Hassan]] habite ailleurs.",
        "Le 12 mars 2024, la police est venue chez moi. Je n'ai été ni arrêté ni détenu et je ne me souviens pas de l'heure exacte.",
        "[[person|Leïla Nouri]] m'a aidé. Le lendemain, j'ai appelé [[person|Leïla Nouri]]. Mon ami [[person|Samir Hassan]] était aussi présent.",
        "[[person|Mariam Farah]] a changé de coordonnées. Elle utilise [[email|new.mariam@example.org]] au lieu de [[email|old.mariam@example.org]].",
        "Je me suis converti au [[religion|christianisme]]. Je militais au [[political|Parti de l'Aube Nouvelle]] et on m'a diagnostiqué un [[medical|trouble de stress post-traumatique]].",
    ],
    "ru": [
        "Меня зовут [[person|Лейла Нури]]. Моя электронная почта — [[email|leila.nouri@example.org]], а номер телефона — [[phone|+7 912 345-67-89]].",
        "Моя дата рождения — [[dob|17 августа 1991 года]], номер паспорта — [[passport|P73829164]].",
        "Я живу по адресу: [[address|Москва, улица Ивовая, дом 14, квартира 302]]. Мой брат [[person|Самир Хасан]] живёт в другом месте.",
        "12 марта 2024 года полиция пришла ко мне домой. Меня не арестовывали и не задерживали, а точного времени я не помню.",
        "[[person|Лейла Нури]] помогла мне. На следующий день я позвонил ей; [[person|Лейла Нури]] ответила. Мой друг [[person|Самир Хасан]] тоже был там.",
        "[[person|Мариам Фарах]] сменила контакты. Теперь она использует [[email|new.mariam@example.org]] вместо [[email|old.mariam@example.org]].",
        "Я принял [[religion|христианство]]. Я участвовал в деятельности [[political|Партии нового рассвета]], и у меня диагностировали [[medical|посттравматическое стрессовое расстройство]].",
    ],
    "ar": [
        "اسمي [[person|ليلى نوري]]. بريدي الإلكتروني هو [[email|leila.nouri@example.org]] ورقم هاتفي هو [[phone|+962 7 9000 1234]].",
        "تاريخ ميلادي هو [[dob|١٧ أغسطس ١٩٩١]] ورقم جواز سفري هو [[passport|P73829164]].",
        "أسكن في [[address|عمّان، شارع الصفصاف ١٤، شقة ٣٠٢]]. أخي [[person|سمير حسن]] يسكن في مكان آخر.",
        "في ١٢ مارس ٢٠٢٤ جاءت الشرطة إلى منزلي. لم يتم اعتقالي أو احتجازي ولا أتذكر الوقت بالتحديد.",
        "ساعدتني [[person|ليلى نوري]]. في اليوم التالي اتصلت بها وأجابت [[person|ليلى نوري]]. كان صديقي [[person|سمير حسن]] هناك أيضاً.",
        "غيّرت [[person|مريم فرح]] بيانات الاتصال بها. تستخدم الآن [[email|new.mariam@example.org]] بدلاً من [[email|old.mariam@example.org]].",
        "اعتنقت [[religion|المسيحية]]. كنت ناشطاً في [[political|حزب الفجر الجديد]] وتم تشخيصي بمرض [[medical|اضطراب ما بعد الصدمة]].",
    ],
    "fa": [
        "نام من [[person|لیلا نوری]] است. ایمیل من [[email|leila.nouri@example.org]] و شماره تلفن من [[phone|+98 912 345 6789]] است.",
        "تاریخ تولد من [[dob|۱۷ اوت ۱۹۹۱]] و شماره گذرنامه من [[passport|P73829164]] است.",
        "من در [[address|تهران، خیابان بید، پلاک ۱۴، واحد ۳۰۲]] زندگی می‌کنم. برادرم [[person|سمیر حسن]] جای دیگری زندگی می‌کند.",
        "در ۱۲ مارس ۲۰۲۴ پلیس به خانه‌ام آمد. من بازداشت یا زندانی نشدم و ساعت دقیق را به یاد ندارم.",
        "[[person|لیلا نوری]] به من کمک کرد. روز بعد با او تماس گرفتم و [[person|لیلا نوری]] پاسخ داد. دوستم [[person|سمیر حسن]] هم آنجا بود.",
        "[[person|مریم فرح]] اطلاعات تماسش را تغییر داد. اکنون از [[email|new.mariam@example.org]] به جای [[email|old.mariam@example.org]] استفاده می‌کند.",
        "من به [[religion|مسیحیت]] گرویدم. در [[political|حزب سپیده نو]] فعالیت داشتم و [[medical|اختلال استرس پس از سانحه]] در من تشخیص داده شد.",
    ],
}


def cases():
    result = []
    for language, examples in EXAMPLES.items():
        for index, marked in enumerate(examples):
            parts, gold, cursor, length = [], [], 0, 0
            for match in MARKER.finditer(marked):
                plain = marked[cursor:match.start()]
                parts.extend([plain, match[2]])
                length += len(plain)
                gold.append({"start": length, "end": length + len(match[2]), "label": match[1]})
                length += len(match[2])
                cursor = match.end()
            parts.append(marked[cursor:])
            result.append({"id": f"{language}-{index + 1}", "language": language,
                           "track": "sensitive" if index == 6 else "identifiers",
                           "text": "".join(parts), "gold": gold})
    return result
