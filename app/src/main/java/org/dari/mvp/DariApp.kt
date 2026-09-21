package org.dari.mvp

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp

private val Teal = Color(0xFF0B6E69)
private val PaleTeal = Color(0xFFE7F4F2)
private val Ink = Color(0xFF17201F)
private val Warning = Color(0xFF9C5B00)
private enum class Screen { START, QUESTION, TRANSLATING, DRAFT, REDACT, VERIFYING, REPORT }
private data class AppLanguage(val label: String, val code: String, val answerLabel: String, val questions: List<String>)
private data class VerificationModel(val name: String, val ollamaModel: String, val detail: String)
private data class DraftEntry(val number: String, val source: String, val english: String, val korean: String)
private val verificationModels = listOf(
    VerificationModel("Qwen3 4B", "qwen3:4b", "Mac에서 실행하는 Qwen3 양자화 모델"),
    VerificationModel("Llama 3.2 3B", "llama3.2:3b", "Mac에서 실행하는 Llama 양자화 모델")
)
private val languages = listOf(
    AppLanguage("Русский", "ru", "Ответ на русском", listOf("Почему Вы просите признать Вас беженцем?", "Опишите, что произошло. Укажите дату, место и связанных лиц, если помните.")),
    AppLanguage("العربية", "ar", "اكتب إجابتك بالعربية", listOf("لماذا تطلب الاعتراف بك كلاجئ؟", "صف ما حدث. اذكر التاريخ والمكان والأشخاص المعنيين إن كنت تتذكر.")),
    AppLanguage("Français", "fr", "Écrivez votre réponse en français", listOf("Pourquoi demandez-vous à être reconnu(e) comme réfugié(e) ?", "Décrivez ce qui s'est passé. Indiquez la date, le lieu et les personnes concernées si vous vous en souvenez.")),
    AppLanguage("فارسی", "fa", "پاسخ خود را به فارسی بنویسید", listOf("چرا درخواست شناسایی به عنوان پناهنده دارید؟", "توضیح دهید چه اتفاقی افتاد. در صورت یادآوری، تاریخ، مکان و افراد مرتبط را ذکر کنید."))
)
private val koreanQuestions = listOf("난민인정을 신청하는 이유를 작성해 주세요.", "어떤 일이 있었는지 날짜, 장소, 관련 인물을 포함해 작성해 주세요.")

@Composable fun DariApp() {
    val translator = remember { TranslationRepository() }; val verifier = remember { VerificationRepository() }
    DisposableEffect(Unit) { onDispose { translator.close() } }
    var screen by remember { mutableStateOf(Screen.START) }; var language by remember { mutableStateOf(languages.first()) }; var model by remember { mutableStateOf(verificationModels.first()) }
    var index by remember { mutableStateOf(0) }; var answer by remember { mutableStateOf("") }; val entries = remember { mutableStateListOf<DraftEntry>() }
    var sourceForServer by remember { mutableStateOf("") }; var englishForServer by remember { mutableStateOf("") }; var report by remember { mutableStateOf<VerificationReport?>(null) }; var error by remember { mutableStateOf<String?>(null) }
    MaterialTheme { Surface(color = Color(0xFFFAFCFB), modifier = Modifier.fillMaxSize()) { Column(Modifier.fillMaxSize()) {
        TopBar(screen, index)
        when (screen) {
            Screen.START -> StartScreen(language, model, error, { language = it }, { model = it }) { error = null; screen = Screen.TRANSLATING; translator.prepare(language.code, { screen = Screen.QUESTION }) { error = "번역 모델을 내려받지 못했습니다. Wi-Fi 연결을 확인해 주세요."; screen = Screen.START } }
            Screen.QUESTION -> QuestionScreen(language, index, answer, error, { answer = it }) {
                if (answer.trim().length < 8) error = "답변을 조금 더 작성해 주세요." else { error = null; screen = Screen.TRANSLATING; translator.translate(answer.trim(), { english, korean ->
                    entries += DraftEntry("14.${index + 1}", answer.trim(), english, korean); answer = ""
                    if (index == koreanQuestions.lastIndex) screen = Screen.DRAFT else { index += 1; screen = Screen.QUESTION }
                }) { error = "기기 내 번역에 실패했습니다. 모델 상태를 확인해 주세요."; screen = Screen.QUESTION } }
            }
            Screen.TRANSLATING -> LoadingScreen("기기에서 영어·한국어 번역을 준비하고 있습니다.")
            Screen.DRAFT -> DraftScreen(entries, language) {
                sourceForServer = SensitiveDataRedactor.redact(entries.joinToString("\n\n") { "[${it.number}]\n${it.source}" })
                englishForServer = SensitiveDataRedactor.redact(entries.joinToString("\n\n") { "[${it.number}]\n${it.english}" })
                screen = Screen.REDACT
            }
            Screen.REDACT -> RedactionScreen(language, model, sourceForServer, englishForServer, { sourceForServer = it }, { englishForServer = it }) { error = null; screen = Screen.VERIFYING; verifier.verify(model.ollamaModel, language.code, sourceForServer, englishForServer, { report = it; screen = Screen.REPORT }) { error = "Mac 로컬 검증 서버와 연결하지 못했습니다."; screen = Screen.REDACT } }
            Screen.VERIFYING -> LoadingScreen("전체 진술의 번역 왜곡 여부를 검증하고 있습니다.")
            Screen.REPORT -> ReportScreen(report, error) { entries.clear(); index = 0; answer = ""; report = null; screen = Screen.QUESTION }
        }
    } } }
}

@Composable private fun TopBar(screen: Screen, index: Int) = Column(Modifier.fillMaxWidth().background(Color.White).padding(20.dp, 14.dp)) {
    Row(verticalAlignment = Alignment.CenterVertically) { Text("DARI", color = Teal, fontWeight = FontWeight.ExtraBold, style = MaterialTheme.typography.titleLarge); Spacer(Modifier.width(10.dp)); Text("신청서 작성 도우미", color = Ink) }
    if (screen == Screen.QUESTION || screen == Screen.TRANSLATING) Text("신청 사유 ${index + 1} / ${koreanQuestions.size}", color = Color.DarkGray, style = MaterialTheme.typography.labelMedium, modifier = Modifier.padding(top = 8.dp))
}
@Composable private fun StartScreen(selected: AppLanguage, selectedModel: VerificationModel, error: String?, onLanguage: (AppLanguage) -> Unit, onModel: (VerificationModel) -> Unit, onStart: () -> Unit) = Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(20.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
    Text("내 언어로 작성하고\n영어·한국어 초안을 확인하세요.", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold, color = Ink)
    languages.chunked(2).forEach { pair -> Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) { pair.forEach { item -> OutlinedButton({ onLanguage(item) }, Modifier.weight(1f)) { Text(if (item == selected) "✓ ${item.label}" else item.label, color = if (item == selected) Teal else Ink) } } } }
    Text("전체 작성 후 검증할 모델", fontWeight = FontWeight.Bold, color = Ink)
    verificationModels.forEach { item -> OutlinedButton({ onModel(item) }, Modifier.fillMaxWidth()) { Column(Modifier.fillMaxWidth()) { Text(if (item == selectedModel) "✓ ${item.name}" else item.name, color = if (item == selectedModel) Teal else Ink); Text(item.detail, style = MaterialTheme.typography.bodySmall, color = Color.DarkGray) } } }
    Notice("진행 방식", "모든 문항을 먼저 작성한 뒤 영어·한국어 병기본을 확인합니다. 이후 전체 진술을 한 번에 검증합니다.")
    Notice("중요", "검증은 번역 과정의 의미 변경만 찾습니다. 진술의 신빙성이나 난민 인정 가능성을 판단하지 않습니다.")
    if (error != null) Text(error, color = Color(0xFFB3261E)); Button(onStart, Modifier.fillMaxWidth(), contentPadding = PaddingValues(16.dp), colors = ButtonDefaults.buttonColors(containerColor = Teal)) { Text("번역 모델 다운로드 후 시작") }
}
@Composable private fun QuestionScreen(language: AppLanguage, index: Int, answer: String, error: String?, onAnswer: (String) -> Unit, onTranslate: () -> Unit) = Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(20.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
    Text("공식 문항 14.${index + 1}", color = Teal, fontWeight = FontWeight.Bold); Text(koreanQuestions[index], style = MaterialTheme.typography.titleLarge, color = Ink)
    Card(colors = CardDefaults.cardColors(containerColor = PaleTeal)) { Column(Modifier.padding(16.dp)) { Text(language.label, color = Teal, fontWeight = FontWeight.Bold); Spacer(Modifier.height(8.dp)); Text(language.questions[index], style = MaterialTheme.typography.titleMedium, color = Ink) } }
    Text("본인의 경험만 작성하고 기억나지 않는 내용은 추정하지 마세요.", color = Warning, style = MaterialTheme.typography.bodySmall)
    OutlinedTextField(answer, onAnswer, Modifier.fillMaxWidth().height(190.dp), label = { Text(language.answerLabel) }); if (error != null) Text(error, color = Color(0xFFB3261E))
    Button(onTranslate, Modifier.fillMaxWidth(), colors = ButtonDefaults.buttonColors(containerColor = Teal)) { Text(if (index == koreanQuestions.lastIndex) "작성 완료" else "저장하고 다음 문항") }
}
@Composable private fun DraftScreen(entries: List<DraftEntry>, language: AppLanguage, onVerify: () -> Unit) = Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(20.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
    Text("영어·한국어 최종 번역본", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold, color = Ink); Text("전체 내용을 확인한 뒤 번역 왜곡 검증을 진행해 주세요.", color = Color.DarkGray)
    entries.forEach { item -> Card(colors = CardDefaults.cardColors(containerColor = Color.White)) { Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) { Text(item.number, color = Teal, fontWeight = FontWeight.Bold); Text(language.label, style = MaterialTheme.typography.labelMedium); Text(item.source); HorizontalDivider(); Text("English", fontWeight = FontWeight.Bold); Text(item.english); Text("한국어", fontWeight = FontWeight.Bold); Text(item.korean) } } }
    Button(onVerify, Modifier.fillMaxWidth(), colors = ButtonDefaults.buttonColors(containerColor = Teal)) { Text("전체 번역본 검증하기") }
}
@Composable private fun RedactionScreen(language: AppLanguage, model: VerificationModel, source: String, translation: String, onSource: (String) -> Unit, onEnglish: (String) -> Unit, onVerify: () -> Unit) = Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(20.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
    Text("개인정보 제외본 확인", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold, color = Ink); Text("아래 전체 내용만 Mac 로컬 서버로 전송됩니다. 이름·주소 등 남은 개인정보도 직접 지워 주세요.", color = Color.DarkGray)
    OutlinedTextField(source, onSource, Modifier.fillMaxWidth().height(190.dp), label = { Text("${language.label} 전체 원문") }); OutlinedTextField(translation, onEnglish, Modifier.fillMaxWidth().height(190.dp), label = { Text("English 전체 번역본") })
    Notice("검증 기준", "${model.name}이 누락·추가·부정 반전·확실성·행위자·시간·인과·피해 강도 등의 변화를 유형별로 확인합니다.")
    Button(onVerify, Modifier.fillMaxWidth(), colors = ButtonDefaults.buttonColors(containerColor = Teal)) { Text("전체 진술 검증 요청") }
}
@Composable private fun LoadingScreen(message: String) = Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(16.dp)) { CircularProgressIndicator(color = Teal); Text(message) } }
@Composable private fun ReportScreen(report: VerificationReport?, error: String?, onRestart: () -> Unit) = Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(20.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
    Text("번역 왜곡 검증 결과", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold, color = Ink)
    Text(if (report?.distortionFound == true) "확인이 필요한 의미 변경이 발견되었습니다." else "중대한 의미 변경이 발견되지 않았습니다.", color = if (report?.distortionFound == true) Warning else Teal, fontWeight = FontWeight.Bold); Text(report?.summary ?: "결과를 불러오지 못했습니다.")
    report?.items?.forEach { item -> Card(colors = CardDefaults.cardColors(containerColor = Color.White)) { Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) { Text("${item.type} · ${item.direction} · ${item.severity}", color = Teal, fontWeight = FontWeight.Bold); if (item.questionNumber.isNotBlank()) Text("문항 ${item.questionNumber}", style = MaterialTheme.typography.labelMedium); Text("원문: ${item.sourceExcerpt}"); Text("번역: ${item.translationExcerpt}"); Text(item.explanation, color = Color.DarkGray) } } }
    Text("‘유리하게 강화’와 ‘불리하게 약화’는 번역 변화의 방향을 나타낼 뿐 심사 결과를 예측하지 않습니다. 최종 판단은 지원자와 전문가가 원문을 직접 확인해야 합니다.", color = Warning, style = MaterialTheme.typography.bodySmall); if (error != null) Text(error, color = Color(0xFFB3261E)); OutlinedButton(onRestart, Modifier.fillMaxWidth()) { Text("처음부터 다시 작성") }
}
@Composable private fun Notice(title: String, content: String) = Card(colors = CardDefaults.cardColors(containerColor = Color.White)) { Column(Modifier.padding(16.dp)) { Text(title, fontWeight = FontWeight.Bold, color = Teal); Spacer(Modifier.height(6.dp)); Text(content, color = Ink) } }
