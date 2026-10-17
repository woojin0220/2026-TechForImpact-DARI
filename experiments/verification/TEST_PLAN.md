# DARI Verification Test Plan v0.3

- 작성일: 2026-10-17
- 대상 설계: [ARCHITECTURE.md](ARCHITECTURE.md) v0.4
- 평가 단위: 개별 finding보다 최종 `case export`

## 1. 핵심 연구 질문

> 최신 모델이 계속 좋아져도, 사용자 확인 claim과 provenance에 제약된 생성 및 선택적 검수가 같은 사람 시간 안에서 최종 문서의 중요 의미 오류를 더 줄이는가?

두 개의 질문을 분리한다.

1. **예방 가치**: Claim Ledger와 Semantic Contract로 생성을 제약하면 자유 생성보다 오류가 덜 생기는가?
2. **검수 가치**: evidence-linked delta review가 direct LLM judge나 원문 대조보다 잔존 오류와 검수 시간을 줄이는가?

Graph의 우수성은 하위 가설이다. 전체 시스템의 성공 여부를 graph 성능으로 결정하지 않는다.

## 2. 첫 실험 경계

첫 실험은 다음 변환만 평가한다.

```text
confirmed facts
  -> Korean draft
  -> model suggestion or manual edit
  -> final Korean export
```

최초 fact extraction과 다른 언어 번역은 고정하거나 gold로 제공한다. 이 경계에서 효과가 확인된 뒤 V1 source-to-fact와 V3 Korean-to-multilingual translation을 각각 확장한다.

## 3. 비교 조건

| ID | 조건 | 무엇을 분리하는가 |
| --- | --- | --- |
| B0 | 현재 UI 흐름 | 현 제품 기준의 일괄 확인, 초안, 직접 수정 |
| B1 | 최신 frontier model 직접 생성 | 구조 없이 강한 모델만 썼을 때의 상한 |
| B2 | B1 + 동일 모델 self-check | 가장 쉽게 추가할 수 있는 검수 baseline |
| B3 | source-linked direct judge | 원문 근거를 보여주는 단순한 강한 baseline |
| P1 | Claim Ledger + controlled generation | 구조가 오류를 사전에 줄이는 효과 |
| P2 | P1 + flat claim delta gate | provenance-aware 검수의 기본 효과 |
| P3 | P2 + selective relational micrograph | 관계 graph의 순수 추가 효과 |
| P4 | P2 또는 P3 + calibrated human routing | 실제 서비스의 최종 효과 |
| H1 | 이중언어 사람의 전체 검토 | 안전성과 시간의 실무 기준 |

비교는 같은 case, 문서 목적, 검토 시간 또는 API 비용 조건에서 수행한다. B2는 생성기와 같은 모델의 self-check이므로 독립 검증으로 부르지 않는다.

## 4. 2x2 핵심 분해

전체 효과를 `구조화가 좋았다`로 뭉뚱그리지 않기 위해 다음 2x2를 먼저 실행한다.

| 생성 | 검수 없음 또는 direct judge | provenance-aware review |
| --- | --- | --- |
| 자유 생성 | B1/B3 | 자유 생성 + P2 gate |
| controlled generation | P1 | P2/P4 |

이 비교로 오류 감소가 생성 제약, post-hoc verifier, evidence UI 중 어디에서 왔는지 분해한다.

## 5. 데이터셋

### 5.1 Contrastive challenge set

하나의 claim만 바꾼 최소 대조쌍을 만든다.

- 핵심 claim 누락
- 원문에 없는 사실 또는 동기 추가
- 행위자와 피해자 교체
- 부정 반전
- 가능성, 추정, 기억 불확실성을 확정으로 강화
- 직접 경험과 전언의 혼동
- 날짜, 기간, 빈도, 사건 순서 변경
- 이름, 장소, 수치 변경
- 정정 또는 철회된 사실의 재등장
- 정상적인 문장 분할, 병합, 요약, 대명사 변화

같은 사건에서 만든 sibling은 항상 같은 split에 둔다.

### 5.2 Ecological set

실제 사용 방식과 비슷하게 생성, 재생성, 제안 적용, 직접 편집에서 자연스럽게 생긴 artifact를 수집한다. 오류 비율을 인위적으로 맞추지 않고 실제 prevalence에서 문서당 false alert와 검토 부담을 측정한다.

실제 지원자 자료는 Git에 저장하지 않는다. 사용할 경우 별도 승인과 동의, 최소 수집, 접근 통제, 삭제 정책을 갖춘 비공개 저장소를 사용하고 집계 결과만 남긴다.

### 5.3 Longitudinal model set

최소 다음 축을 포함한다.

- 서로 다른 두 model family
- frontier cloud model과 제품 후보 on-device model
- 개발에 사용하지 않은 새 버전
- 두 개 이상의 대상 언어

모델명, 날짜, 가격, prompt, decoding, runtime을 manifest에 고정한다.

## 6. Gold annotation

두 명의 이중언어 검수자가 독립적으로 다음을 판정하고 불일치는 별도 adjudicator가 해결한다.

```text
case_export_acceptable?
material_semantic_change?
type = added | removed | changed | unclear
risk = critical | high | medium | low
reference_evidence[]
artifact_evidence[]
normal_variation | requires_correction | indeterminate
```

법적 유불리, 신빙성, 난민 인정 가능성은 label에 넣지 않는다. 전문가가 법률상 검토가 필요하다고 판단한 경우에는 `refer_to_legal_reviewer`만 기록한다.

## 7. 1차 지표

1. **Final residual material errors per 100 case exports**
   모든 검토가 끝난 최종 export 100건당 남은 critical/high 의미 오류 수다.

2. **Prevented errors per reviewer-hour**
   사람 검토 한 시간당 실제로 막은 critical/high 오류 수다.

3. **Review time to acceptable export**
   같은 gold 기준을 만족하는 최종본을 만들 때 걸린 사람 시간이다.

4. **Unnecessary edit rate**
   정상 표현을 경고 때문에 잘못 바꾼 비율이다.

5. **False alerts per clean document**
   오류가 없는 문서 하나에서 사람이 확인해야 했던 불필요 경고 수다.

6. **Superseded-claim resurrection rate**
   정정 또는 철회된 값이 재생성이나 수정 뒤 다시 등장한 비율이다.

## 8. 2차 지표

- provenance coverage: 최종 문장 중 active claim 또는 허용된 template content에 연결된 비율
- evidence sufficiency: 검수자가 별도 탐색 없이 판단 가능한 finding 비율
- correction success: 경고가 실제 올바른 수정으로 이어진 비율
- wrong-correction induction: 시스템이 정상 문장을 잘못 고치게 한 비율
- user confirmation burden: episode 확인 시간과 재질문 수
- abstention 및 unresolved rate
- 오류 유형과 언어별 precision, recall, risk-coverage
- 문서당 latency, 비용, peak memory, on-device 성공률
- export data minimization: 정책상 불필요한 원문 또는 이력 노출 건수

## 9. 모델 발전 내성 시험

매 주요 모델 교체 때 같은 frozen set을 다음 조건으로 재실행한다.

```text
new model only
new model + self-check
new model + Claim Ledger
new model + full DARI assurance
full DARI without graph
full DARI without accumulated correction labels
```

### Value Persistence Curve

각 모델 세대 `m`에서 다음을 기록한다.

```text
V_m = residual_error(baseline_m) - residual_error(DARI_m)
T_m = review_time(baseline_m) - review_time(DARI_m)
```

기반 모델이 좋아지면서 `V_m`이 줄어드는 것은 예상한다. 두 번의 주요 모델 업그레이드에서 `V_m`과 `T_m`이 모두 실질적으로 0에 가까워지면 별도 verifier를 축소한다. Case Record와 lineage는 별도로 검수 및 인계 시간을 줄이는지 평가한다.

## 10. Graph ablation

Graph는 관계 오류 subset에서만 평가한다.

| 비교 | 측정 |
| --- | --- |
| flat claim vs micrograph | actor/target, reporting source, scope, chronology recall |
| gold graph vs predicted graph | graph 표현의 상한과 extractor 손실 |
| graph finding vs direct judge | 같은 false alert 및 비용에서 추가 오류 발견 |
| graph UI vs evidence-only UI | 사람이 더 빠르고 정확하게 판단하는지 |

관계 오류 recall이 flat claim보다 8%p 이상 높지 않거나, 같은 recall에서 review burden을 줄이지 못하면 graph는 runtime core에서 제거한다. graph viewer는 연구 진단 도구로만 유지한다.

## 11. 사용자 및 조력자 연구

같은 case를 무작위 순서의 crossover로 검토한다.

1. 원문과 최종 문서만 제공
2. direct judge finding과 span 제공
3. DARI의 양쪽 evidence, claim 상태, plain-language delta 제공

참가자는 지원자 역할의 이중언어 사용자와 실제 검수 역할에 가까운 통역가, 활동가 또는 법률지원자를 구분한다. 지원자는 claim read-back의 이해와 통제 가능성을, 조력자는 최종 검토 시간과 정확성을 평가한다.

그래프 구조 자체는 기본 UI에 보여주지 않는다. 다음을 측정한다.

- finding 이해 정확도
- 수락, 거절, 수정 결정 정확도
- 최종 잔존 오류
- 잘못된 수정
- 검토 시간
- 신뢰와 통제감
- 인간 이관이 필요하다고 판단한 비율

## 12. 단계별 Gate

| 단계 | 질문 | Go 기준 |
| --- | --- | --- |
| T0 Contract | revision, consent, claim 상태, evidence 연결이 안정적인가 | contract test 통과, provenance coverage 100% on fixtures |
| T1 Read-back pilot | episode별 확인이 일괄 checkbox보다 의도를 잘 포착하는가 | 누락 또는 오확인 감소, 사용 시간 허용 범위 |
| T2 Oracle delta | gold claim 조건에서 중요 변화가 검출되는가 | high-risk recall 95%, clean FPR 5% 이하 |
| T3 Controlled generation | 자유 생성보다 오류를 예방하는가 | residual high-risk error 20% 이상 감소 |
| T4 Frozen benchmark | 최신 direct baseline을 이기는가 | 같은 burden에서 잔존 오류 25% 감소 또는 시간 20% 감소 |
| T5 Human review | 실제로 검수 결과가 좋아지는가 | wrong correction 증가 없이 위 기준 유지 |
| T6 Model shift | 다른 model family와 version에서도 유지되는가 | 두 언어, 두 family에서 효과 방향 유지 |
| T7 Partner pilot | 업무흐름과 export가 실제로 사용되는가 | 재인터뷰 또는 검수 시간 감소, partner adoption signal |

숫자는 T1 pilot 전에 사전 등록하고 frozen test 결과를 본 뒤 바꾸지 않는다.

## 13. Go, Pivot, Kill

### Go

- 같은 사람 검토 시간에서 최종 잔존 critical/high 오류를 25% 이상 줄임
- 또는 같은 잔존 오류 수준에서 조력자 검토 시간을 20% 이상 줄임
- provenance coverage 95% 이상과 superseded-claim resurrection 1% 미만
- 두 언어, 두 model family에서 효과 방향 유지

### Pivot

- 자동 verifier의 추가 효과는 작지만 lineage와 evidence UI가 검토 또는 인계 시간을 줄임
- 이 경우 detection 연구를 축소하고 Case Record, read-back, export와 review receipt 제품으로 전환
- low-resource 또는 특정 문항에서만 효과가 있으면 지원 범위를 명시적으로 축소

### Kill

- 최신 source-linked direct baseline이 같은 burden에서 비열등함
- evidence UI가 검토 시간을 줄이지 못하거나 wrong correction을 증가시킴
- 두 번의 주요 모델 교체 후 DARI 추가 효과가 반복해서 사라짐
- 기관과 사용자가 portable record와 review receipt를 실제로 사용하지 않음

## 14. 해자 검증

데이터가 쌓인다는 사실만으로 해자가 되지 않는다. 동의한 비식별 correction label을 `0 -> 50 -> 150 -> 300`개로 늘려 다음을 비교한다.

- DARI calibration의 learning curve
- 같은 시점 최신 범용 모델의 개선
- 새 언어와 새 모델에 대한 전이
- 잘못된 경고와 검수 시간 변화

DARI 곡선이 최신 baseline보다 빠르게 개선되고, model family가 바뀌어도 효과가 유지될 때만 correction data를 기술 자산이라고 부른다. 원시 난민 진술의 중앙 축적은 해자 전략에서 제외한다.

## 15. 현재 상태

현재 46개 테스트는 schema, 실패 격리, hand-authored graph demo와 trace viewer의 동작을 확인한다. 실제 사용자 read-back, 자동 extractor, 자연 오류, 최신 baseline 대비 우위, human review impact와 model-upgrade resilience는 아직 검증되지 않았다.
