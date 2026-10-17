# DARI 서비스 및 연구 전략 v0.4

- 작성일: 2026-10-17
- 읽는 시간: 약 3분

## 한 문장 결정

**DARI의 해자는 번역이나 graph가 아니라, 지원자가 확인한 사건 의미를 원문부터 최종 한국어 문서까지 연결하고 변경된 지점만 사람에게 검토시키는 신뢰 workflow다.**

## 왜 방향을 바꿨나

LLM이 빠르게 좋아지면서 다음 기능은 독립 제품의 방어력이 약해지고 있다.

- 다국어 번역과 초안 생성
- 문단에서 claim 또는 graph 추출
- 두 문서를 LLM에게 비교시키는 검수
- 긴 context와 on-device 실행
- 일반적인 AI 초안과 human review

해외에는 이미 Tarjimly의 난민 언어 지원, Signpost와 IRAP의 정보 및 상담 연결, LegalServer의 case workflow, docassemble의 문서 조립, 상용 번역 QE, CoCounsel의 source-grounded 법률 workflow가 있다. DARI가 같은 기능을 넓게 따라가면 차별화하기 어렵다.

## DARI가 맡을 좁은 문제

```text
지원자 원문
  -> episode별 의미 확인
  -> 사용자 확인 claim
  -> 한국어 초안
  -> 제안 적용 또는 직접 수정
  -> 의미 변화 재검사
  -> 최종 문서 + 제한된 검토 기록
```

검증의 대상은 진술의 진실성이나 법적 유불리가 아니다. **지원자가 확인한 의미가 문서 변환 과정에서 바뀌었는지**다.

## 유지, 축소, 중단

### 제품 핵심으로 유지

- 원문 evidence와 claim의 연결
- episode별 모국어 read-back과 `확인/불확실/정정/철회`
- 문항별 Semantic Contract
- 수정 뒤 claim coverage와 semantic delta 재계산
- 지원자와 허가된 조력자의 evidence review
- 모델 교체 평가와 release gate
- 최소화되고 역할별로 통제되는 export

### 조건부 plugin으로 축소

- relational micrograph
- 별도 LLM verifier
- 자동 역번역
- 범용 QE metric

### 제품 core에서 중단

- full paragraph graph를 항상 생성하는 방식
- graph 자체를 사용자 가치 또는 해자로 설명
- 법적 유리/불리, 신빙성, 인정 가능성 자동 판정
- 전체 fact 일괄 확인
- 민감한 원시 진술을 데이터 해자로 중앙 축적
- V1, V2, V3 동시 개발

## LLM이 더 좋아지면

더 좋은 모델은 DARI의 생성기와 분석기를 싸고 정확하게 만든다. adapter 뒤에서 모델을 교체하고 사건기록은 유지한다.

- verifier 성능 이점이 사라지면 검출 모듈을 줄인다.
- provenance와 evidence UI가 검수 시간을 줄이면 그 부분을 제품 핵심으로 남긴다.
- 둘 다 가치가 없으면 검증 제품 방향을 중단한다.

즉 DARI는 LLM의 약함에 베팅하지 않고, 모델이 어떤 결과를 만들었는지 사람이 확인하고 책임질 수 있는 구조에 베팅한다.

## 첫 제품 실험

첫 범위는 `confirmed facts -> Korean draft -> edits -> final Korean export`다. 현재 코드에서 직접 고친 문장은 원문 근거와 다시 연결되지 않기 때문에 **수정 적용 직후부터 최종 export까지**가 우선 검증 경계다.

비교 조건은 네 가지다.

1. 최신 frontier LLM 직접 생성과 self-check
2. source-linked direct judge
3. Claim Ledger와 controlled generation
4. DARI provenance-aware delta gate와 사람 검토

1차 지표는 다음 둘이다.

- 최종 export 100건당 남은 critical/high 의미 오류
- acceptable export 하나를 만드는 데 필요한 조력자 시간

보조 지표는 문서당 false alert, 정상 문장을 잘못 수정한 비율, 철회된 claim 재등장, provenance coverage다.

## 성공 기준

- 같은 검토 시간에서 최종 잔존 중요 오류 25% 이상 감소
- 또는 같은 잔존 오류 수준에서 검토 시간 20% 이상 감소
- 두 언어와 두 model family에서 효과 방향 유지
- provenance coverage 95% 이상
- 철회된 claim 재등장률 1% 미만

Graph는 flat claim보다 관계 오류 recall을 8%p 이상 높일 때만 runtime에 남긴다.

## 다음 세 단계

### 1단계: 위험한 단절부터 수정

- episode별 확인 상태 설계
- 수정 뒤 자동 delta 재계산
- 모든 대상 언어의 final sentence read-back

### 2단계: 작은 frozen benchmark

- 자연 오류와 최소 대조쌍
- current UI, direct judge, DARI, 사람 검토 비교
- model과 prompt manifest 고정

### 3단계: 실제 조력자 pilot

- 통역가, 활동가 또는 법률지원자 crossover 검토
- 잔존 오류, 시간, 잘못된 수정, evidence 사용 여부 측정
- 결과에 따라 verifier 유지, lineage 중심 전환, 전체 중단 결정

## 최종 투자 판단

DARI는 범용 번역 검사기로 가면 해자가 약하다. 전체 case management나 범용 법률 AI로 가도 경쟁 범위가 지나치게 넓다.

가장 타당한 위치는 **한국 난민신청 workflow에 삽입되는 applicant-controlled multilingual integrity layer**다. 이 위치의 가치도 실제 지원자와 조력자 pilot에서 시간과 잔존 오류가 줄어드는 경우에만 인정한다.
