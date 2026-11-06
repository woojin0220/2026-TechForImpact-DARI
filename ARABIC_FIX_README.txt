DARI · 아랍어 UI·RTL 수정본 · 2026-11-04

기준 원본: https://github.com/woojin0220/2026-TechForImpact-DARI
기준 커밋: 2b298384f5e6914b48a77a969ed9f99c5c344073
기본 로컬 모델: gemma4:e4b (README·원본 코드와 동일)

코드 원인과 원본 비교: docs/arabic-fix/변경설명.html
전체 번역 키·문항 감사: docs/arabic-fix/TRANSLATION_AUDIT.json
실제 화면 증거: docs/arabic-fix/evidence/
검증 기록: docs/arabic-fix/VALIDATION.json 및 arabic-test-results.txt

개발 실행:
1. Ollama에서 gemma4:e4b를 준비합니다. 최초 한 번: ollama pull gemma4:e4b
2. 레포 루트에서 python3 local_verification_server.py
3. 별도 터미널에서 cd capacitor-web
4. npm ci
5. npm run audit:ar
6. npm test
7. npm run build
8. npm run dev -- --host 127.0.0.1 --port 5173 --strictPort
9. http://127.0.0.1:5173/ 에 접속해 العربية를 선택합니다.

수정의 핵심:
- 한국어가 아니면 영어를 표시하던 분기를 아랍어 번역 키 조회로 바꿨습니다.
- 누락된 메타데이터 등의 아랍어 라벨과 버튼·안내·오류·로딩·운영자 도구 문구를 추가했습니다.
- RTL 배치와 화살표를 보완하고, 실제 한국어 초안·날짜·숫자·모델 이름은 따로 방향을 지정했습니다.
- 언어 변경 시 대화 전 기본정보가 지워지던 경로도 수정했습니다.
- 아랍어 의미 확인·역번역을 새로 구현한 것은 아닙니다. 지원 제한을 아랍어로 안내합니다.
- 원문·한국어 초안·기계 식별자는 번역하지 않습니다.
- 원어민의 아랍어 번역 감수와 모바일 실기기 검증은 별도입니다.

수정 코드는 작업 브랜치에서 검토할 수 있습니다. main 반영 여부는 저장소의 PR·Merge 기록을 확인하세요.
원본과 수정본의 차이는 위 기준 커밋과 작업 브랜치를 비교해 확인할 수 있습니다.
