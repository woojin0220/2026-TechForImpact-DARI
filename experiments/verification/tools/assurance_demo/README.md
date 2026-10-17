# DARI v0.4 Assurance Workflow Demo

v0.4 아키텍처의 `원문 -> meaning read-back -> Evidence-linked Case Record -> controlled draft -> semantic delta -> evidence review` 흐름을 브라우저에서 실행하는 model-free 데모다.

## 실행

저장소 루트에서 다음을 실행한다.

```powershell
python experiments/verification/tools/assurance_demo/serve.py
```

브라우저에서 다음 주소를 연다.

```text
http://127.0.0.1:8874
```

실제 Edge/Chrome 렌더러에서 전체 상태 전이를 자동 검증하고 PNG를 남기려면 서버를 켠 채 다른 터미널에서 실행한다.

```powershell
python experiments/verification/tools/assurance_demo/smoke_test.py
```

성공하면 `screenshots/`에 안전한 초안, 오류 검출, 검토 완료 화면이 생성된다. 이 검사는 Python의 `websocket-client` 패키지를 사용한다.

## 추천 시연 순서

1. `원문 분석 실행`을 눌러 4개 episode와 evidence span을 확인한다.
2. 각 claim의 `의미가 맞음`, `정정 후 맞음`, `판단하기 어려움`, `철회함` 상태를 확인한다.
3. Case Record에서 active claim과 superseded claim을 비교한다.
4. `Active claim으로 안전한 초안 생성`을 누른다.
5. 먼저 안전한 초안을 검증해 finding이 0건인지 확인한다.
6. `오류가 포함된 수정안`을 불러와 다시 검증한다.
7. 정정 전 빈도 재등장, unsupported 수색 추가, 전언의 직접 경험화, 가능성의 확정화가 각각 검출되는지 확인한다.
8. Evidence review에서 각 finding을 처리하고 export readiness가 바뀌는지 확인한다.

## 이 데모가 실제로 실행하는 것

- exact evidence span과 episode 계약 생성
- claim별 확인 상태와 revision을 Case Record에 반영
- active claim만 사용하는 deterministic draft 생성
- 수정 artifact에 대한 claim coverage와 typed delta 검사
- 위험 기반 review routing과 제한된 review receipt 생성

## 이 데모가 아직 증명하지 않는 것

- 처음 보는 자유문장의 자동 claim extraction
- 다국어 read-back 또는 번역 정확도
- 최신 LLM direct judge 대비 성능
- 실제 지원자와 조력자의 검수 시간 절감

위 항목은 [TEST_PLAN.md](../../TEST_PLAN.md)의 frozen benchmark와 사용자 pilot에서 별도로 검증한다.
