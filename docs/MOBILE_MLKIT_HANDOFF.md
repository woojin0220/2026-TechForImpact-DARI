# DARI 모바일 체험용 앱 · ML Kit

작업 브랜치: `feat/mobile-mlkit` (신청서 UX/다운로드 작업 브랜치의 `cd008a6`에서 분기)

## 구현 범위

| 항목 | Android | iPhone |
|---|---|---|
| 신청서 번역 | Google ML Kit 네이티브 연결 | Google ML Kit Swift 연결 |
| 언어 모델 준비 | 첫 번역 시 동의 → 다운로드. Wi-Fi 기본, 모바일 데이터 선택 | 동일 |
| 개인정보 경로 | 신청서 텍스트를 번역 서버로 보내지 않음 | 동일한 코드 경로 |
| PDF·HWP 저장 | Android 저장 위치 선택 창 | Capacitor Filesystem + OS 공유 창 |
| 체험 진입 | 언어 선택 → 체험 시작. 로컬 샘플 계정 | 동일 |
| 설치본 검증 | 별도 검증 기록 참고 | Mac/Xcode 빌드·서명·실기기 검증 필요 |

번역 버튼으로만 신청서 번역을 실행하며, 원문을 덮어쓰지 않습니다. 번역 결과는 직접 확인·수정한 뒤 저장합니다. 모바일 신청서 화면의 LLM 파일 가져오기와 대화 생성 진입은 숨겼습니다. 기존 LLM 실험용 소스는 삭제하지 않았습니다.

커뮤니티는 ML Kit로 자동 번역합니다. 필요한 언어 모델은 Wi-Fi에서만 백그라운드로 준비하며, 모바일 데이터 다운로드나 게시글별 팝업을 임의로 시작하지 않습니다. 현재 체험 계정의 글과 댓글은 샘플 데이터이며 실제 서비스로 게시되지 않습니다.

## 체험 빌드와 일반 빌드 구분

`npm run build:feedback`은 Vite의 `feedback` 모드로 빌드합니다. 이 모드에서만 로컬 체험 진입을 허용하고 Supabase 연결을 끕니다. 일반 `npm run build`에서는 체험 계정을 활성화하지 않습니다. `.env.local`이나 비밀 키를 전달할 필요가 없습니다.

Android에서 `-PdariFeedback=true`를 지정하면 앱 ID가 `org.dari.app.feedback`이 되어 일반 앱과 별도로 설치됩니다. 웹 에셋도 반드시 먼저 `build:feedback`으로 생성해야 합니다.

## Android 재빌드

필요 환경: Node.js 22 이상, JDK 21, Android SDK 36.

```powershell
cd capacitor-web
npm ci
.\scripts\build-feedback-android.ps1 -JdkHome 'JDK21 설치 경로'
```

결과: `android/app/build/outputs/apk/debug/app-debug.apk`

체험용 debug 서명 APK입니다. Play Store 출시용 서명·릴리스 빌드와 구분합니다. SDK 경로는 Android Studio 또는 로컬 `android/local.properties`에서 설정합니다.

## Mac 팀원에게 부탁할 작업

**main 대신 이 브랜치를 체크아웃한 뒤 진행합니다.** 기존 신청서 UX 작업도 포함되어 있으므로 임의로 일부 파일만 복사하지 않습니다.

```bash
git fetch origin
git switch --track origin/feat/mobile-mlkit
cd capacitor-web
bash scripts/prepare-feedback-ios.sh
```

Node.js 22 이상, 최신 Xcode, CocoaPods, Git LFS가 필요합니다. 스크립트가 `npm ci → build:feedback → cap sync ios → pod install`을 순서대로 실행합니다.

1. `ios/App/App.xcworkspace` 열기. `App.xcodeproj`만 열면 CocoaPods의 ML Kit 연결이 누락됩니다.
2. App 타깃의 Signing & Capabilities에서 사용할 Apple 팀 선택. 기존 식별자 사용 권한이 없다면 체험용 고유 Bundle Identifier 설정.
3. 실제 iPhone으로 빌드·실행. 첫 번역 모델 다운로드, 다운로드 후 비행기 모드 번역, PDF/HWP 공유 창과 파일에 저장 확인.
4. Product → Archive → Distribute App → App Store Connect로 업로드.
5. App Store Connect에서 TestFlight 외부 테스터 등록 및 필요한 베타 심사 진행.

TestFlight 배포에는 Apple Developer Program 계정과 적절한 팀 권한이 필요합니다. IPA 파일만 전달한다고 일반 iPhone에 설치되는 것은 아닙니다. 개인 계정 비밀번호 대신 팀 초대·역할 권한으로 협업합니다.

프로젝트의 Capacitor 플러그인은 Swift Package Manager, Google ML Kit Translate 8.0.0은 CocoaPods로 관리합니다. iOS 배포 타깃은 16.0입니다. Windows에서는 iOS Swift 링크·서명·실기기 실행을 검증할 수 없습니다.

## 이번 검증 결과

- 전체 회귀 테스트 341개 통과, TypeScript·Vite 체험용 빌드 통과.
- JDK 21 / Android SDK 36으로 `assembleDebug -PdariFeedback=true` 성공.
- Android API 36 에뮬레이터에서 APK 설치·언어 선택·체험 진입 확인.
- 실제 ML Kit의 첫 언어 모델 다운로드, 영어 → 한국어 번역, 원문 보존 확인.
- Wi-Fi와 모바일 데이터를 끈 상태에서도 준비된 모델로 번역 반환 확인.
- 실제 Android 저장 창에서 PDF·HWP를 Downloads에 저장. PDF 22페이지 / 1,058,642바이트, HWP 50,176바이트 및 실제 번역문 포함 확인.
- 저장 뒤 앱 복귀와 다운로드 버튼 복구 확인. Android 저장 창에는 파일 내용 대신 캐시 파일 URI만 전달하여 활동 상태 크기 제한 회피.
- 전달 APK SHA-256: `0747dfd064e1fb57f7a18e365a5158e71ad9ef00f418ad33cd9df7efc48087af`.

Android 물리 기기와 iPhone 실기기는 아직 확인하지 않았습니다. 일부 실제 ML Kit 번역은 문장이 어색하거나 뜻이 불명확했습니다. 작동 확인과 번역 정확성 검증은 구분해야 합니다.

## Mac에서 반드시 확인할 부분

- ML Kit Swift 플러그인 컴파일 및 네이티브 등록
- 최초 모델 다운로드, 취소·재시도, 기기 재시작 뒤 모델 재사용
- 영어/아랍어 등 실제 문장 → 한국어 번역 (부정·불확실성·전언 포함)
- 원문 유지, 번역 수정, 확인 상태, PDF/HWP 미리보기·공유
- iPhone 작은 화면·키보드·안전 영역·뒤로가기
- TestFlight 빌드와 체험 계정의 실제 데이터 격리

번역의 법률적 정확성, 제출 가능성, 실제 신청자 환경 적합성은 이 구현만으로 검증된 것이 아닙니다. 변호사님 검토와 별도 품질 평가 대상입니다.

## 공식 참고

- Android ML Kit: https://developers.google.com/ml-kit/language/translation/android
- iOS ML Kit: https://developers.google.com/ml-kit/language/translation/ios
- Filesystem: https://capacitorjs.com/docs/apis/filesystem
- Share: https://capacitorjs.com/docs/apis/share
- TestFlight: https://developer.apple.com/testflight/


## Mac 검증 · 2026-11-27

- 기준 커밋: `b28de43`, `feat/mobile-mlkit`.
- Xcode 26.3 / iPhoneOS SDK 26.2, CocoaPods 1.17.0에서 확인.
- `npm ci`, `npm run build:feedback`, 전체 테스트 341개, `cap sync ios` 통과.
- ML Kit CocoaPods 설치 완료. App.xcworkspace와 Podfile.lock을 생성했습니다.
- Debug 설정에 Pods xcconfig include를 추가해 CocoaPods 통합 경고를 해결했습니다.
- 준비 스크립트는 기본 경로가 Command Line Tools인 경우 설치된 Xcode를 해당 프로세스에서만 선택합니다.
- 실제 iPhone 대상 `Release` arm64 빌드 성공 (`CODE_SIGNING_ALLOWED=NO`). Swift ML Kit 플러그인 컴파일과 네이티브 링크까지 확인한 것으로, 설치/실행 검증과는 다릅니다.
- 범용 시뮬레이터 빌드는 기존 LiteRT 바이너리의 x86_64 부재로 링크 실패했습니다. iPhone arm64 Release 빌드는 성공했습니다.
- 기존 LiteRT Swift 패키지의 체크아웃에 Git LFS가 필요합니다. 검증 명령에는 `GIT_LFS_SKIP_SMUDGE=1`을 적용했습니다. 이는 Swift 타깃이 사용하지 않는 prebuilt 폴더의 타 플랫폼 바이너리 다운로드만 생략하며, Swift 패키지가 사용하는 XCFramework는 정상 다운로드·체크섬 검증되었습니다.

아래 검증 명령은 서명된 IPA나 TestFlight 배포본을 만들지 않습니다.

```bash
cd capacitor-web
PATH="/opt/homebrew/bin:$PATH" \
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer \
GIT_LFS_SKIP_SMUDGE=1 \
xcodebuild -workspace ios/App/App.xcworkspace -scheme App \
  -configuration Release -sdk iphoneos -destination 'generic/platform=iOS' \
  CODE_SIGNING_ALLOWED=NO build
```

### 미완료

연결된 iPhone Air는 확인했지만, 유효한 코드 서명 인증서가 없고 배포할 팀이 지정되지 않았습니다. App Store Connect도 로그인되지 않았습니다. 따라서 실기기 설치·최초/오프라인 번역·PDF/HWP 저장·서명 Archive·TestFlight 업로드·외부 베타 심사는 아직 검증/완료하지 않았습니다.

TestFlight 배포는 Apple Developer Program 가입 팀이 필요합니다. 기본 연회비는 US$99(지역별 결제 금액 표시)이고, 기존 가입 팀의 권한을 부여받으면 별도 개인 가입은 필요하지 않습니다. 무료 Apple 계정의 Xcode 개인 기기 테스트와 TestFlight 배포를 구분합니다.
