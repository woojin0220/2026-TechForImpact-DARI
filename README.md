# DARI

DARI는 난민인정신청자가 공식 문항을 모국어로 이해하고 답변할 수 있도록 돕는 프로토타입입니다. 작성한 답변을 영어 신청서 초안과 한국어 참고본으로 번역하고, 모든 문항 작성이 끝난 뒤 원문과 영어본 사이의 의미 왜곡 후보를 확인합니다.

현재 버전은 사용자 흐름과 기술 가능성을 확인하기 위한 MVP입니다. 법률 자문, 진술의 신빙성 판단, 난민 인정 가능성 예측, 심사에 유리한 문장 생성은 제공하지 않습니다.

## 문서

- [현재 구현과 한계](docs/IMPLEMENTATION.md)
- [향후 논의·결정 사항](docs/OPEN_DECISIONS.md)
- [Capacitor 웹 기반 전환 안내](docs/CAPACITOR_MIGRATION.md)

## 현재 개발 기준: Capacitor 웹 앱

새 기능은 [`capacitor-web/`](capacitor-web/)의 React·TypeScript·Capacitor 앱을 기준으로 개발합니다. 하나의 웹 화면을 Android와 iOS 네이티브 래퍼에서 함께 사용하기 위한 전환입니다. 기존 루트의 Kotlin Android 앱은 ML Kit 온디바이스 번역을 실험한 참고 구현으로 남아 있으며 삭제하지 않았습니다.

웹 MVP는 현재 개발용 로컬 Ollama 서버로 번역과 검증을 수행합니다. 온디바이스 번역은 `TranslationProvider`를 통해 이후 교체할 계획입니다. 자세한 실행 및 전환 절차는 [Capacitor 웹 기반 전환 안내](docs/CAPACITOR_MIGRATION.md)를 확인해 주세요.

## 주요 기능

1. 러시아어·아랍어·프랑스어·페르시아어 문항 안내와 답변 입력
2. Google ML Kit을 이용한 온디바이스 `선택 언어 → 영어 → 한국어` 번역
3. 문항별 원문·영어·한국어 최종본 확인
4. 개인정보 제외본 확인 및 수정
5. Qwen3 4B 또는 Llama 3.2 3B를 이용한 전체 번역본 검증
6. 누락·추가·부정 반전·행위자·시간·인과관계·피해 강도 등의 왜곡 후보 표시

UI에 있는 네 언어는 데모 범위이며 공식 지원 언어로 확정된 것은 아닙니다. 실제 문항 번역도 공인 통역 또는 관련 전문가의 검토가 필요합니다.

## 시스템 구조

```text
Android 앱 또는 에뮬레이터
  ├─ 모국어 문항과 답변 입력
  ├─ ML Kit 온디바이스 번역
  │    └─ 선택 언어 → 영어 → 한국어
  ├─ 영어·한국어 병기본 표시
  └─ 사용자가 확인한 개인정보 제외본 전송
                    │
                    ▼
개발 컴퓨터의 DARI 검증 서버
  └─ Ollama
       ├─ Qwen3 4B
       └─ Llama 3.2 3B
```

기계번역은 Android 기기 안에서 처리됩니다. LLM 검증은 개발 컴퓨터에서 실행되는 Ollama가 담당합니다. 현재 구성은 외부 클라우드 LLM API를 사용하지 않습니다.

## 개발 환경

현재 저장소에서 확인한 환경은 다음과 같습니다.

- Android API 23 이상
- Android SDK 36
- Java 17 이상
- Python 3
- Ollama
- 약 5GB 이상의 모델 저장 공간

Android Studio를 사용해도 되고 Gradle Wrapper로 명령줄에서 빌드해도 됩니다. Ollama 설치 방법은 운영체제에 따라 다르므로 [Ollama 공식 사이트](https://ollama.com/)를 참고해 주세요.

## 처음 실행하기

### 1. 저장소 받기

```bash
git clone https://github.com/woojin0220/2026-TechForImpact-DARI.git
cd 2026-TechForImpact-DARI
```

### 2. Android SDK 경로 설정

Android Studio에서 프로젝트를 열면 SDK 경로를 자동으로 설정할 수 있습니다. 명령줄에서 빌드한다면 프로젝트 루트에 커밋되지 않는 `local.properties`를 만들고 자신의 SDK 경로를 지정합니다.

```properties
sdk.dir=/사용자별/Android/Sdk/경로
```

다른 사람의 `local.properties`를 복사하면 안 됩니다. 이 파일은 각 개발 환경마다 달라 Git에서 제외되어 있습니다.

### 3. Ollama와 모델 준비

Ollama를 실행한 뒤 두 테스트 모델을 내려받습니다.

```bash
ollama serve
```

다른 터미널에서 실행합니다.

```bash
ollama pull qwen3:4b
ollama pull llama3.2:3b
```

macOS에서 Homebrew 서비스로 Ollama를 실행하는 경우에는 `ollama serve` 대신 다음 명령을 사용할 수 있습니다.

```bash
brew services start ollama
```

모델 설치 여부는 다음 명령으로 확인합니다.

```bash
ollama list
```

### 4. DARI 로컬 검증 서버 실행

프로젝트 루트에서 실행합니다.

```bash
python3 local_verification_server.py
```

정상적으로 실행되면 다음 주소가 표시됩니다.

```text
DARI local verification server: http://127.0.0.1:8765
```

이 터미널은 앱을 테스트하는 동안 계속 실행해 두어야 합니다.

### 5. Android 앱 빌드

macOS 또는 Linux:

```bash
./gradlew assembleDebug
```

Windows:

```powershell
gradlew.bat assembleDebug
```

생성된 APK는 다음 위치에 있습니다.

```text
app/build/outputs/apk/debug/app-debug.apk
```

Android Studio를 사용하는 경우 API 23 이상의 에뮬레이터를 선택해 Run을 실행하면 됩니다.

## `10.0.2.2:8765`의 의미

현재 앱은 Android Emulator에서 실행하는 개발 환경을 기준으로 구성되어 있습니다. Android Emulator 안에서 `10.0.2.2`는 특정 팀원의 컴퓨터 주소가 아니라 **에뮬레이터를 실행한 개발 컴퓨터의 루프백 주소**를 가리키는 예약 주소입니다.

따라서 각 개발자는 자신의 컴퓨터에서 다음 두 프로그램을 실행합니다.

1. Ollama 서버: `127.0.0.1:11434`
2. DARI 검증 서버: `127.0.0.1:8765`

에뮬레이터의 앱은 `http://10.0.2.2:8765`로 요청해 같은 개발 컴퓨터의 DARI 서버에 연결합니다. 기본 주소는 [`app/build.gradle.kts`](app/build.gradle.kts)의 `VERIFICATION_API_BASE_URL`에 정의되어 있습니다.

이 주소는 실제 Android 휴대전화에서는 동작하지 않습니다. 실제 기기 테스트는 서버 주소, 네트워크 바인딩, HTTPS와 접근 통제를 별도로 설계해야 합니다. 민감한 진술을 다루므로 단순히 서버를 `0.0.0.0`으로 공개하는 방식은 사용하지 마세요.

## 번역과 검증 데이터 흐름

### 기기 안에서 처리하는 정보

- 신청자가 입력한 모국어 답변
- 선택 언어에서 영어로 번역한 결과
- 영어에서 한국어로 번역한 결과
- 문항별 최종 번역본

ML Kit 언어 모델은 최초 실행 시 인터넷으로 내려받지만, 모델 다운로드 후 진술 번역 자체는 기기에서 처리됩니다.

### 로컬 검증 서버로 보내는 정보

- 사용자가 확인한 개인정보 제외 원문
- 사용자가 확인한 개인정보 제외 영어 번역본
- 선택한 언어와 검증 모델 이름

한국어 참고본은 LLM 검증 요청에 포함하지 않습니다. 현재 서버는 요청 내용을 별도 파일이나 데이터베이스에 저장하지 않습니다.

## 개인정보 마스킹 상태

현재 앱은 정규식으로 이메일, 전화번호 형태, 일부 긴 식별번호 형태를 찾아 치환한 뒤 사용자가 실제 전송본을 수정하게 합니다. 이름, 주소, 여권번호, 국가별 식별번호를 완전하게 탐지하지 못하며 날짜를 전화번호로 오인할 가능성도 있습니다.

따라서 현재 기능을 개인정보가 완전히 제거된 것으로 간주하면 안 됩니다. 사건 날짜와 생년월일의 구분, 다국어 이름·주소 탐지, 국가별 식별번호 규칙은 향후 논의 사항입니다.

## 검증 결과의 의미

LLM은 다음과 같은 번역 변화의 후보를 찾습니다.

- 원문 내용 누락 또는 근거 없는 추가
- 부정·긍정 반전
- 확실성이나 강도의 변화
- 행위자·피해자·책임 주체 변경
- 날짜·기간·빈도·사건 순서 변경
- 인과관계나 동기 변경
- 피해·위협·강요 정도의 강화 또는 약화
- 원문에 없는 법률적·설득적 표현

결과의 `유리하게 강화`, `불리하게 약화`, `방향 불명확`은 번역 변화의 방향을 설명할 뿐 심사 결과를 예측하지 않습니다. 작은 로컬 모델은 오류를 놓치거나 유형을 잘못 분류할 수 있으므로 원문 작성자, 통역가 또는 법률 전문가가 최종 확인해야 합니다.

## 프로젝트 구조

```text
.
├── app/
│   └── src/main/java/org/dari/mvp/
│       ├── DariApp.kt
│       ├── MainActivity.kt
│       ├── TranslationRepository.kt
│       └── VerificationRepository.kt
├── docs/
│   ├── IMPLEMENTATION.md
│   └── OPEN_DECISIONS.md
├── local_verification_server.py
├── build.gradle.kts
└── settings.gradle.kts
```

## 문제 해결

### 앱에서 로컬 검증 서버에 연결하지 못하는 경우

- `local_verification_server.py` 터미널이 실행 중인지 확인합니다.
- `ollama list`에 두 모델이 표시되는지 확인합니다.
- Ollama가 `127.0.0.1:11434`에서 실행 중인지 확인합니다.
- Android Emulator를 사용하고 있는지 확인합니다. 실제 기기에서는 `10.0.2.2`가 동작하지 않습니다.
- 8765번 포트를 다른 프로그램이 사용하고 있지 않은지 확인합니다.

### 최초 번역 모델 다운로드가 실패하는 경우

- 에뮬레이터의 인터넷 연결을 확인합니다.
- Wi-Fi 네트워크로 인식되는지 확인합니다.
- 선택 언어→영어와 영어→한국어 모델이 모두 필요합니다.

### 첫 검증이 느린 경우

Ollama가 모델을 메모리에 처음 올리는 과정에서 시간이 걸릴 수 있습니다. 16GB 메모리 환경에서는 다른 대용량 프로그램을 함께 실행하면 응답이 더 느려질 수 있습니다.

## 현재 MVP에서 구현하지 않은 항목

- 공식 난민인정신청서 전체 문항
- 공식 검수를 마친 다국어 문항
- Word 또는 공식 신청서 형식 출력
- 운영용 인증·HTTPS·접근 권한 관리
- 국가별 개인정보 탐지
- 검증 모델 평가셋과 품질 기준
- 통역가·법률가 검토 및 수정 이력

구현을 변경하기 전에 [향후 논의·결정 사항](docs/OPEN_DECISIONS.md)에서 아직 확정되지 않은 내용을 확인해 주세요.
