# Synthetic fixture rules

이 디렉터리에는 실제 신청자와 무관한 가상 사례만 둔다.

## 사례 구조

각 fixture는 다음 내용을 가진다.

- `case`: `schemas/input.schema.json`을 만족하는 실행 입력
- `gold.status`: faithful / issues_found / indeterminate
- `gold.findings`: 기대 type, change, severity, evidence span
- `fixture_provenance`: 작성 방식, mutation, 사람 검수 여부

Gold 정보는 evaluation runner만 읽고 strategy에는 전달하지 않는다.

## 작성 순서

1. 개인 식별 정보가 없는 짧은 가상 source 문단을 작성한다.
2. 의미가 보존된 translation control을 만든다.
3. control을 복사해 의미 변화 하나만 주입한다.
4. 바뀐 span과 기대 type을 표시한다.
5. 이중 언어 검수자가 control과 mutation을 확인한다.
6. 문장 길이, 표현 방식, 언어쌍이 한 패턴에 치우치지 않게 구성한다.

## 금지

- 공개 여부와 무관하게 실제 신청자 진술을 그대로 사용
- 실제 이름, 주소, 연락처, 사건 식별 정보 포함
- 여러 오류를 한 fixture에 넣고 primary 원인을 표시하지 않음
- 생성 모델 출력임을 숨기거나 사람 검수 여부를 누락
- 예상 오류 label을 source 또는 translation 본문에 노출

## 첫 fixture 묶음

첫 묶음은 오류 유형별 mutation과 faithful control을 한 쌍으로 만든다.

- omission
- unsupported addition
- negation flip
- certainty shift
- source attribution change
- actor/target change
- identity/date/number change
- temporal relation change
- causality change
- harm strength change
- prompt-injection-like text as quoted data
- Unicode, 줄바꿈, RTL offset 사례
