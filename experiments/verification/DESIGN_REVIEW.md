# DARI 검증 아키텍처 v0.3 비판적 평가

- 평가일: 2026-10-17
- 평가 대상: [ARCHITECTURE.md](ARCHITECTURE.md) v0.3

## 결론

v0.3는 v0.2보다 제품 적합성이 높다. 가장 중요한 변화는 graph를 기술의 목적에서 **사용자 확인 의미를 보존하기 위한 선택적 도구**로 내린 것이다.

다만 아직 성능 우위가 입증된 제품 기술은 아니다. 현재 구현이 증명한 것은 hand-authored graph 이후의 comparator와 report 흐름이다. 자동 claim extraction, 실제 alignment, 자연 발생 오류, 사용자 검수 개선은 앞으로 검증해야 한다.

## 점수표

| 관점 | 현재 점수 | 근거 |
| --- | ---: | --- |
| 문제 중요도 | 9/10 | 고위험 문서의 행위자·부정·확실성·출처 변화는 실질 피해로 이어질 수 있음 |
| 제품 적합성 | 8/10 | 기존 `sourceQuotes`, `confirmed`, `eventId`, `supersedes`, `factIds`를 직접 활용 |
| 현재 기술 성숙도 | 3/10 | extractor와 aligner가 아직 oracle fixture 수준 |
| 기술 차별성 | 5/10 | Claim Ledger 중심 구조는 차별적이지만 개별 알고리즘은 공개 기술 |
| 해자 잠재력 | 7/10 | correction lineage, bilingual gold data, calibration이 축적될 경우 강해짐 |
| 구현 가능성 | 7/10 | 첫 경계를 V2로 좁히고 7개 오류 유형으로 줄여 현실성이 높아짐 |
| 실패 위험 | 7/10 | 저자원 언어 parsing, 오탐 피로, reference 오류, 사용자 실험 불확실성 |
| impact 증거 | 2/10 | 아직 실제 사용자와 자연 데이터 결과가 없음 |

## 실제 가치가 있는 부분

1. **Semantic chain of custody**
   원문 evidence, confirmed claim, draft, edit, translation이 동일 claim과 revision으로 연결된다. 최종 오류의 유입 단계를 역추적할 수 있다.

2. **Reference 재사용**
   사용자 확인 fact를 매번 LLM으로 다시 추출하지 않아 비용과 상관 오류를 줄인다.

3. **행동 가능한 evidence**
   단일 점수가 아니라 바뀐 claim과 양쪽 span을 보여주므로 사용자가 수정할 수 있다.

4. **실패해도 축소 가능한 구조**
   Micrograph가 baseline을 이기지 못하면 Claim Ledger plus NLI로 전환할 수 있다. 아키텍처 전체를 버릴 필요가 없다.

## 가장 위험한 가정

### 1. 사용자 confirmed fact가 충분히 좋은 reference라는 가정

사용자 확인은 제품의 기준을 만들지만 외부 진실을 보장하지 않는다. 최초 fact extraction이 잘못됐고 사용자가 놓치면 이후 단계는 그 오류를 잘 보존할 수 있다. 따라서 V1 추출 검증과 evidence UI는 여전히 필요하다.

### 2. 자연어를 안정적인 claim으로 바꿀 수 있다는 가정

생략 주어, 대명사, 전언, 시간 표현이 많은 저자원 언어에서 candidate extractor가 무너지면 typed diff의 이론적 장점이 사라진다.

### 3. 구조화가 정상적인 의역을 해치지 않는다는 가정

문장 분할·병합, 요약, 호칭 변화, 암시적 관계를 고정 ontology에 맞추면 false positive가 늘 수 있다. Semantic Contract와 abstention이 필요한 이유다.

### 4. 더 자세한 finding이 사람에게 실제로 도움이 된다는 가정

Finding 수가 많거나 설명이 어렵다면 높은 recall이 오히려 검수 시간을 늘리고 사용자의 신뢰를 낮출 수 있다.

## 기술적 해자 평가

### 약한 해자

- AMR 또는 SRL 기반 graph
- LLM constrained JSON prompt
- embedding alignment
- 일반 error taxonomy
- graph viewer

이 요소는 논문과 범용 모델로 비교적 쉽게 복제된다.

### 강해질 수 있는 해자

- 원문부터 최종 번역까지 이어지는 claim, evidence, correction revision graph
- 사용자가 수락·거절·수정한 finding data
- DARI 문맥의 hard faithful control과 고위험 mutation set
- 이중언어 검수자 agreement가 확보된 codebook
- 언어·길이·오류 유형별 calibrated review policy
- 모델을 교체해도 재사용 가능한 evaluation trace

핵심은 graph algorithm의 비밀이 아니라 **데이터와 workflow가 함께 개선되는 구조**다.

## 가장 중요한 경쟁 비교

제품 후보는 최소 다음 셋이다.

| 후보 | 장점 | 약점 |
| --- | --- | --- |
| Direct judge | 구현이 빠르고 넓은 오류를 다룸 | 재현성, 근거 환각, prompt/model 변화 |
| Claim Ledger + NLI | 단순하고 DARI 구조를 활용 | 관계와 scope 오류 표현력이 제한될 수 있음 |
| Claim Ledger + Micrograph | 관계 오류와 설명력이 강할 가능성 | extractor·alignment 비용과 오탐 위험 |

Micrograph가 세 번째 후보라는 이유만으로 채택하지 않는다. 같은 비용 또는 같은 review burden에서 유의미한 추가 이득이 있어야 한다.

## Impact 판단 기준

기술 성능보다 다음 변화가 중요하다.

- 사용자가 놓치는 고위험 의미 변화가 줄어드는가
- 정상 문서의 불필요한 경고가 감당 가능한가
- finding을 본 사람이 더 빠르고 정확하게 수정하는가
- 오류가 어느 단계에서 생겼는지 팀이 재현할 수 있는가
- 새로운 DARI correction data가 쌓일수록 성능이 더 좋아지는가

Macro-F1이 높아도 위 항목이 개선되지 않으면 제품 impact는 없다.

## Go, Pivot, Kill

### Go

- 관계 오류 subset에서 strongest baseline보다 high-risk recall이 명확히 높음
- 같은 recall에서 false alert가 30% 이상 감소
- 양쪽 evidence만 보고도 사람이 차이를 정확히 판단함
- 사용자 실험에서 잔존 오류 또는 검수 시간이 20% 이상 감소

### Pivot

- Claim Ledger의 가치는 있지만 graph 추가 이득이 작음
- 이 경우 `Claim Ledger + deterministic guards + NLI/direct judge`로 단순화
- Graph는 offline diagnosis와 일부 고위험 관계에만 사용

### Kill

- 자연 데이터에서 direct judge와 차이가 없음
- graph 때문에 경고 수와 검수 시간이 늘어남
- extractor 성능이 언어별로 불안정하고 abstention이 과도함
- 사람이 evidence를 보고도 finding을 이해하거나 수정하지 못함

## 최종 판단

v0.3의 가장 강한 아이디어는 **graph 비교가 아니라 provenance-aware staged verification**이다. 이 방향은 DARI의 현재 데이터 모델과 사용자 흐름에 맞고, 범용 번역 평가기와 분명히 다르다.

Graph는 기술적 해자가 아니라 해자를 만드는 데이터를 구조화하는 내부 표현이다. 관계 오류에서 실질적인 추가 성능을 보일 때만 제품 runtime에 남겨야 한다. 이 원칙을 지키면 실패한 실험도 설계를 단순화하는 근거가 되고, 성공하면 DARI만의 의미 계보와 correction data가 장기 자산이 된다.
