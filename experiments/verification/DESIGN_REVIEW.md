# DARI 검증 아키텍처 v0.4 비판적 평가

- 평가일: 2026-10-17
- 평가 대상: [ARCHITECTURE.md](ARCHITECTURE.md) v0.4
- 관점: 실제 서비스, 연구 기여, LLM 발전 내성

## 결론

v0.3은 올바른 방향으로 graph의 비중을 줄였지만 여전히 검출 알고리즘을 중심으로 설계했다. 이 접근은 최신 LLM이 번역과 비교를 더 잘하고 더 싸게 수행할수록 가치가 줄어든다.

v0.4는 중심을 **지원자가 통제하는 근거 연결 사건기록과 최종 문서 검토 workflow**로 옮겼다. 이 구조라면 LLM이 좋아질수록 모델을 교체해 생성과 분석 비용을 낮추면서도, 누가 무엇을 확인했고 어느 문장이 어떤 claim에서 왔는지에 대한 기록은 남는다.

다만 이것은 아직 설계 가설이다. 실제 지원자와 조력자가 lineage를 이해하고 사용하며, 최신 direct baseline보다 잔존 오류 또는 시간을 줄인다는 증거가 나오기 전에는 기술적 우위나 해자를 주장하면 안 된다.

## 점수

| 관점 | v0.3 | v0.4 잠재력 | 판단 |
| --- | ---: | ---: | --- |
| 해결하는 문제의 중요성 | 9/10 | 9/10 | 고위험 문서의 의미 왜곡은 실제 피해로 이어질 수 있음 |
| 현재 서비스 준비도 | 3/10 | 5/10 | 경계와 사용자 역할은 명확해졌지만 제품 구현과 pilot이 없음 |
| 검출 기술 차별성 | 3/10 | 4/10 | graph와 judge는 쉽게 대체 가능, 선택적 micrograph만 미검증 가능성 |
| 사용자 가치 잠재력 | 8/10 | 8/10 | 원문 근거, 확인, 수정, 인계는 실제 사용 가치가 큼 |
| LLM 발전 내성 | 4/10 | 8/10 | 모델을 부품으로 만들고 case record와 release gate를 중심에 둠 |
| 데이터 해자 가능성 | 5/10 | 7/10 | 비식별 correction outcome과 calibration이 쌓일 때만 가능 |
| 연구 기여 가능성 | 6/10 | 8/10 | model-upgrade resilience와 human impact가 더 강한 질문 |
| 개인정보 및 사용자 통제 | 4/10 | 7/10 | 최소 export와 삭제 가능성을 넣었지만 실제 정책과 구현이 필요 |

## 외부 사례가 보여주는 냉정한 현실

| 사례 | 이미 증명하거나 보유한 것 | DARI에 주는 의미 |
| --- | --- | --- |
| Tarjimly | 난민 대상 언어 지원, AI 초벌번역, 인간 검수, 대규모 통역 네트워크 | `AI + human`과 난민 번역 데이터만으로 차별화하기 어려움 |
| Signpost | 다국어 위기 정보와 양방향 지원, 지역 커뮤니티 운영 | 신뢰와 현지 운영망이 모델보다 오래가는 자산임 |
| UNHCR RiMAP | 권위 있는 법률 자료, 정확한 citation, 법률가 검증 | 신뢰 자료와 검증 절차가 generic chatbot보다 중요함 |
| LegalServer | intake, 사건, 문서, 역할과 업무흐름 | 전체 case management를 새로 만드는 것은 범위가 큼 |
| docassemble / Citizenshipworks | 구조화 질문을 통한 법률 문서 조립 | 정형 정보만으로 문서를 만드는 영역은 이미 성숙함 |
| Phrase / Smartling / RWS / LILT | 번역 품질 평가와 인간 검수 routing | 일반 QE와 auto-approval은 기존 시장과 정면 경쟁임 |
| CoCounsel | 권위 콘텐츠, source attribution, 업무 도구 통합 | 법률 AI의 해자는 기반 모델보다 자료와 workflow에 가까움 |
| eyeWitness / C2PA 계열 | 원본과 변경 이력을 추적하는 provenance | 이력은 증명할 수 있지만 내용의 진실까지 증명하지는 않음 |

따라서 DARI의 방어 가능한 공백은 범용 번역이나 법률 AI가 아니다. **한국 난민신청서 작성에서 지원자 원문과 확인 claim, 한국어 초안, 수정, 최종 export를 의미 단위로 연결하는 층**이다.

## 현재 코드에서 확인한 가장 큰 서비스 공백

### 1. 일괄 확인은 실질적 확인이 아니다

현재 `capacitor-web/src/App.tsx`의 fact 화면은 하나의 checkbox로 전체 fact를 확인한다. 중요한 사건이 많을수록 사용자가 각각의 행위자, 시점, 확실성, 정보 출처를 실제로 이해하고 확인했다는 근거가 약해진다.

v0.4는 event 또는 episode 카드마다 모국어 read-back을 제공하고 `confirmed`, `uncertain`, `corrected`, `withdrawn`을 구분한다. 확인 언어, 주체, 방법과 revision도 기록해야 한다.

### 2. 직접 수정 뒤 provenance가 끊어진다

현재 UI는 직접 고친 문장이 수집 원문과 자동으로 다시 연결되지 않는다고 명시한다. 사람이 고쳤다는 이유로 안전한 것이 아니며, 제안 적용과 수동 편집에서 새 누락, 추가, 정정 전 값 재등장이 생길 수 있다.

따라서 **편집 적용 직후부터 최종 export까지**가 첫 verification boundary다. 모든 수정 뒤 claim coverage와 semantic delta를 다시 계산하고 unresolved 항목을 export 전에 해결하거나 명시적으로 보류해야 한다.

### 3. 최종 문장을 모든 대상 사용자가 확인하기 어렵다

현재 meaning view는 영어 사용자 경로에 치우쳐 있다. 러시아어, 아랍어, 프랑스어, 페르시아어 등의 사용자가 한국어 최종 문장을 자기 언어로 충분히 확인하는 경로가 필요하다.

각 최종 문장에 source-language read-back, 연결된 episode, `이 의미가 맞음/다름/판단 어려움`을 제공해야 한다. 자동 역번역은 보조 설명이며 독립 검증으로 계산하지 않는다.

### 4. 법적 유불리 방향 분류는 제품 중심에서 제거해야 한다

현재 `local_verification_server.py`의 과거 검증 prompt는 변화를 `유리하게 강화`, `불리하게 약화`, `방향 불명확`으로 분류한다. 면책 문구가 있더라도 법적 전략이나 결과 예측과 가깝다.

v0.4 finding은 `added`, `removed`, `changed`, `unclear`와 양쪽 evidence만 제시한다. 법률 검토가 필요한 경우에는 판단하지 않고 허가된 조력자에게 보낸다.

### 5. correction history는 해자이면서 위험이다

초기 진술과 정정, 철회 이력은 사용자를 돕는 데 필요할 수 있지만 유출되거나 기관에 과도하게 전달되면 불이익 자료가 될 수 있다. immutable history를 무조건 중앙 축적하는 전략은 부적절하다.

versioned, encrypted, access-controlled, deletable record와 목적별 retention을 사용한다. 기본 export는 현재 active claim, 최종 문서, 필요한 범위의 review receipt만 포함한다.

## LLM 발전 시나리오

### 시나리오 A: 대부분의 번역과 검수가 범용화

Frontier와 on-device 모델이 대상 언어의 초안과 의미 비교를 충분히 잘한다. DARI의 extractor와 verifier 이점은 사라진다.

남는 가치는 사용자 확인, claim lineage, 최소화된 export, 책임 있는 검토 기록이다. 기관과 사용자가 이 기록에도 가치를 느끼지 않으면 검증 제품 방향을 중단해야 한다.

### 시나리오 B: 평균은 좋아지지만 취약 조건은 남음

고자원 언어와 짧은 문장은 좋아지지만 저자원 언어, 긴 개인 서술, 전언, 불확실성, 사건 순서 오류는 남는다.

DARI는 모든 문장을 검사하는 도구가 아니라 고위험 문항과 취약 조건에만 검수를 배분하는 assurance layer가 된다. 현재 가장 현실적인 가설이다.

### 시나리오 C: privacy와 책임성이 더 중요해짐

민감한 원문을 cloud에 보낼 수 없고 on-device 모델은 frontier보다 약하다. 기관은 사용자 동의, 변경 이력, 검토 책임을 요구한다.

DARI의 가치는 작은 모델 자체가 아니라 작은 모델을 어느 조건에서 통과, 보류, 이관할지 결정하는 calibration과 evidence workflow다.

## 해자 평가

### 약한 해자

- 특정 LLM 또는 prompt
- 범용 graph schema
- 번역 점수와 red/green 표시
- on-device 실행 자체
- 두 모델의 다수결
- graph viewer

### 조건부로 강한 해자

- 한국 난민신청 문항별 Semantic Contract
- 지원자가 확인한 claim과 exact evidence의 연결
- 수정 후 최종 export까지 끊기지 않는 lineage
- 오류 유형과 언어별 검수 threshold 및 abstention 정책
- 조력자가 해결한 비식별 correction outcome
- NGO, 통역가, 법률지원자 workflow에 대한 통합과 신뢰
- 두 번 이상의 model upgrade를 통과한 regression benchmark

이 자산들도 자동으로 해자가 되지 않는다. 파트너가 실제로 사용하고, 축적된 label이 성능 또는 시간을 개선하며, 새 모델이 나와도 효과가 유지돼야 한다.

## 연구로서 더 강해진 질문

v0.3의 질문은 graph comparator가 direct judge보다 좋은지에 가까웠다. v0.4는 다음을 묻는다.

1. 사용자 확인 provenance가 매번 source를 다시 분석하는 것보다 안정적인가?
2. controlled generation이 post-hoc 검수보다 더 많은 오류를 예방하는가?
3. evidence-linked review가 최신 direct judge보다 최종 잔존 오류와 사람 시간을 줄이는가?
4. 이 효과가 다른 모델 계열과 새 버전에서도 유지되는가?
5. 수정과 재생성 뒤 정정 전 사실이 다시 등장하는 것을 막는가?
6. 지원자와 조력자가 finding을 이해하고 올바르게 해결하는가?

이 연구는 새로운 graph 알고리즘보다 human-AI workflow, provenance, selective prediction과 longitudinal evaluation의 결합으로 기여하는 편이 설득력 있다.

## 가장 중요한 반증 조건

- 최신 source-linked direct judge가 같은 burden에서 DARI와 비열등함
- DARI가 잔존 critical/high 오류를 25% 줄이지도, 검수 시간을 20% 줄이지도 못함
- evidence UI가 정상 문장의 불필요한 수정을 증가시킴
- graph가 flat claim보다 관계 오류 recall을 8%p 이상 높이지 못함
- 두 번의 모델 업그레이드에서 추가 효과가 사라짐
- 지원자 또는 파트너가 portable record와 review receipt를 실제로 사용하지 않음

이 결과가 나오면 graph와 별도 verifier를 줄이거나 중단한다. lineage만 가치가 있으면 evidence record와 공동 검토 workflow 제품으로 전환한다. lineage에도 실사용 가치가 없으면 전체 검증 방향을 중단하는 것이 맞다.

## 최종 판단

v0.4의 가장 큰 개선은 `LLM이 계속 틀릴 것`을 전제로 삼지 않는 점이다. LLM은 계속 교체하고, 지원자가 확인한 의미와 검토 책임을 모델 밖에 둔다.

이 방향의 잠재력은 높지만 현재 증거 수준은 낮다. 다음 성과는 더 복잡한 graph가 아니라 **수정 후 최종 export 재검증**, **episode별 모국어 확인**, **조력자 crossover pilot**에서 나와야 한다. 세 가지가 최신 direct baseline보다 잔존 오류 또는 사람 시간을 줄일 때 DARI는 기술적 가치와 서비스 가치를 함께 주장할 수 있다.
