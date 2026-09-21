package org.dari.mvp

import com.google.mlkit.common.model.DownloadConditions
import com.google.mlkit.nl.translate.Translator
import com.google.mlkit.nl.translate.TranslatorOptions

class TranslationRepository {
    private var sourceToEnglish: Translator? = null
    private var englishToKorean: Translator? = null

    fun prepare(sourceLanguage: String, onReady: () -> Unit, onError: (Exception) -> Unit) {
        sourceToEnglish?.close()
        englishToKorean?.close()
        sourceToEnglish = com.google.mlkit.nl.translate.Translation.getClient(
            TranslatorOptions.Builder()
                .setSourceLanguage(sourceLanguage)
                .setTargetLanguage("en")
                .build()
        )
        englishToKorean = com.google.mlkit.nl.translate.Translation.getClient(
            TranslatorOptions.Builder().setSourceLanguage("en").setTargetLanguage("ko").build()
        )
        val conditions = DownloadConditions.Builder().requireWifi().build()
        sourceToEnglish!!.downloadModelIfNeeded(conditions)
            .addOnSuccessListener {
                englishToKorean!!.downloadModelIfNeeded(conditions)
                    .addOnSuccessListener { onReady() }
                    .addOnFailureListener(onError)
            }
            .addOnFailureListener { onError(it) }
    }

    fun translate(text: String, onSuccess: (String, String) -> Unit, onError: (Exception) -> Unit) {
        val first = sourceToEnglish
        val second = englishToKorean
        if (first == null || second == null) {
            onError(IllegalStateException("번역 언어가 준비되지 않았습니다."))
            return
        }
        first.translate(text)
            .addOnSuccessListener { english ->
                second.translate(english)
                    .addOnSuccessListener { korean -> onSuccess(english, korean) }
                    .addOnFailureListener(onError)
            }
            .addOnFailureListener(onError)
    }

    fun close() {
        sourceToEnglish?.close()
        englishToKorean?.close()
    }
}
