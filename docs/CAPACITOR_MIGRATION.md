# Capacitor 웹 기반 전환

`capacitor-web/`은 Android와 iOS에서 함께 사용할 수 있도록 추가한 React·TypeScript·Capacitor 기반 MVP입니다. 기존 루트의 Kotlin Android 앱은 초기 온디바이스 번역 실험을 담은 참고 구현으로 남겨 두었습니다. 두 구현을 동시에 수정하기보다, 이후 기능 개발은 `capacitor-web/`을 기준으로 진행합니다.

## 현재 데이터 흐름

```text
Capacitor 웹 화면
  ├─ 선택 언어로 공식 문항을 보여 주고 그 아래 영어를 두며, 같은 언어로 답변 입력
  ├─ 모든 문항을 저장한 뒤 번역: 기기에서는 ML Kit, 브라우저에서는 로컬 서버. 선택 언어 → 영어 → 한국어
  ├─ 원문·영어·한국어 병기 검토
  └─ 자유 서술 원문·영어본의 왜곡 후보를 한 번에 검증
                         │
                         ▼
                local_verification_server.py
                         │
                         ▼
                       Ollama
```

Android·iOS 앱의 번역은 기기의 Google ML Kit 언어 모델을 사용합니다. 선택 언어→영어와 영어→한국어 모델은 최초 사용 전에 기기에 내려받으며, 그 진술은 외부 번역 서버로 전송하지 않습니다. 브라우저 미리보기는 로컬 Ollama로 같은 순서를 번역합니다. 로컬 Ollama 서버는 브라우저 번역과, 번역이 끝난 뒤의 왜곡 검증에 사용합니다. 서버는 `127.0.0.1`에만 열리므로 같은 컴퓨터의 브라우저·에뮬레이터만 접근할 수 있습니다. 실제 신청자 진술을 다룰 때 이 서버를 인터넷이나 LAN에 그대로 공개해서는 안 됩니다.

## 실행

Android·iOS 앱은 ML Kit으로 번역합니다. 브라우저 개발 서버는 화면 확인과 로컬 서버 번역용이며, ML Kit은 웹 브라우저 API가 아닙니다.

번역 왜곡 검증까지 테스트하려면 터미널 1에서 Ollama와 로컬 서버를 실행합니다.

```bash
ollama serve
python3 local_verification_server.py
```

터미널 2에서 웹 앱을 실행합니다.

```bash
cd capacitor-web
npm install
npm run dev
```

브라우저 개발 서버는 화면 확인용입니다. Android 에뮬레이터에서 검증을 실행하면 기본 서버 주소는 `http://10.0.2.2:8765`입니다. 이 주소는 해당 개발자가 실행한 자신의 컴퓨터를 뜻합니다.

## Android·iOS 프로젝트 생성

의존성 설치 후 다음 순서로 네이티브 래퍼를 만듭니다.

```bash
cd capacitor-web
npm run build
npx cap add android
npx cap add ios
npx cap sync
```

생성된 Android와 iOS 폴더는 Capacitor가 관리하는 플랫폼 프로젝트입니다. 웹 화면이나 의존성을 바꾼 뒤에는 `npm run build`와 `npx cap sync`를 다시 실행합니다.

## ML Kit 플러그인 구성

`src/lib/mlKitTranslation.ts`가 웹 코드와 네이티브 플러그인을 연결하며, `src/lib/api.ts`의 `MlKitTranslationProvider`가 이를 사용합니다.

1. Android 구현: `android/app/src/main/java/org/dari/app/MlKitTranslationPlugin.java`
2. iOS 구현: `ios/App/App/MlKitTranslationPlugin.swift`
3. Android는 `com.google.mlkit:translate:17.0.3`을 사용합니다.
4. iOS는 ML Kit이 CocoaPods로 제공되므로 `ios/App/Podfile`의 `GoogleMLKit/Translate`를 설치해야 합니다.

이 프로젝트 환경에는 CocoaPods가 설치되어 있지 않아 iOS 의존성 설치와 Xcode 빌드는 아직 실행하지 못했습니다. iOS에서 처음 실행하기 전 `cd capacitor-web/ios/App && pod install`을 실행한 뒤 생성된 `App.xcworkspace`를 Xcode로 열어야 합니다. ML Kit 번역 모델은 약 30MB 수준이므로 언어별 다운로드 동의와 저장 공간 정책을 실제 서비스 전에 확정해야 합니다.

## 검증과 개인정보의 한계

검증 요청에는 한국어 참고본을 보내지 않고 모국어 원문과 영어 초안만 보냅니다. 웹 MVP의 자동 마스킹은 이메일과 전화번호 형태에 한정됩니다. 이름, 주소, 여권·등록번호, 생년월일과 사건 날짜의 구분은 정책과 탐지 기준이 정해지기 전까지 자동으로 안전하다고 간주할 수 없습니다. 사용자가 전송 전 확인할 수 있는 화면을 유지하며, 국가별 식별자와 날짜 정책은 별도로 결정해야 합니다.

LLM 검증은 과장·완화, 추가·누락, 부정 반전, 행위자·시간·인과관계·피해 강도 변화 등의 후보를 분류할 뿐, 사실성·난민 인정 가능성·법률적 충분성을 판단하지 않습니다.
