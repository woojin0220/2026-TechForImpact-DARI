// Line-delimited JSON bridge to LiteRT-LM for the DARI benchmark runner.
//
//   litertlm-bench --model path/to/model.litertlm [--backend gpu|cpu] [--max-num-tokens 16384]
//
// stdin, one request per line:  {"id":1,"system":"…","prompt":"…","maxTokens":3072,"temperature":0.1,"responseSchema":{…}}
// stdout, one response per line: {"id":1,"text":"…","stats":{…}}  or  {"id":1,"error":"…"}
// Generation settings mirror the phone plugins (top-k 40, top-p 0.95, thinking off,
// a fresh conversation per request). The engine loads on the first request so that
// request carries initMs, as on the phone. Only fictional test data should be sent.
import Darwin
import Foundation
import LiteRTLM

struct Options {
  var modelPath = ""
  var backend = "gpu"
  var maxNumTokens = 16384
}

func parseOptions() -> Options {
  var options = Options()
  var arguments = CommandLine.arguments.dropFirst().makeIterator()
  while let flag = arguments.next() {
    switch flag {
    case "--model": options.modelPath = arguments.next() ?? ""
    case "--backend": options.backend = arguments.next() ?? "gpu"
    case "--max-num-tokens": options.maxNumTokens = Int(arguments.next() ?? "") ?? 16384
    default: fail("unknown argument \(flag)")
    }
  }
  if options.modelPath.isEmpty { fail("--model is required") }
  if !["gpu", "cpu"].contains(options.backend) { fail("--backend must be gpu or cpu") }
  return options
}

func fail(_ message: String) -> Never {
  FileHandle.standardError.write(Data("litertlm-bench: \(message)\n".utf8))
  exit(2)
}

func emit(_ object: [String: Any]) {
  guard let data = try? JSONSerialization.data(withJSONObject: object), var line = String(data: data, encoding: .utf8) else { return }
  line += "\n"
  FileHandle.standardOutput.write(Data(line.utf8))
}

/// Physical footprint (what the OS memory limit counts) and its process-lifetime peak, in MB.
func footprint() -> (current: Double, peak: Double)? {
  var info = task_vm_info_data_t()
  var count = mach_msg_type_number_t(MemoryLayout<task_vm_info_data_t>.size / MemoryLayout<natural_t>.size)
  let result = withUnsafeMutablePointer(to: &info) {
    $0.withMemoryRebound(to: integer_t.self, capacity: Int(count)) { task_info(mach_task_self_, task_flavor_t(TASK_VM_INFO), $0, &count) }
  }
  guard result == KERN_SUCCESS else { return nil }
  return (Double(info.phys_footprint) / 1_048_576, Double(info.ledger_phys_footprint_peak) / 1_048_576)
}

let milliseconds = { (seconds: Double) in (seconds * 1000).rounded() }

@main
struct Bench {
  static func main() async {
    let options = parseOptions()
    ExperimentalFlags.optIntoExperimentalAPIs()
    ExperimentalFlags.enableBenchmark = true
    var engine: Engine?
    while let line = readLine() {
      guard let data = line.data(using: .utf8), let request = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
        emit(["error": "invalid request line"]); continue
      }
      let id = request["id"] ?? NSNull()
      let started = Date()
      do {
        var initMs: Double?
        if engine == nil {
          let config = try EngineConfig(modelPath: options.modelPath, backend: options.backend == "cpu" ? .cpu() : .gpu,
                                        maxNumTokens: options.maxNumTokens, cacheDir: NSTemporaryDirectory())
          let candidate = Engine(engineConfig: config)
          try await candidate.initialize()
          engine = candidate
          initMs = milliseconds(Date().timeIntervalSince(started))
        }
        let schema = request["responseSchema"] as? [String: Any]
        let temperature = Float(min(2, max(0, request["temperature"] as? Double ?? 0.2)))
        let conversation = try await engine!.createConversation(with: ConversationConfig(
          systemMessage: Message(request["system"] as? String ?? ""),
          samplerConfig: try SamplerConfig(topK: 40, topP: 0.95, temperature: temperature),
          thinkingConfig: ThinkingConfig(enableThinking: false),
          enableResponseFormat: schema != nil))
        let response = try await conversation.sendMessage(
          Message(request["prompt"] as? String ?? ""),
          maxOutputTokens: min(4096, max(64, request["maxTokens"] as? Int ?? 2048)),
          responseFormat: try schema.map { try ResponseFormat.json(schema: $0) })
        var stats: [String: Any] = [
          "runtime": "litertlm", "backend": options.backend, "maxNumTokens": options.maxNumTokens,
          "constrained": schema != nil, "totalMs": milliseconds(Date().timeIntervalSince(started)),
        ]
        if let initMs { stats["initMs"] = initMs }
        if let info = try? conversation.getBenchmarkInfo() {
          stats["ttftMs"] = milliseconds(info.timeToFirstTokenInSecond)
          stats["prefillTokens"] = info.lastPrefillTokenCount
          stats["decodeTokens"] = info.lastDecodeTokenCount
          stats["prefillTokPerSec"] = (info.lastPrefillTokensPerSecond * 10).rounded() / 10
          stats["decodeTokPerSec"] = (info.lastDecodeTokensPerSecond * 10).rounded() / 10
        }
        if let memory = footprint() {
          stats["footprintMB"] = memory.current.rounded()
          stats["peakFootprintMB"] = memory.peak.rounded()
        }
        emit(["id": id, "text": response.toString, "stats": stats])
      } catch {
        emit(["id": id, "error": "\(error)"])
      }
    }
  }
}
