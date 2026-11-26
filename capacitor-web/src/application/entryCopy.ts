const copies:Record<string,string[]>={
 ko:['내 언어로 쓰고,\n뜻을 확인하는 신청서.','필요한 문항부터 작성하고,\n원본 서식과 함께 확인하세요.','작성 시작하기'],
 en:['Write in your language.\nCheck the meaning.','Start with the questions you need,\nand check the original form alongside.','Start writing'],
 fr:['Écrivez dans votre langue.\nVérifiez le sens.','Commencez par les questions utiles,\net consultez le formulaire original.','Commencer'],
 ru:['Пишите на своём языке.\nПроверяйте смысл.','Начните с нужных вопросов\nи сверяйтесь с оригиналом формы.','Начать заполнение'],
 ar:['اكتب بلغتك،\nوتحقق من المعنى.','ابدأ بالأسئلة التي تحتاجها،\nوراجع النموذج الأصلي معها.','ابدأ الكتابة'],
 fa:['به زبان خود بنویسید،\nمعنا را بررسی کنید.','از پرسش‌های مورد نیاز شروع کنید\nو فرم اصلی را هم بررسی کنید.','شروع نوشتن']
};
export const applicationEntryCopy=(language:string)=>copies[language]??copies.en;
