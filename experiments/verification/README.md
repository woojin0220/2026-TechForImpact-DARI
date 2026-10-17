# DARI Verification Architecture Lab

이 디렉터리는 DARI의 번역 의미 검증 방식을 비교하고, 아키텍처가 실험에 적합한지 확인하기 위한 독립 연구 공간이다. 현재 DARI 앱이나 `local_verification_server.py`와 연결되어 있지 않다.

## 이 단계의 목표

- 같은 입력 문장쌍을 여러 검증 방식에 반복해서 실행한다.
- 모든 방식이 같은 입력·출력 계약을 사용하게 한다.
- 단순 점수보다 오류 유형과 원문·번역문 근거 구절을 비교한다.
- 모델 실패, 지원하지 않는 언어, 잘못된 출력은 `문제 없음`이 아니라 `indeterminate`로 남긴다.
- 데이터셋, 모델, 프롬프트, 설정, 실행 결과를 다시 확인할 수 있게 기록한다.

## 이 단계에서 하지 않는 것

- 현재 모바일·웹 서비스와 연동
- 진술의 사실성, 신빙성 또는 난민 인정 가능성 판단
- 법률 자문 또는 신청자에게 유리한 문장 생성
- 실제 신청자 진술을 Git에 저장
- 하나의 종합 점수만으로 번역의 안전성을 판정

## 핵심 문서

- [SERVICE_STRATEGY.md](SERVICE_STRATEGY.md): 시간이 없을 때 먼저 보는 v0.4 서비스·연구 결정 요약
- [ARCHITECTURE.md](ARCHITECTURE.md): Evidence-linked Case Record 중심 v0.4 구조, 모듈 입출력, 모델 교체와 개인정보 경계
- [GRAPH_METHOD.md](GRAPH_METHOD.md): candidate claim 추출과 선택적 relational micrograph plugin
- [TEST_PLAN.md](TEST_PLAN.md): case export 중심 baseline, model-upgrade resilience, 사용자 impact와 Go/Pivot/Kill 기준
- [DESIGN_REVIEW.md](DESIGN_REVIEW.md): 현재 코드의 공백, 해외 사례, 해자와 비판적 최종 평가
- [docs/architecture_v0.4.svg](docs/architecture_v0.4.svg): 모델 발전 뒤에도 남는 제품 구조와 연구 gate를 한 장으로 정리한 다이어그램
- [v0.4 서비스·연구 전략 보고서](../../output/pdf/DARI_service_research_strategy_v0.4.pdf): 핵심 결정, 경쟁 지형, 아키텍처, 실험과 중단 기준을 담은 시각 보고서
- [schemas/input.schema.json](schemas/input.schema.json): 모든 검증 방식이 받는 공통 입력
- [schemas/report.schema.json](schemas/report.schema.json): 모든 검증 방식이 반환하는 공통 결과
- [schemas/fixture.schema.json](schemas/fixture.schema.json): 합성 fixture와 gold annotation 계약
- [fixtures/README.md](fixtures/README.md): 합성 평가 사례 작성 규칙
- [results/README.md](results/README.md): 실행 결과와 manifest 보관 규칙
- [demos/graph_pipeline/README.md](demos/graph_pipeline/README.md): 모델 없이 실행하는 세 개의 짧은 사례와 한 개 문단의 graph module input/output 예시
- [tools/graph_viewer/README.md](tools/graph_viewer/README.md): 생성된 graph, 모듈 trace, alignment와 finding을 실시간으로 확인하는 로컬 viewer
- [tools/assurance_demo/README.md](tools/assurance_demo/README.md): v0.4의 read-back, Case Record, 수정 후 delta gate와 evidence review를 실행하는 대화형 데모

## 현재 실행 가능한 시작점

외부 모델이나 패키지 없이 A단계 contract harness를 실행할 수 있다. Python 구현은 입력·결과·근거 span을 검사하고, adapter 실패를 구조화된 `indeterminate` 결과로 바꾸며, 한 사례가 실패해도 batch의 다음 사례를 계속 실행한다.

```powershell
python -m unittest discover -s experiments/verification/tests -t experiments/verification -v
```

네 개의 hand-authored graph 사례로 전체 module 흐름을 확인하려면 다음을 실행한다.

```powershell
python experiments/verification/demos/graph_pipeline/run_demo.py
```

v0.4의 전체 서비스 흐름을 브라우저에서 직접 눌러 보려면 다음을 실행하고 `http://127.0.0.1:8874`에 접속한다.

```powershell
python experiments/verification/tools/assurance_demo/serve.py
```

현재 [synthetic_cases.jsonl](fixtures/synthetic_cases.jsonl)에는 15개의 가상 사례가 있다. 7개 오류 변이에는 각각 faithful control이 있고, 별도로 문서 안의 지시문 형태 문자열을 일반 데이터로 처리하는 회귀 사례가 있다. 이 fixture는 `human_reviewed: false`이므로 아키텍처 시험용이며 모델 성능 근거로 사용하지 않는다.

구현 경계는 다음과 같다.

- `src/dari_verification/contracts.py`: 실행 시 semantic contract 검증
- `src/dari_verification/fixtures.py`: strict JSONL 로딩, 중복 ID와 gold 검증
- `src/dari_verification/pipeline.py`: strategy 실행, 실패 격리, finding 병합
- `src/dari_verification/batch.py`: 검증된 fixture의 순차 batch 실행
- `tests/`: 네트워크 없는 contract 및 회귀 시험

## 설계 원칙

1. 지원자가 확인한 claim과 exact evidence를 모델 밖의 기준으로 유지한다.
2. 생성과 모든 수정 뒤 claim coverage와 semantic delta를 다시 계산한다.
3. 의미 충실성, 기록 무결성, 법적 타당성을 분리한다.
4. 생성기와 검출기는 adapter 뒤에서 교체하고 모델·prompt·version을 기록한다.
5. 실패, 불확실성과 판단 보류를 정상 상태로 모델링한다.
6. graph는 관계 오류에서 baseline을 이길 때만 선택적으로 사용한다.
7. 원시 진술과 정정 이력은 최소화하고 역할별 export와 삭제 정책을 둔다.
8. 실제 사용자 데이터가 없어도 frozen benchmark를 재현할 수 있게 한다.

## 예정된 비교 방식

| ID | 방식 | 역할 |
| --- | --- | --- |
| `current_ui` | 현재 일괄 확인, 초안, 직접 수정 흐름 | 서비스 baseline |
| `frontier_direct` | 평가 시점의 최신 강한 모델 직접 생성 | 모델 발전을 반영한 생성 baseline |
| `direct_self_check` | 생성 모델의 자체 검수 | 가장 쉽게 추가할 수 있는 검수 baseline |
| `source_linked_judge` | 원문 evidence를 함께 보는 direct judge | 단순하지만 강한 provenance baseline |
| `claim_controlled` | Claim Ledger와 Semantic Contract 기반 생성 | 오류 예방 가설 |
| `provenance_gate` | flat claim delta와 evidence review | DARI 기본 제안 |
| `selective_graph` | 관계 오류에만 micrograph 추가 | graph의 순수 추가 가치 검증 |
| `bilingual_human` | 이중언어 사람의 전체 검토 | 실제 안전성과 시간 기준 |

모델 이름은 프로토콜에 넣지 않는다. 각 방법의 구현과 모델은 실행 manifest에 기록한다.

## 브랜치 사용

이 실험은 `experiment/verification-architecture` 브랜치에서 진행한다. 문서와 실험 코드는 이 디렉터리 안에 두고, 앱 연동은 별도의 결정과 브랜치에서 진행한다.

```powershell
git fetch origin
git switch experiment/verification-architecture
git pull --ff-only
```

## 데이터 규칙

- Git에는 `synthetic`으로 표시한 가상 사례만 커밋한다.
- 실제 신청자 진술, 개인 식별 정보, 인터뷰 원문은 커밋하지 않는다.
- 실제 자료를 이용한 비공개 평가가 필요하면 Git 밖의 경로를 사용하고 dataset ID와 집계 지표만 결과 manifest에 남긴다.
- 생성 모델로 만든 사례는 생성 방법과 사람이 확인한 범위를 fixture metadata에 기록한다.

## 연구 근거

- [CometKiwi, WMT 2022](https://aclanthology.org/2022.wmt-1.60/)
- [xCOMET, TACL 2024](https://aclanthology.org/2024.tacl-1.54/)
- [QuestEval, EMNLP 2021](https://aclanthology.org/2021.emnlp-main.529/)
- [S2MATCH, TACL 2020](https://aclanthology.org/2020.tacl-1.34/)
- [WMT25 Automated Translation Evaluation](https://aclanthology.org/2025.wmt-1.24/)
- [ACES and SPAN-ACES](https://aclanthology.org/2025.cl-1.4/)
- [Tarjimly FirstPass](https://www.tarjimly.org/firstpass-landing)
- [UNHCR RiMAP](https://www.unhcr.org/innovation/project/rimap-ai-virtual-assistant-refugee-law-support-protection)
- [CoCounsel Legal workflow](https://legal.thomsonreuters.com/en/legal/draft-review-analysis-corp)
- [Stanford AI Index 2025](https://hai.stanford.edu/ai-index/2025-ai-index-report)

이 자료들은 후보 baseline, 제품 경계와 모델 발전 가정을 정하는 근거다. DARI 문맥에서 실제 성능이나 시장성을 보장한다는 뜻은 아니며, 언어 지원과 모델 사용 조건은 각 실험 manifest에서 별도로 확인한다.
