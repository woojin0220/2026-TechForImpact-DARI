# 온디바이스 대화·초안 실행

Android와 iOS Capacitor 앱은 `OnDeviceLlm` 플러그인을 통해 LiteRT-LM을 직접 호출합니다. 브라우저 미리보기는 별도의 로컬 서버/Ollama 경로입니다. 모바일에서 모델 파일이 없거나 실행에 실패해도 서버 추론으로 자동 전환하지 않습니다.

## 고정한 버전과 설정

| 항목 | 값 |
| --- | --- |
| Android runtime | `com.google.ai.edge.litertlm:litertlm-android:0.17.1` |
| Kotlin Gradle plugin | `2.4.0` — 해당 runtime의 Kotlin metadata와 맞춤 |
| iOS Swift package | `https://github.com/google-ai-edge/LiteRT-LM`, exact `0.17.1` |
| 백엔드 | Android GPU / iOS Metal GPU, 텍스트 전용 |
| 문맥 한도 | 입력과 출력 합계 16,384 tokens |
| 출력 한도 | 요청별 64~4,096 tokens, 기본 2,048 |
| 샘플링 | top-k 40, top-p 0.95, 기본 temperature 0.2; 앱 adapter는 0.1 |
| thinking | 비활성화 |

모델 파일은 앱에 포함하지 않습니다. 모델 크기 외에도 16k 문맥 캐시, 런타임과 앱 메모리가 필요하므로 최신 실기기에서 속도와 메모리를 측정해야 합니다. APK 빌드 성공은 특정 모델/기기에서 추론 성공을 뜻하지 않습니다.

## 모델 준비와 가져오기

1. [LiteRT community](https://huggingface.co/litert-community) 또는 모델 제작자의 공식 저장소에서 해당 runtime과 GPU에 호환되는 **`.litertlm`** 파일을 준비합니다. Gemma의 경우 해당 배포본의 이용 조건과 접근 절차를 확인합니다.
2. 모델 파일을 휴대폰의 파일 앱에서 선택할 수 있는 위치에 저장합니다. 대용량 파일 다운로드는 앱 밖에서 진행합니다.
3. DARI 앱 설정의 모델 가져오기에서 파일을 선택합니다. Android 시스템 파일 선택기 또는 iOS 문서 선택기가 열립니다.
4. 가져오기가 끝나면 대화를 시작합니다. 엔진은 첫 생성 요청 때 초기화되므로 첫 응답은 더 오래 걸릴 수 있습니다.
5. 모델을 한 번 가져온 뒤 네트워크를 끄고 실제 대화·초안 생성이 가능한지 확인합니다.

`modelReady`는 **파일이 앱 내부에 저장되었다**는 뜻입니다. 모델 메타데이터/연산자/GPU 호환성과 메모리 확보는 첫 초기화에서 확인하며, 실패 시 오류를 표시합니다. 파일 이름만 바꾸어 호환시킬 수는 없습니다. Ollama 모델 blob, GGUF, `.task` 파일은 이 가져오기 경로의 대상이 아닙니다. Gemma 4 E4B나 Gemma 3n E4B라는 이름만으로 모든 양자화·배포 포맷의 호환성을 보장하지 않습니다.

## 저장 위치와 데이터 처리

- Android: `context.noBackupFilesDir/dari-model.litertlm`
- iOS: 앱의 `Application Support/DariModels/dari-model.litertlm` (백업 제외)
- 원래 모델 이름만 Android SharedPreferences / iOS UserDefaults에 저장합니다.
- 파일을 임시 경로로 복사한 뒤 교체하므로 복사 실패 시 기존 모델을 유지합니다. 교체 시 새 파일과 기존 파일이 함께 들어갈 여유 저장 공간이 필요합니다.
- 플러그인은 사용자 대화나 초안을 파일 또는 로그로 저장하지 않습니다. 각 생성 요청마다 독립적인 conversation을 만들고 종료 후 해제하며, 모델 engine만 재사용합니다.
- 원문·메타데이터·초안의 보관과 내보내기는 웹 앱의 별도 기능입니다. 모델 파일을 내보내기 결과에 포함하지 않습니다.

## 호출 계약과 동시 실행

`src/lib/onDeviceLlm.ts`가 공통 인터페이스를 정의합니다.

```ts
getStatus(): Promise<{ platform, available, modelReady, modelName, modelPath, busy }>
importModel(): Promise<status>
generate({ system, prompt, maxTokens?, temperature?, responseSchema?, maxNumTokens?, backend? }): Promise<{ text: string, stats }>
cancel(): Promise<void>
```

`responseSchema`(JSON 스키마 강제 디코딩), `maxNumTokens`(문맥 한도), `backend`(`gpu`/`cpu`)는 벤치마크용 옵션입니다. 앱은 기본값(제약 없음, 16k, GPU)으로만 호출합니다. 문맥 한도나 백엔드가 바뀌면 엔진을 다시 불러옵니다. `stats`는 엔진 로딩 시간, TTFT, prefill·decode 토큰 수와 초당 토큰, 메모리, 발열을 담습니다. `getStatus()`는 기기 정보(`device`)를 함께 돌려줍니다. 자세한 내용은 [경량화 벤치마크](BENCHMARK.md)를 참고하세요.

가져오기 또는 생성은 한 번에 하나만 실행하며 다음 요청은 `BUSY`로 거절합니다. 취소는 runtime의 cancellation API로 전달합니다. 초기 모델 로딩 도중에는 즉시 중단되지 않을 수 있으나 로딩이 끝나면 취소 여부를 확인해 생성을 시작하지 않습니다. Android는 네이티브 conversation 해제와 취소가 겹치지 않도록 잠금을 사용합니다. iOS는 동일 잠금 아래 참조를 유지하며 Swift ARC가 conversation을 정리합니다.

## 현재 확인 범위

- Android `:app:assembleDebug` 전체 빌드 통과. Android Studio에 번들된 JDK 21로 실행했습니다.
- iOS Swift 구문 검사와 Xcode project 파일 형식 검사 통과.
- 이 Mac에는 전체 Xcode/iOS SDK가 없어 iOS 링크·서명·실기기 실행은 확인하지 못했습니다.
- 연결된 Android/iOS 실기기와 모바일 `.litertlm` 가중치가 없어 **휴대폰 추론·오프라인 동작·발열·속도·메모리 측정은 아직 하지 않았습니다.** 브라우저의 Ollama 실행 결과와 구분해야 합니다.
- 웹 UI 변경 후에는 `npm run build`, `npx cap sync android` 또는 `npx cap sync ios`로 자산을 반영하고 각 플랫폼을 다시 빌드합니다. `CapApp-SPM/Package.swift`는 Capacitor가 관리하므로 LiteRT-LM은 Xcode 프로젝트의 별도 고정 package dependency로 연결했습니다.

공식 API 참고: [Android/Kotlin](https://github.com/google-ai-edge/LiteRT-LM/blob/v0.17.1/docs/api/kotlin/getting_started.md), [Swift](https://developers.google.com/edge/litert-lm/swift), [고정 버전 소스](https://github.com/google-ai-edge/LiteRT-LM/tree/v0.17.1).
