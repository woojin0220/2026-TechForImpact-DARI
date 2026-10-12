# Verification Architecture Test Plan v0.1

이 계획의 첫 목표는 최고의 모델을 고르는 것이 아니라, 검증 방식을 공정하게 비교하고 실패를 추적할 수 있는 아키텍처인지 확인하는 것이다.

## 1. 시험 단계

| 단계 | 데이터 | 확인할 것 | 다음 단계 조건 |
| --- | --- | --- | --- |
| A. Contract | 최소 합성 fixture | schema, 상태, evidence, failure semantics | 모든 필수 시험 통과 |
| B. Mutation | 오류를 하나씩 주입한 합성 문장쌍 | 오류 유형별 탐지와 오탐 | taxonomy coverage 확보 |
| C. Bilingual pilot | 이중 언어 검수자가 작성·검토한 40-60쌍 | 방식별 실제 탐지 성능 | baseline 대비 비교 가능 |
| D. Ablation | 같은 pilot 반복 | graph, rule, confirmer 각각의 기여 | 복잡성의 이득 확인 |
| E. Operational | 지정 기기와 local/server 후보 | 시간, 메모리, 실패율 | 제품 연동 가능성 판단 |

단계 C 이후의 표본 수와 통과 임계값은 pilot 분산을 본 뒤 확정한다. 작은 표본에서 단일 accuracy 수치를 제품 성능으로 해석하지 않는다.

## 2. A단계: 아키텍처 contract 시험

다음 시험은 외부 모델이나 네트워크 없이 실행되어야 한다.

### 입력과 출력

- 유효한 v1 입력을 받아들인다.
- 빈 텍스트, 같은 `case_id` 충돌, 잘못된 언어 코드, 알 수 없는 필드를 거부한다.
- 필수 finding 필드가 없거나 알 수 없는 type이면 report를 거부한다.
- protocol code와 사용자 표시 문구를 분리한다.

### Evidence

- `text[start:end]`가 `quote`와 정확히 일치한다.
- source span을 translation 문서에 연결하거나 반대로 연결하면 실패한다.
- Unicode, 줄바꿈, RTL 텍스트에서도 offset이 보존된다.
- omission처럼 한쪽 근거가 없는 finding은 반대쪽 span과 의미 단위 ID를 반드시 가진다.

### 실패 처리

- adapter exception은 `indeterminate`가 된다.
- timeout과 malformed JSON은 `completed`가 될 수 없다.
- 실패한 strategy가 빈 finding을 반환한 것처럼 집계되지 않는다.
- 일부 case 실패 후에도 runner는 나머지 case를 실행한다.

### 독립성과 재현성

- source extractor 호출에는 source 문서만 전달된다.
- translation extractor 호출에는 translation 문서만 전달된다.
- 같은 seed, model revision, prompt hash, config로 재실행하면 같은 manifest identity를 만든다.
- raw text는 기본 로그와 결과 summary에 포함되지 않는다.
- fixture 안의 `ignore previous instructions` 같은 문자열은 지시가 아니라 문서 내용으로 처리된다.

## 3. B단계: mutation suite

각 기본 문장쌍에서 한 번에 의미 변화 하나만 주입한다. 오류 사례와 의미가 보존된 control을 균형 있게 둔다.

| Mutation | 예시 변화 | 기대 type |
| --- | --- | --- |
| 의미 단위 삭제 | 두 사건 중 하나 삭제 | `omission` |
| 사실 추가 | 원문에 없는 무기 추가 | `unsupported_addition` |
| 부정 반전 | `하지 않았다` -> `했다` | `negation_flip` |
| 불확실성 삭제 | `아마` 삭제 | `certainty_shift` |
| 정보 출처 변경 | 전언 -> 직접 목격 | `source_attribution_change` |
| 행위자·대상 교체 | A가 B를 위협 -> B가 A를 위협 | `actor_role_change` |
| 값 변경 | 날짜·횟수·장소 변경 | `identity_value_change` |
| 시간 관계 변경 | 체포 전 -> 체포 후 | `temporal_change` |
| 인과 변경 | 두 사건 사이 이유 추가·삭제 | `causality_change` |
| 피해 강도 변경 | 밀침 -> 폭행 | `harm_strength_change` |

### 의미 보존 control

- 동의어와 자연스러운 의역
- 문장 분할·병합
- 주어 생략처럼 언어 문법상 자연스러운 변화
- 존칭, 어순, 구두점, 공백 차이
- 동일한 날짜·수치의 다른 표기
- 직접 인용과 의미가 같은 간접 인용

### 변형 시험

- 같은 고유명사를 다른 표기로 바꿔도 동일 entity로 정렬되는가
- 문단에 관련 없는 문장을 추가해도 기존 finding이 변하지 않는가
- sentence order가 바뀌되 `BEFORE/AFTER` 의미가 유지되면 오탐하지 않는가
- 한 변화만 되돌렸을 때 해당 finding만 사라지는가

## 4. C단계: bilingual gold pilot

### 구성

- 지원 후보 언어쌍별로 faithful control과 오류 사례를 모두 포함한다.
- high-risk type마다 최소 사례 수를 사전에 정한다.
- 실제 신청자 정보를 복제하지 않은 가상 문장으로 시작한다.
- 번역자와 adjudicator 역할을 가능하면 분리한다.
- disagreement와 판단 보류도 gold label로 보존한다.

### Annotation 단위

- case-level: 의미 변화 존재 여부
- finding-level: type, severity, change, 양쪽 evidence span
- adjudication: agreed / disputed / indeterminate
- provenance: 작성 방법, 번역 방법, mutation 여부, 검수자 수

## 5. 비교 실험

| 실험 | 비교 | 답하려는 질문 |
| --- | --- | --- |
| E1 | `qe_baseline` | 일반 QE가 DARI 오류를 어디까지 찾는가 |
| E2 | `direct_judge` | 한 번의 LLM 비교가 어떤 오류와 오탐을 만드는가 |
| E3 | `domain_graph` | 관계 구조가 baseline의 miss를 보완하는가 |
| E4 | `graph_confirmed` | 국소 재확인이 graph 오탐을 줄이는가 |
| E5 | QE + graph 후보 union | recall 증가가 false positive 증가보다 유용한가 |

각 실험은 같은 dataset split을 사용하고, 전략별 model/config 변경은 새 run으로 기록한다.

## 6. Ablation

- discrete relation rule 제거
- embedding 기반 soft node match 제거
- certainty·source attribution attribute 제거
- local confirmer 제거
- 독립 extraction 대신 joint extraction 사용
- 전체 문단 대신 sentence 단위만 사용

Ablation은 전체 점수뿐 아니라 어떤 오류 유형의 recall과 false positive가 변했는지를 보여야 한다.

## 7. 지표

### 정확도

- finding type별 precision, recall, F1
- faithful control false positive rate
- high/critical severity miss rate
- case-level detection recall
- evidence span exact match와 overlap F1
- `indeterminate` 비율

### 신뢰성

- schema-valid response rate
- 같은 설정 반복 실행 간 agreement
- confidence calibration 또는 confidence bucket별 실제 precision
- 언어쌍·문장 길이·오류 유형별 성능 차이

### 운영성

- case당 latency p50/p95
- peak memory와 model size
- timeout·parser failure 비율
- 기기 또는 서버별 실행 성공률

`indeterminate`를 오답이나 정답에 임의로 합치지 않고 별도 보고한다. 제품 의사결정용으로는 high-severity miss와 faithful false positive를 가장 먼저 본다.

## 8. 아키텍처 통과 조건

모델 성능과 무관하게 다음 항목은 모두 만족해야 한다.

1. 한 strategy를 교체해도 입력·출력 schema가 바뀌지 않는다.
2. 모든 finding은 유효한 evidence 또는 명시적인 evidence 부재 이유를 가진다.
3. 구성 요소 실패가 `문제 없음`으로 내려가지 않는다.
4. 동일한 dataset과 manifest로 실행을 재현할 수 있다.
5. strategy별 결과와 비용을 같은 평가 runner로 비교할 수 있다.
6. 실제 사용자 데이터 없이 contract와 mutation 시험을 실행할 수 있다.
7. 앱 코드 변경 없이 실험을 반복할 수 있다.

## 9. 모델 선택 판단 기준

Pilot 전에는 특정 모델을 아키텍처에 고정하지 않는다. 후보를 채택할 때 다음을 기록한다.

- source/target 언어 지원과 학습 데이터 근거
- reference-free 실행 가능 여부
- 라이선스와 model weight 배포 조건
- offline 또는 on-device 가능성
- error span 제공 여부
- model revision 고정 가능 여부
- 개인 정보가 외부로 전송되는지

## 10. 결과 검토 양식

각 run review에는 최소 다음 내용을 포함한다.

1. 변경한 가설 또는 구성 요소
2. dataset version과 case 수
3. strategy·model·prompt·config version
4. 핵심 지표와 이전 run 대비 변화
5. 새로 발견한 대표 false positive와 false negative
6. `indeterminate` 원인
7. 다음 실험에서 하나만 바꿀 변수
8. 현재 결과로 결정할 수 있는 것과 아직 결정할 수 없는 것
