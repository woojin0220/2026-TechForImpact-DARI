// swift-tools-version: 5.9
// Runs the same .litertlm model files as the phone app on a Mac, for benchmark
// screening before device runs. Pinned to the app's LiteRT-LM version.
import PackageDescription

let package = Package(
  name: "litertlm-bench",
  platforms: [.macOS(.v13)],
  dependencies: [.package(url: "https://github.com/google-ai-edge/LiteRT-LM", exact: "0.17.1")],
  targets: [
    .executableTarget(name: "litertlm-bench", dependencies: [.product(name: "LiteRTLM", package: "LiteRT-LM")]),
  ]
)
