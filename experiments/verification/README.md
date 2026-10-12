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

- [ARCHITECTURE.md](ARCHITECTURE.md): 경계, 데이터 흐름, 공통 계약, 실패 처리
- [TEST_PLAN.md](TEST_PLAN.md): 아키텍처 시험, 모델 비교 실험, 평가 지표와 단계별 통과 조건
- [schemas/input.schema.json](schemas/input.schema.json): 모든 검증 방식이 받는 공통 입력
- [schemas/report.schema.json](schemas/report.schema.json): 모든 검증 방식이 반환하는 공통 결과
- [schemas/fixture.schema.json](schemas/fixture.schema.json): 합성 fixture와 gold annotation 계약
- [fixtures/README.md](fixtures/README.md): 합성 평가 사례 작성 규칙
- [results/README.md](results/README.md): 실행 결과와 manifest 보관 규칙

## 현재 실행 가능한 시작점

외부 모델이나 패키지 없이 A단계 contract harness를 실행할 수 있다. Python 구현은 입력·결과·근거 span을 검사하고, adapter 실패를 구조화된 `indeterminate` 결과로 바꾸며, 한 사례가 실패해도 batch의 다음 사례를 계속 실행한다.

```powershell
python -m unittest discover -s experiments/verification/tests -t experiments/verification -v
```

현재 [synthetic_cases.jsonl](fixtures/synthetic_cases.jsonl)에는 15개의 가상 사례가 있다. 7개 오류 변이에는 각각 faithful control이 있고, 별도로 문서 안의 지시문 형태 문자열을 일반 데이터로 처리하는 회귀 사례가 있다. 이 fixture는 `human_reviewed: false`이므로 아키텍처 시험용이며 모델 성능 근거로 사용하지 않는다.

구현 경계는 다음과 같다.

- `src/dari_verification/contracts.py`: 실행 시 semantic contract 검증
- `src/dari_verification/fixtures.py`: strict JSONL 로딩, 중복 ID와 gold 검증
- `src/dari_verification/pipeline.py`: strategy 실행, 실패 격리, finding 병합
- `src/dari_verification/batch.py`: 검증된 fixture의 순차 batch 실행
- `tests/`: 네트워크 없는 contract 및 회귀 시험

## 설계 원칙

1. 원문과 번역문은 서로의 내용을 보지 않고 독립적으로 구조화한다.
2. 검출 결과는 항상 실제 텍스트 범위에 연결한다.
3. 의미 비교와 법적 영향 판단을 분리한다.
4. 검증 방식은 adapter로 교체 가능하게 만든다.
5. 실패와 판단 보류를 정상 상태로 모델링한다.
6. 실제 사용자 데이터가 없어도 전체 시험을 재현할 수 있게 한다.

## 예정된 비교 방식

| ID | 방식 | 역할 |
| --- | --- | --- |
| `qe_baseline` | COMETKiwi 또는 xCOMET의 reference-free 설정 | 일반적인 번역 품질과 오류 span baseline |
| `direct_judge` | 문장쌍을 직접 비교하는 LLM judge | 현재 단일 프롬프트 방식의 baseline |
| `domain_graph` | 사건·인물·역할·속성 graph 추출 후 비교 | DARI 고유 가설 |
| `graph_confirmed` | graph 차이를 국소 QA 또는 별도 judge로 재확인 | 오탐 감소 가설 |

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

이 연구들은 후보 baseline과 표현 방식을 정하는 근거다. DARI 문맥에서 실제 성능이 보장된다는 뜻은 아니며, 언어 지원과 모델 사용 조건은 각 실험 manifest에서 별도로 확인한다.
