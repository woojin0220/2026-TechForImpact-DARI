# Capacitor 웹 기반 전환

`capacitor-web/`은 Android와 iOS에서 함께 사용할 수 있도록 추가한 React·TypeScript·Capacitor 기반 MVP입니다. 기존 루트의 Kotlin Android 앱은 초기 온디바이스 번역 실험을 담은 참고 구현으로 남겨 두었습니다. 두 구현을 동시에 수정하기보다, 이후 기능 개발은 `capacitor-web/`을 기준으로 진행합니다.

## 현재 데이터 흐름

```text
Capacitor 웹 화면
  ├─ 선택 언어로 공식 문항 표시 및 답변 입력
  ├─ 로컬 Ollama 번역: 선택 언어 → 영어 → 한국어
  ├─ 원문·영어·한국어 병기 검토
  └─ 원문·영어본의 왜곡 후보 검증
                         │
                         ▼
                local_verification_server.py
                         │
                         ▼
                       Ollama
```

현재 번역과 검증은 모두 개발 컴퓨터의 `local_verification_server.py`와 Ollama를 사용합니다. 서버는 `127.0.0.1`에만 열리므로 같은 컴퓨터의 브라우저·에뮬레이터만 접근할 수 있습니다. 실제 신청자 진술을 다룰 때 이 서버를 인터넷이나 LAN에 그대로 공개해서는 안 됩니다.

## 실행

터미널 1에서 Ollama와 로컬 서버를 실행합니다.

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

브라우저 개발 서버는 기본적으로 `http://localhost:5173`에서 열립니다. Android 에뮬레이터에서 Capacitor 앱을 실행하면 기본 서버 주소는 `http://10.0.2.2:8765`이고, 브라우저에서는 `http://localhost:8765`입니다. 각 주소는 해당 개발자가 실행한 자신의 컴퓨터를 뜻합니다.

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

## 온디바이스 번역으로 바꾸는 방법

웹 앱의 `src/lib/api.ts`에는 `TranslationProvider` 인터페이스가 있습니다. 현재 `LocalServerTranslationProvider`가 이를 구현합니다. 향후 다음 절차로 교체합니다.

1. Android·iOS 모두를 지원하는 온디바이스 번역 Capacitor 플러그인을 선택하거나 자체 플러그인을 구현합니다.
2. 플러그인이 언어 모델 다운로드 동의, 언어쌍 지원 여부, 오프라인 실패 상태를 반환하도록 설계합니다.
3. `OnDeviceTranslationProvider`를 추가하고, 플랫폼에서 가능할 때 해당 구현을 선택합니다.
4. 지원하지 않는 언어 또는 모델 미설치 상태의 대체 흐름을 정합니다. 민감한 진술을 외부 서버로 자동 전송하지 않습니다.
5. 실제 난민 진술과 무관한 평가셋으로 언어쌍별 충실도와 오류 유형을 측정합니다.

따라서 현재 로컬 서버 번역은 개발용 대체 수단이며, 온디바이스 번역 완료를 의미하지 않습니다.

## 검증과 개인정보의 한계

검증 요청에는 한국어 참고본을 보내지 않고 모국어 원문과 영어 초안만 보냅니다. 웹 MVP의 자동 마스킹은 이메일과 전화번호 형태에 한정됩니다. 이름, 주소, 여권·등록번호, 생년월일과 사건 날짜의 구분은 정책과 탐지 기준이 정해지기 전까지 자동으로 안전하다고 간주할 수 없습니다. 사용자가 전송 전 확인할 수 있는 화면을 유지하며, 국가별 식별자와 날짜 정책은 별도로 결정해야 합니다.

LLM 검증은 과장·완화, 추가·누락, 부정 반전, 행위자·시간·인과관계·피해 강도 변화 등의 후보를 분류할 뿐, 사실성·난민 인정 가능성·법률적 충분성을 판단하지 않습니다.
