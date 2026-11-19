-- 회원 유형과 지원기관 가입 신청 권한 검증. 새 DB에서 실행한다.
\set ON_ERROR_STOP on
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'applicant@example.test'),
  ('00000000-0000-0000-0000-00000000000b', 'other@example.test'),
  ('00000000-0000-0000-0000-0000000000ad', 'admin@example.test');
insert into public.user_roles (user_id, role) values ('00000000-0000-0000-0000-0000000000ad', 'admin');

set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
do $$ begin
  -- 회원 유형은 본인이 고를 수 있지만 권한은 생기지 않는다
  update public.profiles set member_type = 'supporter' where user_id = auth.uid();
  assert (select member_type from public.profiles where user_id = auth.uid()) = 'supporter', 'type saved';
  assert not public.has_role('supporter'), 'type alone grants nothing';
  begin update public.profiles set member_type = 'officer' where user_id = auth.uid(); raise exception 'bad type';
  exception when check_violation then null; end;
  -- 신청은 대기 상태로만 낼 수 있다
  begin insert into public.supporter_applications (user_id, organization_name, status) values (auth.uid(), '나눔센터', 'approved'); raise exception 'self approved';
  exception when insufficient_privilege then null; when others then if sqlerrm = 'self approved' then raise; end if; end;
  begin insert into public.supporter_applications (user_id, organization_name) values ('00000000-0000-0000-0000-00000000000b', '남의 신청'); raise exception 'other user';
  exception when insufficient_privilege then null; when others then if sqlerrm = 'other user' then raise; end if; end;
  insert into public.supporter_applications (user_id, organization_name, note) values (auth.uid(), '나눔센터', '상담팀');
  begin update public.supporter_applications set status = 'approved' where user_id = auth.uid();
    assert (select status from public.supporter_applications where user_id = auth.uid()) = 'pending', 'no self update';
  exception when insufficient_privilege then null; end;
  begin perform public.review_supporter_application((select id from public.supporter_applications where user_id = auth.uid()), true); raise exception 'self review';
  exception when raise_exception then if sqlerrm <> 'admin only' then raise; end if; end;
end $$;

-- 다른 회원은 남의 신청을 볼 수 없다
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
do $$ begin
  assert (select count(*) from public.supporter_applications) = 0, 'others hidden';
end $$;

-- 관리자가 승인하면 supporter 역할이 생기고 감사 로그가 남는다
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000ad';
do $$ begin
  assert (select count(*) from public.supporter_applications) = 1, 'admin sees';
  perform public.review_supporter_application((select id from public.supporter_applications limit 1), true);
  begin perform public.review_supporter_application((select id from public.supporter_applications limit 1), false); raise exception 'decided twice';
  exception when raise_exception then if sqlerrm <> 'no pending application' then raise; end if; end;
end $$;

set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
do $$ begin
  assert public.has_role('supporter'), 'approved applicant is supporter';
  assert (select status from public.supporter_applications where user_id = auth.uid()) = 'approved', 'status approved';
  -- 승인된 신청은 지울 수 없다
  delete from public.supporter_applications where user_id = auth.uid();
  assert (select count(*) from public.supporter_applications where user_id = auth.uid()) = 1, 'approved kept';
end $$;
reset role;
do $$ begin
  assert (select count(*) from public.audit_logs where action = 'supporter.approve') = 1, 'audit logged';
end $$;
select 'member type tests passed';
