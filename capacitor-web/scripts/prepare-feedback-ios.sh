#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
if [[ "$(uname)" != "Darwin" ]]; then echo "iPhone builds require macOS and Xcode." >&2; exit 1; fi
# Command Line Tools alone cannot build an iPhone app. Prefer a working selected
# Xcode, with a process-local fallback instead of changing xcode-select globally.
if ! xcodebuild -version >/dev/null 2>&1; then
  if [[ -z "${DEVELOPER_DIR:-}" && -d /Applications/Xcode.app/Contents/Developer ]]; then
    export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer
  fi
  xcodebuild -version || { echo "Open Xcode and finish its required setup first." >&2; exit 1; }
fi
command -v pod >/dev/null || { echo "Install CocoaPods first (e.g. brew install cocoapods)." >&2; exit 1; }
npm ci
npm run build:feedback
npx cap sync ios
pod install --project-directory=ios/App
echo "Open ios/App/App.xcworkspace in Xcode. Select your signing team and a unique feedback bundle ID."
open ios/App/App.xcworkspace
