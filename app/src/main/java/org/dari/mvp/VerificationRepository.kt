package org.dari.mvp

import android.os.Handler
import android.os.Looper
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import kotlin.concurrent.thread

data class DistortionItem(
    val type: String,
    val direction: String,
    val severity: String,
    val questionNumber: String,
    val sourceExcerpt: String,
    val translationExcerpt: String,
    val explanation: String
)

data class VerificationReport(
    val distortionFound: Boolean,
    val summary: String,
    val items: List<DistortionItem>
)

object SensitiveDataRedactor {
    private val email = Regex("[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}")
    private val phone = Regex("(?<!\\d)(?:\\+?\\d{1,3}[ -]?)?(?:\\d[ -]?){7,14}\\d(?!\\d)")
    private val idNumber = Regex("(?<!\\d)\\d{6}[- ]?\\d{7}(?!\\d)")

    fun redact(text: String): String = text.replace(email, "[EMAIL REMOVED]")
        .replace(idNumber, "[ID REMOVED]").replace(phone, "[PHONE REMOVED]")
}

class VerificationRepository {
    fun verify(model: String, sourceLanguage: String, source: String, translation: String, onSuccess: (VerificationReport) -> Unit, onError: (Exception) -> Unit) {
        thread {
            try {
                val body = JSONObject().apply {
                    put("model", model)
                    put("source_language", sourceLanguage)
                    put("target_language", "en")
                    put("source_text", source)
                    put("translation_text", translation)
                }
                val connection = (URL(BuildConfig.VERIFICATION_API_BASE_URL + "/v1/translation/verify").openConnection() as HttpURLConnection).apply {
                    requestMethod = "POST"; connectTimeout = 10_000; readTimeout = 120_000; doOutput = true
                    setRequestProperty("Content-Type", "application/json")
                }
                connection.outputStream.bufferedWriter().use { it.write(body.toString()) }
                if (connection.responseCode !in 200..299) error("검증 서버 응답 오류: ${connection.responseCode}")
                val json = JSONObject(connection.inputStream.bufferedReader().use { it.readText() })
                val array = json.optJSONArray("distortions")
                val items = if (array == null) emptyList() else List(array.length()) { index ->
                    val item = array.getJSONObject(index)
                    DistortionItem(
                        item.optString("type", "기타 의미 변경"), item.optString("direction", "중립"),
                        item.optString("severity", "확인 필요"), item.optString("question_number", ""),
                        item.optString("source_excerpt", ""), item.optString("translation_excerpt", ""),
                        item.optString("explanation", "원문과 번역문을 다시 확인해 주세요.")
                    )
                }
                val report = VerificationReport(json.optBoolean("distortion_found", items.isNotEmpty()), json.optString("summary"), items)
                Handler(Looper.getMainLooper()).post { onSuccess(report) }
            } catch (exception: Exception) {
                Handler(Looper.getMainLooper()).post { onError(exception) }
            }
        }
    }
}
