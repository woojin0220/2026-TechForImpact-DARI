# 온디바이스 경량화 벤치마크

모델 경량화 실험(모델 크기, 양자화, 문맥 한도, 백엔드, 프롬프트·파이프라인 변경)의 효과를 **같은 시나리오, 같은 채점, 같은 기록 형식**으로 비교하기 위한 도구입니다. 판단 기준은 다음과 같습니다.

1. 모든 언어에서 안전 검사를 통과하는 조합만 남깁니다.
2. 남은 조합 중 가장 약한 언어의 품질이 가장 높은 조합을 고릅니다.
3. 품질이 비슷하면 더 낮은 기기에서 돌아가는 조합, 그다음 지연이 짧은 조합을 고릅니다.

## 현재 기본값 (b8)

앱의 추출 기본값은 **압축 형식(`compact`) + 선택적 보조 호출(`selective`)** 입니다. 선택적 보조 호출은 부정 표현이 있는데 "아니요"가 기록되지 않은 답변에만 주제 확인을 합니다. 아래는 Ollama `gemma4:e4b`에 스키마를 강제하고 6개 언어 × 10개 시나리오 × 3회를 실행한 결과입니다.

| 실행 | 형식 · 보조 호출 | 안전 | 가장 약한 언어 품질 | 턴 p50 / p90 (M1 Pro) | 호출/턴 | 휴대폰 E4B 추정 턴 |
| --- | --- | --- | --- | --- | --- | --- |
| b4 | compact · on | 348/360 | 88.3% | 22.2s / 32.8s | 3.1 | 24초 |
| b6 | compact · off | 338/360 | 87.5% | 9.2s / 12.8s | 1.0 | 13초 |
| **b8** | compact · selective | **349/358** | **94.2%** | 15.9s / 29.1s | 1.9 | 18초 |

- 보조 호출을 끄면(b6) "경찰에 도움을 요청할 수 없었다"를 18세션 중 14번 기록하지 못했습니다. 선택적 보조 호출에서는 2번입니다.
- 신청자가 부인한 주제는 다시 추출하지 않습니다. 이 수정으로 가족이 입은 피해를 신청자 피해로 기록하던 오류가 b4의 13건에서 0건이 됐습니다.
- 휴대폰 추정치는 모델 카드 속도(Galaxy S26 Ultra GPU: 입력 1,293 tok/s, 생성 22.1 tok/s)에 턴당 토큰 수를 곱한 값입니다. **실기기 측정은 아직입니다.**
- 휴대폰에서는 스키마 강제 디코딩이 여전히 꺼져 있습니다(벤치 옵션). 압축 형식과 스키마 강제의 조합은 Mac LiteRT-LM CPU에서 JSON이 정상인 것만 확인했으므로, 기본값으로 켤지는 실기기 측정 뒤에 정합니다.
- 다른 설정은 `--extract full`, `--aux on|off`로 비교합니다.

## 구성

| 구성 요소 | 위치 | 역할 |
| --- | --- | --- |
| 시나리오 | `capacitor-web/src/bench/scenarios.ts` | 가상 시나리오 10개 × 6개 언어(ko, en, fr, ru, ar, fa) |
| 채점 | `src/bench/score.ts` | 자유 텍스트 값은 언어별 기대 단어로 비교하고, 안전 검사를 따로 집계 |
| 실행·계측 | `src/bench/run.ts` | 실제 `src/intake` 흐름을 그대로 실행하며 호출마다 크기·지연·런타임 통계를 기록 |
| 요약 | `src/bench/summary.ts`, `scripts/bench-summary.mjs` | 언어별 표를 가장 약한 언어부터 표시 |
| Node 실행기 | `scripts/run-intake-scenarios.mjs` | Ollama 또는 Mac LiteRT-LM으로 실행 |
| Mac LiteRT-LM | `tools/litertlm-bench/` | 휴대폰과 같은 `.litertlm` 파일과 같은 런타임 버전(0.17.1)으로 Mac에서 실행 |
| 앱 벤치 패널 | `src/bench/BenchPanel.tsx` | 실기기에서 같은 시나리오를 실행. 개발 빌드나 `VITE_DARI_BENCH=1` 빌드에만 포함 |

## 시나리오와 채점

- **번역 시나리오는 아직 초안입니다.** 영어·프랑스어·러시아어·아랍어·페르시아어 문장은 한국어 원본을 옮긴 것입니다. 결과를 인용하기 전에 원어민 검토가 필요합니다. 페르시아어는 페르시아 숫자(۲۰۲۴)를 씁니다.
- **기대 단어가 원문에 있는지 테스트로 확인합니다.** 자유 텍스트 사실 값은 신청자 언어로 저장되므로 기대 단어도 언어마다 다릅니다. `tests/bench.test.mjs`가 언어별 기대 단어가 실제로 그 언어의 원문에 들어 있는지 검사합니다.
- **안전 검사**: 기본적으로 `lacks`·`notAnswered`이고, 여기에 기억나지 않는 날짜를 지어내지 않았는지와 전해 들은 일을 직접 겪은 일로 바꾸지 않았는지를 더했습니다. 초안의 인과관계 강화 금지(`초안 ⊅`)도 안전 검사입니다. **대화 턴이 실패한 세션은 안전 검사 집계에서 뺍니다.** 아무것도 추출하지 않으면 "지어내지 않음" 검사를 저절로 통과하기 때문입니다.
- **품질**: 안전 검사가 아닌 검사의 통과율입니다.

## 실행

모든 명령은 `capacitor-web/`에서 실행합니다. 결과는 `tmp/bench/<시각>-<이름>.jsonl`에 저장되며 `tmp/`는 git에 포함되지 않습니다.

### 1. Ollama (빠른 거름, 개발 PC)

```sh
python3 ../local_verification_server.py   # 다른 터미널에서 ollama serve
node --experimental-strip-types scripts/run-intake-scenarios.mjs --lang all --repeat 3
node --experimental-strip-types scripts/run-intake-scenarios.mjs --lang ko,fa,ar --format none   # 출력 제약 없음
```

`--format schema`(기본)는 JSON 스키마를 강제합니다. `json`은 형식만 JSON으로 강제하고, `none`은 제약을 두지 않습니다. 앱의 휴대폰 기본값은 제약 없음이므로, 스키마 강제가 품질에 주는 영향은 `schema`와 `none`을 비교해 확인합니다.

### 2. Mac LiteRT-LM (휴대폰과 같은 모델 파일)

```sh
swift build -c release --package-path ../tools/litertlm-bench
node --experimental-strip-types scripts/run-intake-scenarios.mjs --backend litertlm \
  --model ~/models/gemma-4-E4B-it.litertlm --lang ko,fa,ar --constrained off --ctx 16384 --accel gpu
```

`--constrained on`은 LiteRT-LM의 JSON 스키마 강제 디코딩(`enableResponseFormat` + `ResponseFormat.json`)입니다. 문맥 한도(`--ctx`)나 백엔드(`--accel`)를 바꾸면 엔진을 새로 불러옵니다.

### 3. 실기기

```sh
VITE_DARI_BENCH=1 npm run build && npx cap sync
# Android Studio / Xcode에서 설치 → 앱에서 .litertlm 가져오기
```

앱의 ⚙ 설정 → **성능 벤치마크**에서 언어, 반복 횟수, 스키마 강제, 문맥 한도, 백엔드를 고르고 실행합니다. 결과를 꺼내는 방법은 다음과 같습니다.

- Android: `adb logcat -d -s Capacitor/Console:I | grep -o 'DARI_BENCH .*' | sed 's/^DARI_BENCH //' > tmp/bench/device.jsonl`
- iOS: **JSONL 복사** 버튼으로 복사하거나 Xcode 콘솔의 `DARI_BENCH` 줄을 모읍니다.

화면이 꺼지면 진행이 멈출 수 있습니다. 충전 중 화면 켜짐 설정을 쓰면 충전 발열이 측정에 섞이니, 발열을 비교하는 실행에서는 충전하지 않고 화면 시간 제한만 늘립니다.

### 요약

```sh
node --experimental-strip-types scripts/bench-summary.mjs tmp/bench/*.jsonl
```

## 기록 형식 (JSONL)

| type | 내용 |
| --- | --- |
| `meta` | 실행 ID, 설정(백엔드·모델·제약·문맥·언어·반복), 기기(제조사·모델·SoC·RAM 또는 호스트 정보) |
| `call` | 시나리오, 언어, 턴(또는 `draft`), 작업 종류, 입력·출력 글자 수, 지연, JSON 파싱 가능 여부, `stats` |
| `session` | 통과/전체, 안전 통과/전체, 턴별 지연(엔진 로딩 시간 제외), 초안 지연, 오류, 검사별 결과 |

`stats`는 런타임이 측정할 수 있는 값만 담습니다.

| 값 | Ollama | Mac LiteRT-LM | Android | iOS |
| --- | --- | --- | --- | --- |
| 엔진 로딩 `initMs` | load_duration | 첫 호출 | 첫 호출 | 첫 호출 |
| `ttftMs`, prefill·decode 토큰 수, 초당 토큰 | 토큰 수·초당 토큰 (TTFT 없음) | ✓ | ✓ | ✓ |
| 메모리 | – | footprint·최대 footprint | RSS·호출 중 최대 RSS·PSS·가용 메모리 | footprint·최대 footprint·가용 메모리 |
| 발열·배터리 | – | – | 열 상태·배터리 온도·잔량 | 열 상태 |

## 측정의 한계

- **Ollama 결과는 휴대폰 품질의 근거가 될 수 없습니다.** GGUF 양자화와 `.litertlm` int4는 서로 다른 가중치입니다. 최종 판단은 실기기 결과로만 합니다.
- **LiteRT-LM 벤치 카운터가 늘 켜져 있습니다.** 앱 플러그인은 엔진을 만들 때 `ExperimentalFlags.enableBenchmark`를 항상 켭니다. 시간 측정용 카운터라 부하는 작을 것으로 보지만 확인하지는 않았습니다.
- **Android 메모리**
  - 호출마다 `/proc/self/clear_refs`로 최대 RSS를 초기화합니다. 기기에 따라 막혀 있을 수 있으며, 이때는 `peakReset: false`이고 최대값은 프로세스 시작 이후 기준입니다.
  - GPU 버퍼는 RSS에 잡히지 않을 수 있어 PSS(드라이버가 보고하면 그래픽 메모리 포함)를 함께 기록합니다.
- **iOS 최대 footprint는 프로세스 전체 기간 기준입니다.** 조건을 바꿔 비교할 때는 앱을 다시 실행합니다.
- **Mac 메모리 값은 휴대폰과 비교할 수 없습니다.** 통합 메모리라 Mac 값은 참고용입니다.
- **실행 순서에 따라 발열이 쌓입니다.** 지연을 비교할 때는 조건 사이에 기기를 식히고 배터리 온도를 함께 봅니다.
- **앱 휴리스틱의 다국어 표현은 아직 초안입니다.** 정정 감지(`CORRECTION`)와 모름 감지(`UNCERTAIN`) 정규식(`src/intake/index.ts`)이 이제 6개 언어를 모두 다룹니다. 다만 표현 목록은 원어민 검토 전입니다. "en fait", "на самом деле", "بلکه"처럼 정정이 아닌 문맥에서도 쓰이는 표현은 오탐 가능성이 있습니다.
