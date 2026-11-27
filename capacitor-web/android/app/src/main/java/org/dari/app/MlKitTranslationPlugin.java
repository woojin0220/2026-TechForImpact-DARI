package org.dari.app;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.mlkit.common.model.DownloadConditions;
import com.google.mlkit.common.model.RemoteModelManager;
import com.google.mlkit.nl.translate.*;
import com.google.android.gms.tasks.Tasks;

@CapacitorPlugin(name = "MlKitTranslation")
public class MlKitTranslationPlugin extends Plugin {
    private String[] languages(PluginCall call) {
        String source = TranslateLanguage.fromLanguageTag(call.getString("sourceLanguage", ""));
        String target = TranslateLanguage.fromLanguageTag(call.getString("targetLanguage", ""));
        if (source == null || target == null) { call.reject("Unsupported translation language", "UNSUPPORTED_LANGUAGE"); return null; }
        return new String[]{source, target};
    }
    private com.google.android.gms.tasks.Task<Boolean> ready(String[] pair) {
        if (pair[0].equals(pair[1])) return Tasks.forResult(true);
        java.util.List<com.google.android.gms.tasks.Task<Boolean>> checks = new java.util.ArrayList<>();
        for (String language : pair) if (!language.equals(TranslateLanguage.ENGLISH)) {
            checks.add(RemoteModelManager.getInstance().isModelDownloaded(new TranslateRemoteModel.Builder(language).build()));
        }
        return Tasks.whenAllComplete(checks).continueWith(done -> {
            for (com.google.android.gms.tasks.Task<Boolean> check : checks) if (!check.isSuccessful() || !Boolean.TRUE.equals(check.getResult())) return false;
            return true;
        });
    }
    private Translator translator(String[] pair) {
        return Translation.getClient(new TranslatorOptions.Builder().setSourceLanguage(pair[0]).setTargetLanguage(pair[1]).build());
    }
    @PluginMethod public void getStatus(PluginCall call) {
        String[] pair = languages(call); if (pair == null) return;
        ready(pair).addOnSuccessListener(value -> { JSObject result = new JSObject(); result.put("ready", value); call.resolve(result); })
            .addOnFailureListener(error -> call.reject("Could not check models", "TRANSLATION_FAILED", error));
    }
    @PluginMethod public void prepare(PluginCall call) {
        String[] pair = languages(call); if (pair == null) return;
        if (pair[0].equals(pair[1])) { call.resolve(); return; }
        Translator client = translator(pair);
        DownloadConditions.Builder conditions = new DownloadConditions.Builder();
        if (!Boolean.TRUE.equals(call.getBoolean("allowCellular", false))) conditions.requireWifi();
        client.downloadModelIfNeeded(conditions.build()).addOnSuccessListener(ignored -> { client.close(); call.resolve(); })
            .addOnFailureListener(error -> { client.close(); call.reject("Could not download translation models", "MODEL_DOWNLOAD_FAILED", error); });
    }
    @PluginMethod public void translate(PluginCall call) {
        String[] pair = languages(call); if (pair == null) return;
        String text = call.getString("text", "");
        if (text.trim().isEmpty()) { call.reject("Empty text", "EMPTY_TEXT"); return; }
        if (pair[0].equals(pair[1])) { JSObject result = new JSObject(); result.put("translation", text); call.resolve(result); return; }
        ready(pair).addOnSuccessListener(value -> {
            if (!value) { call.reject("Download translation models first", "TRANSLATION_MODEL_REQUIRED"); return; }
            Translator client = translator(pair);
            client.translate(text).addOnSuccessListener(translated -> {
                client.close(); JSObject result = new JSObject(); result.put("translation", translated); call.resolve(result);
            }).addOnFailureListener(error -> { client.close(); call.reject("Translation failed", "TRANSLATION_FAILED", error); });
        }).addOnFailureListener(error -> call.reject("Could not check models", "TRANSLATION_FAILED", error));
    }
}
