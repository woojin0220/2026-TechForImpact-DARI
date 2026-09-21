package org.dari.app;

import androidx.annotation.NonNull;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.mlkit.common.model.DownloadConditions;
import com.google.mlkit.nl.translate.TranslateLanguage;
import com.google.mlkit.nl.translate.Translation;
import com.google.mlkit.nl.translate.Translator;
import com.google.mlkit.nl.translate.TranslatorOptions;

@CapacitorPlugin(name = "MlKitTranslation")
public class MlKitTranslationPlugin extends Plugin {
    @com.getcapacitor.PluginMethod
    public void translate(PluginCall call) {
        String text = call.getString("text", "").trim();
        String sourceTag = call.getString("sourceLanguage", "");
        String targetTag = call.getString("targetLanguage", "");
        String source = TranslateLanguage.fromLanguageTag(sourceTag);
        String target = TranslateLanguage.fromLanguageTag(targetTag);
        if (text.isEmpty()) {
            call.reject("번역할 내용이 없습니다.");
            return;
        }
        if (source == null || target == null) {
            call.reject("ML Kit이 지원하지 않는 언어입니다.");
            return;
        }

        Translator translator = Translation.getClient(new TranslatorOptions.Builder()
            .setSourceLanguage(source)
            .setTargetLanguage(target)
            .build());
        DownloadConditions conditions = new DownloadConditions.Builder().build();
        translator.downloadModelIfNeeded(conditions)
            .addOnSuccessListener(ignored -> translator.translate(text)
                .addOnSuccessListener(translated -> resolveAndClose(call, translator, translated))
                .addOnFailureListener(error -> rejectAndClose(call, translator, error)))
            .addOnFailureListener(error -> rejectAndClose(call, translator, error));
    }

    private void resolveAndClose(@NonNull PluginCall call, @NonNull Translator translator, String translated) {
        translator.close();
        JSObject result = new JSObject();
        result.put("translation", translated);
        call.resolve(result);
    }

    private void rejectAndClose(@NonNull PluginCall call, @NonNull Translator translator, Exception error) {
        translator.close();
        call.reject("ML Kit 번역 모델을 준비하거나 실행하지 못했습니다.", error);
    }
}
