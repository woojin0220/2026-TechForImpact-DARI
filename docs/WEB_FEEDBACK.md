# DARI 웹 사용 흐름 체험판

## 실행

공개 주소: https://jwl112.github.io/dari-feedback-preview/

iPhone Safari에서 주소를 열고 언어 선택 → 체험 시작. 로그인·이메일 인증·앱 설치가 필요하지 않습니다.

앱처럼 사용하려면 Safari 공유 → 홈 화면에 추가 → 앱으로 열기(표시되는 경우) → 추가. 홈 화면의 DARI 아이콘으로 실행하면 standalone 화면으로 열립니다. 이 방식은 웹앱이며 네이티브 iOS 앱 또는 오프라인 앱은 아닙니다.

## 체험 범위

- 신청서 문항 선택·직접 작성·작성 안내·원본 미리보기
- 첫 화면의 ‘가상 예시로 작성 흐름 보기’로 14.2 안내·확인·수정·다운로드 체험
- 예시 번역은 미리 준비한 고정 문장. 입력을 수정하면 임의의 결과를 만들거나 서버에 보내지 않고 실제 번역 제외 안내 표시
- PDF/HWP 예시 파일명 `DARI-UX-example`로 실제 작성본과 구분
- 스케줄러와 커뮤니티는 로컬 샘플 데이터 사용. 실제 회원에게 글이 게시되지 않음
- 입력·샘플 데이터는 해당 브라우저에만 저장. 다른 방문자와 공유되지 않으며, 브라우저/앱 종료 시 일부 데이터가 사라질 수 있음

## 검증

전체 테스트 342개 통과. 모바일 크기에서 언어 선택 → 체험 진입 → 14.2 안내 체크 → 예시 작성 → 준비된 한국어 결과 확인 → 확인 표시 → PDF/HWP 다운로드 확인. 로컬 번역 서버·Supabase·생성형 모델 API 요청 없음. 320·390·768·1024px에서 다운로드 화면 가로 넘침 없음. standalone manifest·아이콘 응답 확인.

실제 iPhone 홈 화면 실행·Safari 파일 저장은 사용자 기기에서 최종 확인 필요. 이 체험판은 번역 품질 검증이나 실제 신청서 제출을 위한 서비스가 아님.

## 재빌드

```powershell
cd capacitor-web
npm run build:web-feedback -- --base /dari-feedback-preview/
```

소스 브랜치: `feat/web-feedback`. Android·iPhone ML Kit 설치본은 `feat/mobile-mlkit` 유지. 웹 체험용 분기는 native feedback 모드와 분리되어 있으며 main 미병합.

정적 배포 저장소: https://github.com/jwl112/dari-feedback-preview (`gh-pages`). 새 빌드의 `dist`만 반영하며 비밀 환경 파일·입력 데이터는 배포하지 않음.
