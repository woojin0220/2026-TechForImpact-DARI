import Foundation
import Capacitor
import MLKitTranslate
import MLKitCommon

@objc(MlKitTranslationPlugin)
public class MlKitTranslationPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "MlKitTranslationPlugin"
    public let jsName = "MlKitTranslation"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "getStatus", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "prepare", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "translate", returnType: CAPPluginReturnPromise),
    ]
    private func languages(_ call: CAPPluginCall) -> (TranslateLanguage, TranslateLanguage)? {
        let source = TranslateLanguage(rawValue: call.getString("sourceLanguage") ?? "")
        let target = TranslateLanguage(rawValue: call.getString("targetLanguage") ?? "")
        guard TranslateLanguage.allLanguages().contains(source), TranslateLanguage.allLanguages().contains(target) else {
            call.reject("Unsupported translation language", "UNSUPPORTED_LANGUAGE"); return nil
        }
        return (source, target)
    }
    private func ready(_ source: TranslateLanguage, _ target: TranslateLanguage) -> Bool {
        if source == target { return true }
        return [source, target].filter { $0 != .english }.allSatisfy {
            ModelManager.modelManager().isModelDownloaded(TranslateRemoteModel.translateRemoteModel(language: $0))
        }
    }
    @objc func getStatus(_ call: CAPPluginCall) {
        guard let (source, target) = languages(call) else { return }
        call.resolve(["ready": ready(source, target)])
    }
    @objc func prepare(_ call: CAPPluginCall) {
        guard let (source, target) = languages(call) else { return }
        if ready(source, target) { call.resolve(); return }
        let translator = Translator.translator(options: TranslatorOptions(sourceLanguage: source, targetLanguage: target))
        let conditions = ModelDownloadConditions(allowsCellularAccess: call.getBool("allowCellular") ?? false, allowsBackgroundDownloading: true)
        translator.downloadModelIfNeeded(with: conditions) { error in
            // Retain the translator until download completion.
            _ = translator
            if let error = error { call.reject("Could not download translation models", "MODEL_DOWNLOAD_FAILED", error) }
            else { call.resolve() }
        }
    }
    @objc func translate(_ call: CAPPluginCall) {
        guard let (source, target) = languages(call) else { return }
        let text = call.getString("text") ?? ""
        guard !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { call.reject("Empty text", "EMPTY_TEXT"); return }
        if source == target { call.resolve(["translation": text]); return }
        guard ready(source, target) else { call.reject("Download translation models first", "TRANSLATION_MODEL_REQUIRED"); return }
        let translator = Translator.translator(options: TranslatorOptions(sourceLanguage: source, targetLanguage: target))
        translator.translate(text) { translated, error in
            _ = translator
            if let error = error { call.reject("Translation failed", "TRANSLATION_FAILED", error) }
            else if let translated = translated { call.resolve(["translation": translated]) }
            else { call.reject("Empty translation", "TRANSLATION_FAILED") }
        }
    }
}
