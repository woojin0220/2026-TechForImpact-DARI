# Experiment result rules

`results/`에는 원문이 없는 집계 결과와 재현에 필요한 manifest만 커밋한다.

## 커밋 가능한 내용

- dataset ID, version, canonical content digest
- Git commit
- 정적 설정을 식별하는 `experiment_fingerprint`와 고유 `run_id`
- strategy, component, model, prompt, config version
- random seed와 실행 환경 class
- 집계 지표
- 익명 case ID별 정답 여부와 오류 code
- 대표 실패에 대한 비식별 설명

## 커밋하지 않는 내용

- 실제 신청자 원문 또는 번역문
- 개인 식별 정보가 포함된 model output
- 외부 서비스 credential이나 endpoint secret
- 재배포 권한을 확인하지 않은 model artifact

## run 비교 원칙

- 한 run에서 한 가지 주요 변수만 바꾼다.
- 실패 case와 `indeterminate`를 결과에서 제외하지 않는다.
- 평균만 기록하지 않고 유형별 지표와 false positive/false negative 수를 남긴다.
- 새 run은 이전 결과를 덮어쓰지 않고 고유 run ID로 추가한다.
