import Foundation
import Capacitor
import UniformTypeIdentifiers
import LiteRTLM

@objc(OnDeviceLlmPlugin)
public class OnDeviceLlmPlugin: CAPPlugin, CAPBridgedPlugin, UIDocumentPickerDelegate {
    public let identifier = "OnDeviceLlmPlugin"
    public let jsName = "OnDeviceLlm"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "getStatus", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "importModel", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "generate", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "cancel", returnType: CAPPluginReturnPromise),
    ]
    private let lock = NSLock()
    private var busy = false
    private var cancelled = false
    private var activeConversation: Conversation?
    private var engine: Engine?
    private var pickerCall: CAPPluginCall?
    private var modelURL: URL {
        FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("DariModels/dari-model.litertlm")
    }
    private func withLock<T>(_ action: () throws -> T) rethrows -> T {
        lock.lock(); defer { lock.unlock() }; return try action()
    }
    private func acquire() -> Bool {
        withLock { if busy { return false }; busy = true; cancelled = false; return true }
    }
    private func status() -> [String: Any] {
        ["platform": "ios", "available": true,
         "modelReady": FileManager.default.fileExists(atPath: modelURL.path),
         "modelPath": modelURL.path,
         "modelName": UserDefaults.standard.string(forKey: "dari.modelName") ?? "",
         "busy": withLock { busy }]
    }
    @objc func getStatus(_ call: CAPPluginCall) { call.resolve(status()) }

    @objc func importModel(_ call: CAPPluginCall) {
        guard acquire() else { call.reject("모델이 작업 중입니다."); return }
        DispatchQueue.main.async {
            guard let controller = self.bridge?.viewController else {
                self.withLock { self.busy = false }; call.reject("파일 선택기를 열 수 없습니다."); return
            }
            self.pickerCall = call
            let picker = UIDocumentPickerViewController(forOpeningContentTypes: [.data], asCopy: false)
            picker.delegate = self
            picker.allowsMultipleSelection = false
            controller.present(picker, animated: true)
        }
    }
    public func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) {
        pickerCall?.reject("모델 가져오기를 취소했습니다.", "CANCELLED")
        pickerCall = nil; withLock { busy = false }
    }
    public func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
        guard let call = pickerCall, let source = urls.first else { withLock { busy = false }; return }
        pickerCall = nil
        DispatchQueue.global(qos: .userInitiated).async {
            let scoped = source.startAccessingSecurityScopedResource()
            defer {
                if scoped { source.stopAccessingSecurityScopedResource() }
            }
            let fm = FileManager.default
            let directory = self.modelURL.deletingLastPathComponent()
            let temporary = directory.appendingPathComponent(UUID().uuidString + ".importing")
            do {
                guard source.pathExtension.lowercased() == "litertlm" else {
                    throw NSError(domain: "DARI", code: 1, userInfo: [NSLocalizedDescriptionKey: ".litertlm 모델 파일을 선택해 주세요."])
                }
                try fm.createDirectory(at: directory, withIntermediateDirectories: true)
                var noBackupDirectory = directory
                var values = URLResourceValues(); values.isExcludedFromBackup = true
                try noBackupDirectory.setResourceValues(values)
                try fm.copyItem(at: source, to: temporary)
                let size = try temporary.resourceValues(forKeys: [.fileSizeKey]).fileSize ?? 0
                guard size > 0 else { throw NSError(domain: "DARI", code: 2, userInfo: [NSLocalizedDescriptionKey: "빈 모델 파일입니다."]) }
                self.engine = nil
                if fm.fileExists(atPath: self.modelURL.path) {
                    _ = try fm.replaceItemAt(self.modelURL, withItemAt: temporary)
                } else { try fm.moveItem(at: temporary, to: self.modelURL) }
                UserDefaults.standard.set(source.lastPathComponent, forKey: "dari.modelName")
                self.withLock { self.busy = false }
                call.resolve(self.status())
            } catch {
                try? fm.removeItem(at: temporary)
                self.withLock { self.busy = false }
                call.reject(error.localizedDescription)
            }
        }
    }

    @objc func generate(_ call: CAPPluginCall) {
        guard let prompt = call.getString("prompt"), !prompt.isEmpty else { call.reject("입력 내용이 없습니다."); return }
        guard FileManager.default.fileExists(atPath: modelURL.path) else {
            call.reject("먼저 .litertlm 모델 파일을 가져와 주세요.", "MODEL_MISSING"); return
        }
        guard acquire() else { call.reject("모델이 작업 중입니다.", "BUSY"); return }
        // Initialize on the runtime's actor and keep native work off the UI thread.
        Task.detached(priority: .userInitiated) { [self] in
            defer { self.withLock { self.activeConversation = nil; self.busy = false } }
            do {
                if self.engine == nil {
                    let config = try EngineConfig(modelPath: self.modelURL.path, backend: .gpu,
                                                  maxNumTokens: 16384, cacheDir: NSTemporaryDirectory())
                    let candidate = Engine(engineConfig: config)
                    try await candidate.initialize()
                    self.engine = candidate
                }
                guard !self.withLock({ self.cancelled }) else { throw CancellationError() }
                let sampler = try SamplerConfig(topK: 40, topP: 0.95,
                    temperature: Float(min(2, max(0, call.getDouble("temperature") ?? 0.2))))
                let config = ConversationConfig(systemMessage: Message(call.getString("system") ?? ""),
                    samplerConfig: sampler, thinkingConfig: ThinkingConfig(enableThinking: false))
                guard let engine = self.engine else { throw CancellationError() }
                let conversation = try await engine.createConversation(with: config)
                self.withLock { self.activeConversation = conversation }
                guard !self.withLock({ self.cancelled }) else { throw CancellationError() }
                let response = try await conversation.sendMessage(Message(prompt),
                    maxOutputTokens: min(4096, max(64, call.getInt("maxTokens") ?? 2048)))
                guard !self.withLock({ self.cancelled }) else { throw CancellationError() }
                guard !response.toString.isEmpty else {
                    call.reject("모델이 결과를 반환하지 않았습니다."); return
                }
                call.resolve(["text": response.toString])
            } catch { call.reject(error.localizedDescription) }
        }
    }
    @objc func cancel(_ call: CAPPluginCall) {
        do {
            try withLock { cancelled = true; try activeConversation?.cancel() }
            call.resolve()
        } catch { call.reject(error.localizedDescription) }
    }
}
