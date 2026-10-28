import Darwin
import os
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
        CAPPluginMethod(name: "saveBenchFile", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setKeepAwake", returnType: CAPPluginReturnPromise),
    ]
    private let lock = NSLock()
    private var busy = false
    private var cancelled = false
    private var activeConversation: Conversation?
    private var engine: Engine?
    /// "backend/maxNumTokens" of the loaded engine; a benchmark asking for another config reloads it.
    private var engineKey: String?
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
         "backend": UserDefaults.standard.string(forKey: "dari.backend") ?? "",
         "busy": withLock { busy },
         "device": deviceInfo()]
    }
    private func deviceInfo() -> [String: Any] {
        var system = utsname(); uname(&system)
        let machine = withUnsafeBytes(of: &system.machine) { String(decoding: $0.prefix(while: { $0 != 0 }), as: UTF8.self) }
        return ["model": machine, "os": ProcessInfo.processInfo.operatingSystemVersionString,
                "totalRamMB": ProcessInfo.processInfo.physicalMemory / 1_048_576]
    }
    /// Physical footprint (what jetsam limits) and its process-lifetime peak, in MB.
    private func footprint() -> (current: Double, peak: Double)? {
        var info = task_vm_info_data_t()
        var count = mach_msg_type_number_t(MemoryLayout<task_vm_info_data_t>.size / MemoryLayout<natural_t>.size)
        let result = withUnsafeMutablePointer(to: &info) {
            $0.withMemoryRebound(to: integer_t.self, capacity: Int(count)) { task_info(mach_task_self_, task_flavor_t(TASK_VM_INFO), $0, &count) }
        }
        guard result == KERN_SUCCESS else { return nil }
        return (Double(info.phys_footprint) / 1_048_576, Double(info.ledger_phys_footprint_peak) / 1_048_576)
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
                self.engine = nil; self.engineKey = nil
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
        // Benchmark options; the app's defaults are GPU with CPU fallback, 16k context and
        // no constrained decoding.
        let requestedBackend = call.getString("backend")
        let maxNumTokens = min(32768, max(1024, call.getInt("maxNumTokens") ?? 16384))
        let schema = call.getObject("responseSchema").map { $0 as [String: Any] }
        guard acquire() else { call.reject("모델이 작업 중입니다.", "BUSY"); return }
        // Initialize on the runtime's actor and keep native work off the UI thread.
        Task.detached(priority: .userInitiated) { [self] in
            defer { self.withLock { self.activeConversation = nil; self.busy = false } }
            do {
                let started = Date()
                var initMs: Double?
                let key = "\(requestedBackend ?? "auto")/\(maxNumTokens)"
                if self.engineKey != key { self.engine = nil; self.engineKey = nil }
                if self.engine == nil {
                    // Read only when an engine is created; it adds per-call timing counters.
                    ExperimentalFlags.optIntoExperimentalAPIs()
                    ExperimentalFlags.enableBenchmark = true
                    // The iOS Metal accelerator may be unavailable in this runtime build;
                    // fall back to CPU instead of failing outright unless a backend was requested.
                    let backends: [Backend] = requestedBackend == "cpu" ? [.cpu()] : requestedBackend == "gpu" ? [.gpu] : [.gpu, .cpu()]
                    var lastError: Error?
                    for backend in backends {
                        do {
                            let config = try EngineConfig(modelPath: self.modelURL.path, backend: backend,
                                                          maxNumTokens: maxNumTokens, cacheDir: NSTemporaryDirectory())
                            let candidate = Engine(engineConfig: config)
                            try await candidate.initialize()
                            self.engine = candidate
                            self.engineKey = key
                            initMs = (Date().timeIntervalSince(started) * 1000).rounded()
                            UserDefaults.standard.set(backend.rawValue, forKey: "dari.backend")
                            break
                        } catch { lastError = error }
                    }
                    if self.engine == nil { throw lastError ?? CancellationError() }
                }
                guard !self.withLock({ self.cancelled }) else { throw CancellationError() }
                let sampler = try SamplerConfig(topK: 40, topP: 0.95,
                    temperature: Float(min(2, max(0, call.getDouble("temperature") ?? 0.2))))
                let config = ConversationConfig(systemMessage: Message(call.getString("system") ?? ""),
                    samplerConfig: sampler, thinkingConfig: ThinkingConfig(enableThinking: false),
                    enableResponseFormat: schema != nil)
                guard let engine = self.engine else { throw CancellationError() }
                let conversation = try await engine.createConversation(with: config)
                self.withLock { self.activeConversation = conversation }
                guard !self.withLock({ self.cancelled }) else { throw CancellationError() }
                let response = try await conversation.sendMessage(Message(prompt),
                    maxOutputTokens: min(4096, max(64, call.getInt("maxTokens") ?? 2048)),
                    responseFormat: try schema.map { try ResponseFormat.json(schema: $0) })
                let totalMs = (Date().timeIntervalSince(started) * 1000).rounded()
                guard !self.withLock({ self.cancelled }) else { throw CancellationError() }
                guard !response.toString.isEmpty else {
                    call.reject("모델이 결과를 반환하지 않았습니다."); return
                }
                var stats: [String: Any] = [
                    "runtime": "litertlm", "backend": UserDefaults.standard.string(forKey: "dari.backend") ?? "",
                    "maxNumTokens": maxNumTokens, "constrained": schema != nil, "totalMs": totalMs,
                    "availMemMB": (Double(os_proc_available_memory()) / 1_048_576).rounded(),
                    "thermal": ["nominal", "fair", "serious", "critical"][min(3, ProcessInfo.processInfo.thermalState.rawValue)],
                ]
                if let initMs { stats["initMs"] = initMs }
                if let info = try? conversation.getBenchmarkInfo() {
                    stats["ttftMs"] = (info.timeToFirstTokenInSecond * 1000).rounded()
                    stats["prefillTokens"] = info.lastPrefillTokenCount
                    stats["decodeTokens"] = info.lastDecodeTokenCount
                    stats["prefillTokPerSec"] = (info.lastPrefillTokensPerSecond * 10).rounded() / 10
                    stats["decodeTokPerSec"] = (info.lastDecodeTokensPerSecond * 10).rounded() / 10
                }
                if let memory = self.footprint() {
                    stats["footprintMB"] = memory.current.rounded()
                    stats["peakFootprintMB"] = memory.peak.rounded()
                }
                call.resolve(["text": response.toString, "stats": stats])
            } catch { call.reject(error.localizedDescription) }
        }
    }
    /// Benchmark only: writes fictional-scenario results to Documents/bench, visible in Files and
    /// copyable with `xcrun devicectl device copy from`.
    @objc func saveBenchFile(_ call: CAPPluginCall) {
        guard let name = call.getString("name"), !name.isEmpty, !name.contains("/"), let text = call.getString("text") else {
            call.reject("저장할 파일 이름과 내용이 필요합니다."); return
        }
        do {
            let directory = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0].appendingPathComponent("bench")
            try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
            let url = directory.appendingPathComponent(name)
            try text.write(to: url, atomically: true, encoding: .utf8)
            call.resolve(["path": url.path])
        } catch { call.reject(error.localizedDescription) }
    }
    /// Benchmark only: keeps the screen on so a long run is not suspended.
    @objc func setKeepAwake(_ call: CAPPluginCall) {
        let on = call.getBool("on") ?? false
        DispatchQueue.main.async { UIApplication.shared.isIdleTimerDisabled = on; call.resolve() }
    }
    @objc func cancel(_ call: CAPPluginCall) {
        do {
            try withLock { cancelled = true; try activeConversation?.cancel() }
            call.resolve()
        } catch { call.reject(error.localizedDescription) }
    }
}
