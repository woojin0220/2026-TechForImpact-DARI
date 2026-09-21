import Capacitor
import MLKitCommon
import MLKitTranslate

@objc(MlKitTranslationPlugin)
public class MlKitTranslationPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "MlKitTranslationPlugin"
    public let jsName = "MlKitTranslation"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "translate", returnType: CAPPluginReturnPromise)
    ]

    @objc func translate(_ call: CAPPluginCall) {
        guard let text = call.getString("text"), !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
              let sourceTag = call.getString("sourceLanguage"),
              let targetTag = call.getString("targetLanguage"),
              let source = TranslateLanguage.fromLanguageTag(sourceTag),
              let target = TranslateLanguage.fromLanguageTag(targetTag) else {
            call.reject("번역할 내용과 ML Kit 지원 언어를 확인해 주세요.")
            return
        }

        let options = TranslatorOptions(sourceLanguage: source, targetLanguage: target)
        let translator = Translator.translator(options: options)
        let conditions = ModelDownloadConditions(allowsCellularAccess: false, allowsBackgroundDownloading: true)
        translator.downloadModelIfNeeded(with: conditions) { error in
            if let error = error {
                call.reject("ML Kit 번역 모델을 내려받지 못했습니다.", nil, error)
                return
            }
            translator.translate(text) { translatedText, error in
                if let error = error {
                    call.reject("ML Kit 번역을 실행하지 못했습니다.", nil, error)
                    return
                }
                guard let translatedText = translatedText else {
                    call.reject("ML Kit 번역 결과가 비어 있습니다.")
                    return
                }
                call.resolve(["translation": translatedText])
            }
        }
    }
}
