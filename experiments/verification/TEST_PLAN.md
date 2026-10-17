# DARI Verification Test Plan v0.2

- 작성일: 2026-10-17
- 대상 설계: [ARCHITECTURE.md](ARCHITECTURE.md) v0.3

## 1. 평가의 중심 질문

> Claim Ledger와 선택적 relational graph가 강한 비그래프 방식보다 중요한 의미 오류를 더 찾고, 실제 사용자의 검수 부담과 잔존 오류를 줄이는가?

Graph를 채택한다는 결론을 미리 정하지 않는다. 직접 비교 결과가 비슷하면 더 단순한 Claim Ledger plus NLI 또는 direct judge 구조로 전환한다.

## 2. 실험 단계

| 단계 | 데이터 | 답할 질문 | 다음 단계 조건 |
| --- | --- | --- | --- |
| T0 Contract | synthetic fixtures | evidence, revision, state 계약이 안정적인가 | 자동 테스트 통과 |
| T1 Representation audit | 자연 문단 60-100개 | 중요 오류를 claim/micrograph로 표현할 수 있는가 | 표현 coverage 95% 이상 |
| T2 Oracle comparator | gold claim과 alignment | typed diff 자체가 충분한가 | high-risk recall 95%, faithful FPR 5% 이하 |
| T3 Feasibility pilot | 180 pairs | extractor, aligner, annotation 병목은 무엇인가 | frozen test 설계 고정 |
| T4 Frozen benchmark | challenge 600 + ecological 400 | strongest baseline보다 실제 우위가 있는가 | 사전 등록 gate 통과 |
| T5 User impact | crossover review study | finding이 사람의 결과를 개선하는가 | 잔존 오류 또는 시간 20% 개선 |
| T6 Generalization | 두 번째 언어쌍·모델 | 특정 조건에 과적합되지 않았는가 | 이득의 80% 이상 유지 |

## 3. 반드시 비교할 baseline

| ID | 방법 | 의미 |
| --- | --- | --- |
| B0 | always faithful / always issue | class imbalance sanity check |
| B1 | deterministic guards | 숫자, 날짜, 이름, 부정, 정정 전 값의 저비용 하한 |
| B2 | flat claim + bidirectional NLI | graph edge 없이 구조화한 가장 중요한 baseline |
| B3 | cost-matched direct LLM judge | 같은 모델·taxonomy·evidence 계약의 직접 비교 |
| B4 | COMETKiwi 또는 xCOMET | translation stage의 일반 QE baseline |
| P1 | Claim Ledger + typed diff | DARI 구조를 쓰는 기본 제안법 |
| P2 | P1 + relational micrograph | 관계 구조의 추가 가치 측정 |
| P3 | P2 + selective verifier | 반복 오탐 감소 효과 측정 |

최선 성능 비교와 같은 추론 비용 비교를 함께 보고한다. 호출 수가 크게 늘어난 작은 개선은 제품 우위로 해석하지 않는다.

## 4. 데이터셋

### 4.1 Contrastive challenge set

한 번에 하나의 의미만 바꾼 오류 pair와 의미 보존 control을 짝으로 만든다.

- omission
- actor/target swap
- negation flip
- certainty shift
- source attribution change
- name/date/number/location change
- temporal order/frequency change
- faithful paraphrase
- sentence split/merge
- pronoun and omitted-subject variation

같은 base narrative의 mutation sibling은 반드시 같은 split에 둔다.

### 4.2 Ecological set

실제 candidate 생성 방식 세 종류 이상에서 문단을 수집하고 오류 비율을 인위적으로 맞추지 않는다. 이 set은 실제 prevalence에서 precision, 문서당 false alert, 검수 부담을 측정한다.

### 4.3 Gold diagnostic subset

전체의 10-20%에만 gold claim, micrograph, alignment를 붙인다. 주 평가 gold는 아키텍처 중립적으로 다음을 기록한다.

```text
semantic change present?
type and risk
reference and candidate evidence
natural-language description
agreed | disputed | indeterminate
```

### 4.4 권장 규모

| Set | 규모 | 용도 |
| --- | ---: | --- |
| Representation audit | 60-100 paragraphs | schema 수정 |
| Pilot | 180 pairs | annotation guide와 분산 추정 |
| Frozen challenge test | 약 600 pairs | 현상별 confirmatory test |
| Ecological test | 약 400 pairs | 실제 precision과 burden |
| Gold graph subset | 100-150 pairs | 병목 분해 |

오류 유형별 positive가 100개보다 적으면 해당 유형의 결과는 exploratory로 표시한다.

## 5. Annotation

- 두 명의 이중언어 검수자가 독립 annotation한다.
- 모델 종류와 mutation 여부를 숨긴다.
- 단문만이 아니라 필요한 문단 문맥을 제공한다.
- 불일치는 세 번째 검수자가 adjudication한다.
- adjudication 전 agreement도 공개한다.
- `disputed`와 `indeterminate`를 강제로 정답에 합치지 않는다.
- risk는 법률적 승패가 아니라 의미 보존 위험으로 정의한다.

Taxonomy agreement가 0.75 미만이면 type을 합치거나 exploratory로 내린다.

## 6. Oracle decomposition

| ID | 구성 | 측정하는 병목 |
| --- | --- | --- |
| A0 | gold claim/graph + gold alignment + typed diff | 표현과 comparator 상한 |
| A1 | predicted candidate claims + gold alignment | extractor 손실 |
| A2 | predicted claims + predicted alignment | aligner 손실 |
| A3 | A2 + selective verifier | verifier의 precision 이득 |
| A4 | flat claims, graph edge 없음 | relation graph 자체의 가치 |
| A5 | certainty와 attribution qualifier 제거 | scoped qualifier 가치 |
| A6 | sentence-only context | 문단과 coreference 가치 |
| A7 | 양쪽 full graph 추출 | Claim Ledger reference 재사용 가치 |
| A8 | fact/event anchor 제거 | DARI 제품 구조의 가치 |

## 7. 제품 판단용 metric

### Primary

1. **High-risk recall at fixed review burden**
   faithful paragraph의 false-positive rate 또는 문서당 경고 수를 고정했을 때 high-risk 오류를 얼마나 찾는지 측정한다.
2. **Residual high-risk error rate**
   시스템 finding을 사람이 검토한 뒤에도 남은 중요 오류 비율이다.
3. **False alerts per faithful paragraph**
   case-level FPR만으로 숨겨질 수 있는 경고 피로를 직접 측정한다.
4. **Review time**
   같은 최종 정확도를 얻는 데 걸리는 시간을 측정한다.

### Secondary

- actionable precision
- evidence sufficiency
- type별 precision, recall, F1
- evidence span overlap과 human correctness
- claim extraction F1
- entity/event alignment accuracy
- risk-coverage curve와 abstention
- 언어, 길이, coreference, 모델별 격차
- latency, token cost, memory

## 8. 사전 등록 Gate

| Gate | Go | Pivot 또는 No-go |
| --- | --- | --- |
| 표현력 | 자연 오류 95% 이상을 손실 없이 표현, agreement 0.75 이상 | schema 축소·재설계 |
| Comparator | gold 조건 high-risk recall 95% 이상, faithful FPR 5% 이하 | typed diff 재설계 |
| 자동 분석 | oracle recall의 85% 이상 보존 | extractor에 집중 |
| Alignment | 추가 recall 손실 5%p 이하 | aligner 재설계 |
| Baseline 우위 | 같은 burden에서 strongest baseline보다 high-risk recall 8%p 이상, 95% CI 하한 > 0 | graph 축소 또는 제거 |
| Burden | 같은 recall에서 false alert 30% 이상 감소 | policy와 evidence UI 재설계 |
| User impact | 잔존 오류 20% 감소 또는 검수 시간 20% 감소 | 연구 도구로 유지 |
| Generalization | 두 번째 언어·모델에서 이득의 80% 이상 유지 | 지원 범위 축소 |

위 숫자는 pilot 전에 잠정 등록한다. Frozen test 결과를 본 뒤 기준을 낮추지 않는다.

## 9. 사용자 impact 실험

같은 문서를 세 조건에서 무작위 crossover로 검토한다.

1. 원문과 candidate만 제공
2. direct judge finding과 span 제공
3. DARI typed finding과 양쪽 evidence 제공

측정값은 다음과 같다.

- 중요 오류의 최종 수정률
- 오류를 정상으로 받아들인 비율
- 정상 표현의 불필요한 수정률
- 검수 완료 시간
- finding을 이해하는 데 필요한 상호작용 수
- 시스템 오판을 그대로 따른 비율

## 10. 기술적 해자 검증

DARI gold 사례를 `0 -> 50 -> 150 -> 300`개로 늘리며 P2, flat claim, direct judge의 learning curve를 비교한다.

다음 조건이 모두 보여야 데이터 해자라고 부를 수 있다.

- DARI 구조를 쓰는 방법의 개선 기울기가 baseline보다 큼
- 기반 모델을 바꿔도 이득이 유지됨
- 두 번째 언어쌍에서도 이득이 재현됨
- correction feedback이 hard negative 성능을 개선함

## 11. 의사결정 규칙

- A0가 낮으면 모델 개발 전에 schema와 diff를 고친다.
- A0는 높고 A1이 낮으면 extractor가 병목이다.
- A1은 높고 A2가 낮으면 aligner가 병목이다.
- A4와 P2가 비슷하면 graph edge를 제품 core에서 제거한다.
- P3가 precision 또는 burden을 개선하지 못하면 verifier를 제거한다.
- Synthetic에서만 좋고 ecological set에서 우위가 없으면 제품 연결을 중단한다.
- 자동 metric이 좋아도 사용자 residual error와 review time이 개선되지 않으면 impact를 주장하지 않는다.

## 12. 현재 상태

현재 46개 테스트는 contract, 실패 격리, hand-authored demo의 안정성을 확인한다. 현재 demo는 사람이 만든 graph, `match_key` oracle, scripted confirmer를 사용하므로 자동 추출·실제 정렬·baseline 우위에 대한 성능 증거는 아니다.
