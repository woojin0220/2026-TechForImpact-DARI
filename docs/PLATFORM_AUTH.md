# 통합 운영 기반: 로그인·계정·권한

신청서 외 기능(커뮤니티, 스케줄러)이 함께 쓰는 계정과 권한 기반입니다. 설계 배경은 프로젝트의 "DARI 통합 운영 시스템과 커뮤니티 요구사항" 문서를 따릅니다.

## 원칙

- 신청서 원문·초안·메타데이터는 서버에 저장하지 않고 계정과 연결하지 않습니다. 신청서 탭은 로그인 없이 그대로 동작합니다.
- 계정에는 이메일(인증 서비스가 보관)과 닉네임, 선호 언어, 만 14세 이상 확인 시각, 동의 이력만 둡니다. 실명·국적·체류자격은 받지 않습니다.
- 권한 검사는 서버의 행 단위 권한(RLS)과 `security definer` 함수에서 합니다. 앱 화면의 버튼 숨김은 보조 수단입니다.

## 구성

| 위치 | 내용 |
| --- | --- |
| `supabase/migrations/20261113000000_platform.sql` | 테이블, 역할, 권한 규칙, 가입 트리거, 관리 함수 |
| `supabase/migrations/20261116000000_member_badges.sql` | 회원 뱃지(난민 인정), 대면 인증 코드, 부여·표시·회수 함수 |
| `supabase/functions/delete-account` | 회원 탈퇴(본인 auth 계정 삭제, 관련 행은 cascade 삭제) |
| `supabase/tests/` | 로컬 Postgres용 auth 스텁과 권한 테스트 |
| `capacitor-web/src/platform/` | 설정, Supabase 클라이언트, 데이터 함수, 인증 상태(`AuthProvider`/`useAuth`), 로그인·가입·내 정보 화면, 6개 언어 문구 |
| `capacitor-web/src/shell/CommunityTab.tsx` | 커뮤니티 탭: 로그인·가입을 마친 회원에게만 내용 표시 |

### 테이블

`profiles`, `user_roles`(user·supporter·moderator·admin), `organizations`, `org_members`, `consents`(terms·privacy·community, 버전별), `devices`(푸시 토큰), `notification_prefs`, `audit_logs`. 다른 회원의 닉네임은 `public_profiles` 뷰로만 봅니다(정지 회원 제외).

### 권한 요약

| 동작 | 누가 |
| --- | --- |
| 내 프로필 읽기·닉네임·언어 수정 | 본인 |
| 프로필 `status`(정지) 변경 | 모더레이터 이상, `set_user_status()` |
| 역할 부여·회수 | 관리자, `set_user_role()` |
| 지원기관 등록·승인 | 관리자 |
| 감사 로그 읽기 | 관리자 |
| 동의 기록 추가·철회 | 본인 |

첫 관리자는 Supabase SQL 편집기에서 직접 넣습니다.

```sql
insert into public.user_roles (user_id, role) values ('<관리자 user id>', 'admin');
```

## 난민 인정 뱃지

난민으로 인정받은 회원에게 지원기관이 직접 확인한 뒤 붙여 주는 뱃지입니다. 역할(권한)과는 별개이고, 권한을 더 주지 않습니다.

1. 회원이 내 정보 → 뱃지 → **인증 코드 받기**를 누르면 6자리 코드가 나옵니다(10분 유효, 새 코드를 받으면 이전 코드는 폐기).
2. 회원이 지원기관 담당자(`supporter` 역할) 또는 관리자를 만나 난민 인정 사실을 보여 줍니다. 담당자는 내 정보 → **뱃지 인증하기**에 코드를 입력합니다.
3. 부여되면 담당자 화면에 회원 닉네임이 나와 맞는 사람인지 확인할 수 있고, 감사 로그에 `badge.grant`가 남습니다.

안전 장치

- 서류 사진, 외국인등록번호, 체류자격·인정 번호는 받지도 저장하지도 않습니다. 저장하는 것은 뱃지 종류, 확인한 담당자, 확인 시각뿐입니다.
- 뱃지는 기본으로 **숨김**입니다. 본인이 "다른 회원에게 뱃지 보이기"를 켜야 `public_profiles.badges`에 나타납니다. 체류 상황이 드러나는 정보라서 본인 선택에 맡깁니다.
- 본인은 언제든 뱃지를 지울 수 있고, 모더레이터 이상은 잘못 부여된 뱃지를 회수할 수 있습니다(`revoke_badge`, 감사 로그 `badge.revoke`).
- 코드는 회원 본인만 만들 수 있고, 담당자는 자기 자신을 인증할 수 없습니다. 코드 표(`badge_requests`)는 앱에서 직접 읽을 수 없습니다.
- 운영 전에 정할 것: 어느 기관 담당자에게 `supporter` 역할을 줄지, 무엇을 보고 확인할지(예: 난민인정증명서 원본 확인 후 즉시 반환), 뱃지 이름을 화면에 어떻게 보여 줄지.

## 가입·로그인 흐름

1. 이메일 입력 → 인증코드 발송(`signInWithOtp`). 비밀번호는 없습니다.
2. 코드 입력 → 세션 생성(`verifyOtp`). 첫 로그인이면 트리거가 프로필·기본 역할·알림 설정을 만듭니다.
3. 만 14세 이상 확인, 이용약관·개인정보 처리방침·커뮤니티 규칙 동의, 닉네임 설정.
4. 문서 버전(`consentVersions`)을 올리면 다음 진입 때 다시 동의를 받습니다.
5. 내 정보에서 닉네임 변경, 로그아웃, 회원 탈퇴.

## 설정 방법 (사람 손이 필요한 일)

1. Supabase 프로젝트 생성. 리전은 Seoul(ap-northeast-2) 권장.
2. 마이그레이션 적용: Supabase CLI로 `supabase link` 후 `supabase db push`, 또는 SQL 편집기에 마이그레이션 파일 내용을 실행.
3. Authentication → Providers → Email 사용. "Confirm email" 켜기.
4. Authentication → Email Templates의 Magic Link 템플릿에 코드가 보이도록 `{{ .Token }}`을 넣습니다. 기본 템플릿은 링크만 보냅니다.
5. 실제 서비스 전에는 SMTP(발신 메일 서버)를 연결합니다. 기본 메일 발송은 시간당 발송량이 적습니다.
6. 탈퇴 함수 배포: `supabase functions deploy delete-account`.
7. `capacitor-web/.env`에 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`를 넣고 다시 빌드합니다.

## 로컬 권한 테스트

Postgres 16에서 Supabase 없이 권한 규칙을 확인합니다. 테스트마다 새 DB를 씁니다.

```sh
for test in platform_rls_test member_badges_test; do
  dropdb --if-exists dari_test && createdb dari_test
  psql -v ON_ERROR_STOP=1 -d dari_test -f supabase/tests/local_auth_stub.sql
  for file in supabase/migrations/*.sql; do psql -v ON_ERROR_STOP=1 -d dari_test -f "$file"; done
  psql -v ON_ERROR_STOP=1 -d dari_test -f supabase/tests/$test.sql   # 마지막 줄: ... tests passed
done
```

## 가정과 남은 일

문서의 미결정 항목은 아래 권장안으로 진행했습니다. 바꾸려면 알려주세요.

- 백엔드: Supabase. 로그인: 이메일 인증코드만. Google·Apple 로그인은 앱 딥링크 설정이 필요해 다음 단계로 미뤘습니다(Google을 넣으면 iOS에서는 Apple 로그인도 필요).
- 커뮤니티는 로그인한 회원만 볼 수 있게 했습니다. 비로그인 읽기를 허용하려면 게시판 권한 규칙만 바꾸면 됩니다.
- 세션은 Supabase 기본값처럼 웹뷰의 `localStorage`에 저장합니다. 모바일에서 Keychain·Keystore 보안 저장소로 옮기는 작업은 네이티브 플러그인 추가와 실기기 확인이 필요해 남겨 두었습니다.
- 이용약관·개인정보 처리방침 본문은 아직 없습니다. 동의 화면은 문서 버전만 기록합니다. 실제 공개 전에 본문과 링크, 법률 검토가 필요합니다.
- 푸시 알림(`devices`), 지원기관 승인 화면, 운영자 웹은 테이블만 준비했습니다.
