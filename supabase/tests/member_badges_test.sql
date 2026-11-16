-- 뱃지 권한 검증. platform_rls_test.sql과 별도로, 새 DB에서 실행한다.
\set ON_ERROR_STOP on
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'member@example.test'),
  ('00000000-0000-0000-0000-00000000000b', 'other@example.test'),
  ('00000000-0000-0000-0000-00000000005a', 'supporter@example.test'),
  ('00000000-0000-0000-0000-0000000000ad', 'admin@example.test');
insert into public.user_roles (user_id, role) values
  ('00000000-0000-0000-0000-00000000005a', 'supporter'), ('00000000-0000-0000-0000-0000000000ad', 'admin');
update public.profiles set nickname = 'member' where user_id = '00000000-0000-0000-0000-00000000000a';
update public.profiles set nickname = 'other' where user_id = '00000000-0000-0000-0000-00000000000b';
create temp table issued (code text);
grant all on issued to authenticated;

set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
insert into issued select code from public.create_badge_request('recognized_refugee');
do $$ begin
  assert (select count(*) from issued) = 1, 'member got a code';
  assert (select code from issued) ~ '^[0-9]{6}$', 'six digits';
  begin perform * from public.badge_requests; raise exception 'requests readable';
  exception when insufficient_privilege then null; when others then if sqlerrm = 'requests readable' then raise; end if; end;
  begin insert into public.member_badges (user_id, badge) values (auth.uid(), 'recognized_refugee'); raise exception 'self grant';
  exception when insufficient_privilege then null; when others then if sqlerrm = 'self grant' then raise; end if; end;
  begin perform public.grant_badge_by_code((select code from issued)); raise exception 'member granted';
  exception when raise_exception then if sqlerrm <> 'supporter only' then raise; end if; end;
end $$;

-- 일반 회원 B도 부여할 수 없다
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
do $$ begin
  begin perform public.grant_badge_by_code((select code from issued)); raise exception 'other granted';
  exception when raise_exception then if sqlerrm <> 'supporter only' then raise; end if; end;
end $$;

-- 지원기관 담당자: 틀린 코드는 실패, 맞는 코드는 부여 후 닉네임 반환, 코드 재사용 불가
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000005a';
do $$ begin
  begin perform public.grant_badge_by_code('000000'); raise exception 'wrong code accepted';
  exception when raise_exception then if sqlerrm <> 'invalid or expired code' then raise; end if; end;
  assert public.grant_badge_by_code((select code from issued)) = 'member', 'grant returns nickname';
  begin perform public.grant_badge_by_code((select code from issued)); raise exception 'code reused';
  exception when raise_exception then if sqlerrm <> 'invalid or expired code' then raise; end if; end;
end $$;

-- 기본은 숨김: 다른 회원에게 보이지 않는다
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
do $$ begin
  assert (select badges from public.public_profiles where nickname = 'member') = '{}', 'hidden by default';
  assert (select count(*) from public.member_badges) = 0, 'B cannot read A badge rows';
  perform public.set_badge_visibility('recognized_refugee', true);
end $$;
-- B가 A의 표시 여부를 바꿀 수 없다
do $$ begin assert (select badges from public.public_profiles where nickname = 'member') = '{}', 'B cannot toggle A'; end $$;

-- 본인이 켜면 공개 뷰에 나타난다
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select public.set_badge_visibility('recognized_refugee', true);
do $$ begin
  assert (select badges from public.public_profiles where nickname = 'member') = '{recognized_refugee}', 'visible after opt-in';
  assert (select verified_by from public.member_badges) = '00000000-0000-0000-0000-00000000005a', 'verifier recorded';
  begin perform public.create_badge_request('recognized_refugee'); raise exception 'duplicate request';
  exception when raise_exception then if sqlerrm <> 'badge already granted' then raise; end if; end;
  begin perform public.revoke_badge('00000000-0000-0000-0000-00000000000b', 'recognized_refugee'); raise exception 'revoked other';
  exception when raise_exception then if sqlerrm <> 'not allowed' then raise; end if; end;
end $$;
-- 본인 삭제
select public.revoke_badge('00000000-0000-0000-0000-00000000000a', 'recognized_refugee', 'self');
do $$ begin assert (select count(*) from public.member_badges) = 0, 'self removed'; end $$;

-- 담당자는 자기 자신을 인증할 수 없다
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000005a';
truncate issued;
insert into issued select code from public.create_badge_request('recognized_refugee');
do $$ begin
  begin perform public.grant_badge_by_code((select code from issued)); raise exception 'self verified';
  exception when raise_exception then if sqlerrm <> 'cannot verify yourself' then raise; end if; end;
end $$;

-- 만료된 코드
reset role;
update public.badge_requests set expires_at = now() - interval '1 minute';
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000ad';
do $$ begin
  begin perform public.grant_badge_by_code((select code from issued)); raise exception 'expired accepted';
  exception when raise_exception then if sqlerrm <> 'invalid or expired code' then raise; end if; end;
  assert (select count(*) from public.audit_logs where action = 'badge.grant') = 1, 'grant audited';
  assert (select count(*) from public.audit_logs where action = 'badge.revoke') = 1, 'revoke audited';
end $$;
reset role;
select 'member badge tests passed' as result;
