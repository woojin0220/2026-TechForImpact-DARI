#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
if [[ "$(uname)" != "Darwin" ]]; then echo "iPhone builds require macOS and Xcode." >&2; exit 1; fi
command -v pod >/dev/null || { echo "Install CocoaPods first (e.g. brew install cocoapods)." >&2; exit 1; }
npm ci
npm run build:feedback
npx cap sync ios
pod install --project-directory=ios/App
echo "Open ios/App/App.xcworkspace in Xcode. Select your signing team and a unique feedback bundle ID."
open ios/App/App.xcworkspace
