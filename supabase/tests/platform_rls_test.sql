-- 권한 규칙 검증. 실패하면 예외로 중단된다.
\set ON_ERROR_STOP on
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@example.test'),
  ('00000000-0000-0000-0000-00000000000b', 'b@example.test'),
  ('00000000-0000-0000-0000-0000000000ad', 'admin@example.test');
-- 첫 관리자는 서비스 권한(SQL 편집기)으로 직접 지정한다.
insert into public.user_roles (user_id, role) values ('00000000-0000-0000-0000-0000000000ad', 'admin');

do $$ begin
  assert (select count(*) from public.profiles) = 3, 'profiles created by trigger';
  assert (select count(*) from public.user_roles where role = 'user') = 3, 'default user role';
  assert (select count(*) from public.notification_prefs) = 3, 'default prefs';
end $$;

-- 사용자 A로 전환
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
update public.profiles set nickname = 'alpha', age_confirmed_at = now() where true;
insert into public.consents (user_id, document, version) values ('00000000-0000-0000-0000-00000000000a', 'terms', '2026-11');
do $$ begin
  assert (select count(*) from public.profiles) = 1, 'A sees only own profile';
  assert (select nickname::text from public.profiles) = 'alpha', 'A updated own nickname';
  assert (select count(*) from public.user_roles) = 1, 'A sees only own roles';
  assert (select count(*) from public.audit_logs) = 0, 'A cannot read audit logs';
end $$;
do $$ begin
  begin
    update public.profiles set status = 'suspended' where user_id = auth.uid();
    raise exception 'self status change should fail';
  exception when raise_exception then
    if sqlerrm = 'self status change should fail' then raise; end if;
  end;
  begin
    insert into public.user_roles (user_id, role) values (auth.uid(), 'admin');
    raise exception 'self role grant should fail';
  exception when insufficient_privilege then null;
           when others then if sqlerrm = 'self role grant should fail' then raise; end if;
  end;
  begin
    perform public.set_user_role(auth.uid(), 'admin', true);
    raise exception 'non-admin set_user_role should fail';
  exception when raise_exception then
    if sqlerrm <> 'admin only' then raise; end if;
  end;
  begin
    insert into public.consents (user_id, document, version) values ('00000000-0000-0000-0000-00000000000b', 'terms', 'x');
    raise exception 'consent for another user should fail';
  exception when insufficient_privilege then null;
           when others then if sqlerrm = 'consent for another user should fail' then raise; end if;
  end;
end $$;

-- 사용자 B는 A의 프로필 행을 못 보고, 공개 뷰로 닉네임만 본다.
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
do $$ begin
  assert (select count(*) from public.profiles where user_id = '00000000-0000-0000-0000-00000000000a') = 0, 'B cannot read A profile row';
  assert (select count(*) from public.public_profiles where nickname = 'alpha') = 1, 'B sees A nickname via public view';
  assert (select count(*) from public.consents) = 0, 'B cannot read A consents';
end $$;
update public.profiles set nickname = 'x' where user_id = '00000000-0000-0000-0000-00000000000a';
reset role;
do $$ begin
  assert (select nickname::text from public.profiles where user_id = '00000000-0000-0000-0000-00000000000a') = 'alpha', 'B could not change A';
end $$;

-- 관리자: 역할 부여와 정지, 감사 로그
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000ad';
select public.set_user_role('00000000-0000-0000-0000-00000000000b', 'moderator', true);
select public.set_user_status('00000000-0000-0000-0000-00000000000a', 'suspended', 'test');
do $$ begin
  assert (select count(*) from public.audit_logs) = 2, 'admin sees audit logs';
  assert (select count(*) from public.profiles) = 3, 'admin sees all profiles';
end $$;
-- 정지된 사용자는 공개 뷰에서 빠진다.
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
do $$ begin
  assert public.is_staff(), 'moderator is staff';
  assert (select count(*) from public.public_profiles where nickname = 'alpha') = 0, 'suspended user hidden';
end $$;
reset role;
-- 탈퇴(auth.users 삭제) 시 관련 행 삭제
delete from auth.users where id = '00000000-0000-0000-0000-00000000000a';
do $$ begin
  assert (select count(*) from public.profiles where user_id = '00000000-0000-0000-0000-00000000000a') = 0, 'profile removed';
  assert (select count(*) from public.consents where user_id = '00000000-0000-0000-0000-00000000000a') = 0, 'consents removed';
end $$;
select 'platform RLS tests passed' as result;
