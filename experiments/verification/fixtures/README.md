# Synthetic fixture rules

이 디렉터리에는 실제 신청자와 무관한 가상 사례만 둔다.

## 사례 구조

각 fixture는 다음 내용을 가진다.

- `case`: `schemas/input.schema.json`을 만족하는 실행 입력
- `gold.status`: `faithful` 또는 `issues_found`. 실행 결과에서는 각각 `completed`, `issues_found`로 대응
- `gold.findings`: 기대 type, change, severity, evidence span, 검수 상태. 미검수 자료는 `adjudication: unreviewed`
- `fixture_provenance`: 작성 방식, mutation, 사람 검수 여부

전체 구조는 [fixture.schema.json](../schemas/fixture.schema.json)을 따르며, schema로 표현할 수 없는 인용문·offset 일치, control/mutation pair 역할과 대칭성은 Python loader가 검사한다. v1은 A/B단계의 확정형 synthetic label만 다루며, bilingual pilot의 disagreement와 판단 보류는 다음 계약 버전에서 추가한다.

Gold 정보는 evaluation runner만 읽고 strategy에는 전달하지 않는다.

## 작성 순서

1. 개인 식별 정보가 없는 짧은 가상 source 문단을 작성한다.
2. 의미가 보존된 translation control을 만든다.
3. control을 복사해 의미 변화 하나만 주입한다.
4. 바뀐 span과 기대 type을 표시한다.
5. 이중 언어 검수자가 control과 mutation을 확인한 뒤에만 `human_reviewed: true`로 바꾼다.
6. 문장 길이, 표현 방식, 언어쌍이 한 패턴에 치우치지 않게 구성한다.

## 금지

- 공개 여부와 무관하게 실제 신청자 진술을 그대로 사용
- 실제 이름, 주소, 연락처, 사건 식별 정보 포함
- 여러 오류를 한 fixture에 넣고 primary 원인을 표시하지 않음
- 생성 모델 출력임을 숨기거나 사람 검수 여부를 누락
- 예상 오류 label을 source 또는 translation 본문에 노출

## 현재 fixture 묶음

`synthetic_cases.jsonl`은 model-assisted synthetic 사례 15개로 시작한다. negation, certainty, actor/target, identity/value, temporal, omission, unsupported addition의 7개 단일 변이와 각 faithful control, quoted-instruction control을 포함한다. 아직 팀의 이중 언어 검수를 받지 않았으므로 모두 `human_reviewed: false`다.

## 다음 fixture 확장

남은 taxonomy와 표현 다양성은 같은 방식으로 mutation과 faithful control을 한 쌍으로 추가한다.

- source attribution change
- causality change
- harm strength change
- 문장 분할·병합과 자연스러운 의역 control
- CRLF와 결합문자 offset 사례
