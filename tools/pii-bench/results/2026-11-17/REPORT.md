# DARI 로컬 개인정보 탐지 스크리닝 — 2026-11-17

42개 가상 문장: 언어별 식별정보 6개(양성 5개·음성 1개), 민감속성 탐지 1개. 실제 신청인 데이터와 외부 LLM API를 사용하지 않았다.
원어민 검수 전의 작은 고정 예제이며 모델 선정용 탐색 실험이다. 학습·조정·최종 검증을 분리한 평가가 아니므로 운영 성능으로 일반화할 수 없다.
Mac CPU, FP32, 스레드 4개, 워밍업 후 각 문장을 2회 처리. 다운로드·모델 로딩은 문장 지연에서 제외. 각 모델은 별도 프로세스에서 실행했다.
식별정보 6종: 이름·이메일·전화·주소·생년월일·여권번호. 종교·정당·의료정보는 별도 zero-shot 탐색으로 식별정보 점수에서 제외한다. 모델마다 같은 개념의 권장 라벨 이름을 사용했다.
완전 가림률은 정답 구간의 공백 이외 모든 문자를 탐지한 비율이다. 한 글자라도 남으면 실패하며, 반복 등장한 이름도 각각 센다. 라벨 오분류는 가림률에 영향을 주지 않는다. 문자 정밀도는 과잉 마스킹을 보여 준다.
Privacy Filter는 HF 구현과 BIOES 제약 Viterbi 어댑터를 사용했다. 배포 calibration의 6개 bias가 모두 0임을 확인했다. 공식 OPF 런타임 자체의 벤치마크는 아니다. 종교·정치·의료 분류는 기본 taxonomy에 없어 미지원으로 기록했다.

| 모델 | 임계값 | 완전 가림 | 문자 정밀도 | 문자 재현율 | 누락 없는 양성 문장 | p50 / p90 ms |
|---|---:|---:|---:|---:|---:|---:|
| fastino/gliner2-privacy-filter-PII-multi | 0.3 | 74/78 (94.9%) | 91.3% | 92.4% | 26/30 | 83.81 / 100.85 |
| fastino/gliner2-privacy-filter-PII-multi | 0.5 | 73/78 (93.6%) | 93.5% | 90.5% | 25/30 | 84.08 / 93.43 |
| knowledgator/gliner-pii-edge-v1.0 | 0.3 | 40/78 (51.3%) | 86.1% | 53.1% | 10/30 | 20.09 / 29.36 |
| knowledgator/gliner-pii-edge-v1.0 | 0.5 | 35/78 (44.9%) | 92.0% | 44.0% | 10/30 | 21.33 / 26.52 |
| urchade/gliner_multi_pii-v1 | 0.3 | 77/78 (98.7%) | 92.1% | 99.6% | 29/30 | 75.17 / 82.97 |
| urchade/gliner_multi_pii-v1 | 0.5 | 77/78 (98.7%) | 93.8% | 99.6% | 29/30 | 76.08 / 83.06 |
| openai/privacy-filter | 기본 Viterbi | 66/78 (84.6%) | 88.5% | 91.5% | 20/30 | 164.83 / 236.85 |

## 언어별 완전 가림률

| 모델 / 임계값 | ko | en | fr | ru | ar | fa |
|---|---:|---:|---:|---:|---:|---:|
| fastino/gliner2-privacy-filter-PII-multi / 0.3 | 100.0% | 100.0% | 92.3% | 92.3% | 92.3% | 92.3% |
| fastino/gliner2-privacy-filter-PII-multi / 0.5 | 92.3% | 100.0% | 92.3% | 92.3% | 92.3% | 92.3% |
| knowledgator/gliner-pii-edge-v1.0 / 0.3 | 23.1% | 84.6% | 84.6% | 69.2% | 23.1% | 23.1% |
| knowledgator/gliner-pii-edge-v1.0 / 0.5 | 15.4% | 84.6% | 84.6% | 61.5% | 7.7% | 15.4% |
| urchade/gliner_multi_pii-v1 / 0.3 | 100.0% | 100.0% | 100.0% | 92.3% | 100.0% | 100.0% |
| urchade/gliner_multi_pii-v1 / 0.5 | 100.0% | 100.0% | 100.0% | 92.3% | 100.0% | 100.0% |
| openai/privacy-filter / None | 76.9% | 100.0% | 100.0% | 84.6% | 84.6% | 61.5% |

## 종류별 완전 가림

| 모델 / 임계값 | 이름 | 이메일 | 전화 | 주소 | 생년월일 | 여권 |
|---|---:|---:|---:|---:|---:|---:|
| fastino/gliner2-privacy-filter-PII-multi / 0.3 | 36/36 | 18/18 | 6/6 | 2/6 | 6/6 | 6/6 |
| fastino/gliner2-privacy-filter-PII-multi / 0.5 | 36/36 | 18/18 | 6/6 | 1/6 | 6/6 | 6/6 |
| knowledgator/gliner-pii-edge-v1.0 / 0.3 | 19/36 | 5/18 | 6/6 | 2/6 | 2/6 | 6/6 |
| knowledgator/gliner-pii-edge-v1.0 / 0.5 | 18/36 | 3/18 | 6/6 | 2/6 | 2/6 | 4/6 |
| urchade/gliner_multi_pii-v1 / 0.3 | 36/36 | 18/18 | 6/6 | 6/6 | 5/6 | 6/6 |
| urchade/gliner_multi_pii-v1 / 0.5 | 36/36 | 18/18 | 6/6 | 6/6 | 5/6 | 6/6 |
| openai/privacy-filter / None | 27/36 | 18/18 | 6/6 | 6/6 | 3/6 | 6/6 |

## 민감속성 zero-shot 탐색

| 모델 / 임계값 | 완전 가림 |
|---|---:|
| fastino/gliner2-privacy-filter-PII-multi / 0.3 | 13/18 |
| fastino/gliner2-privacy-filter-PII-multi / 0.5 | 12/18 |
| knowledgator/gliner-pii-edge-v1.0 / 0.3 | 12/18 |
| knowledgator/gliner-pii-edge-v1.0 / 0.5 | 9/18 |
| urchade/gliner_multi_pii-v1 / 0.3 | 15/18 |
| urchade/gliner_multi_pii-v1 / 0.5 | 15/18 |
| openai/privacy-filter / None | 기본 분류 미지원 |

각 모델 JSON에는 모델 revision, 패키지 버전, 입력·정답 구간·예측 구간, 개별 지연, 오류가 기록되어 있다. summary.json의 misses에서 누락 사례를 확인할 수 있다.
