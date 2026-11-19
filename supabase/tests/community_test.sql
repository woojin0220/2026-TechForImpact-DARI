-- 커뮤니티 권한 검증. 새 DB에 stub과 모든 마이그레이션을 적용한 뒤 실행한다.
\set ON_ERROR_STOP on
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@example.test'),
  ('00000000-0000-0000-0000-00000000000b', 'b@example.test'),
  ('00000000-0000-0000-0000-00000000000c', 'c@example.test'),
  ('00000000-0000-0000-0000-00000000000d', 'd@example.test'),
  ('00000000-0000-0000-0000-00000000000e', 'new@example.test'),
  ('00000000-0000-0000-0000-00000000005a', 'supporter@example.test'),
  ('00000000-0000-0000-0000-0000000000a0', 'mod@example.test');
update public.profiles set nickname = 'n_' || right(user_id::text, 2), age_confirmed_at = now()
  where user_id <> '00000000-0000-0000-0000-00000000000e';
insert into public.user_roles (user_id, role) values
  ('00000000-0000-0000-0000-00000000005a', 'supporter'), ('00000000-0000-0000-0000-0000000000a0', 'moderator');
create temp table ids (name text primary key, id uuid);
grant all on ids to authenticated;

set role authenticated;
-- A가 글을 쓴다
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
with x as (insert into public.posts (board_id, author_id, title, body) values ('qna', auth.uid(), '출입국 방문 질문', '본문입니다') returning id)
insert into ids select 'post_a', id from x;
do $$ begin
  begin insert into public.posts (board_id, author_id, title, body) values ('notice', auth.uid(), '공지 시도', '본문'); raise exception 'member wrote notice';
  exception when insufficient_privilege then null; when others then if sqlerrm = 'member wrote notice' then raise; end if; end;
  begin insert into public.posts (board_id, author_id, title, body) values ('qna', '00000000-0000-0000-0000-00000000000b', '대리 작성', '본문'); raise exception 'impersonation';
  exception when insufficient_privilege then null; when others then if sqlerrm = 'impersonation' then raise; end if; end;
  begin insert into public.posts (board_id, author_id, title, body, status) values ('qna', auth.uid(), '숨김으로 작성', '본문', 'hidden'); raise exception 'hidden insert';
  exception when insufficient_privilege then null; when others then if sqlerrm = 'hidden insert' then raise; end if; end;
end $$;

-- 가입 절차를 마치지 않은 회원은 읽기·쓰기 불가
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000e';
do $$ begin
  assert (select count(*) from public.post_feed) = 0, 'incomplete member reads nothing';
  begin insert into public.posts (board_id, author_id, title, body) values ('qna', auth.uid(), '제목', '본문'); raise exception 'incomplete wrote';
  exception when insufficient_privilege then null; when others then if sqlerrm = 'incomplete wrote' then raise; end if; end;
end $$;

-- 지원기관은 공지를 쓸 수 있다
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000005a';
insert into public.posts (board_id, author_id, title, body) values ('notice', auth.uid(), '상담 일정 안내', '본문');

-- B: 읽기, 댓글, 도움됨, 남의 글 수정 불가
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
with x as (insert into public.comments (post_id, author_id, body) values ((select id from ids where name = 'post_a'), auth.uid(), '답변입니다') returning id)
insert into ids select 'comment_b', id from x;
insert into public.post_reactions (post_id, user_id) values ((select id from ids where name = 'post_a'), auth.uid());
update public.posts set title = '바꿈' where id = (select id from ids where name = 'post_a');
do $$ begin
  assert (select count(*) from public.post_feed) = 2, 'B sees two posts';
  assert (select comment_count from public.post_feed where id = (select id from ids where name = 'post_a')) = 1, 'comment counted';
  assert (select helpful_count from public.post_feed where id = (select id from ids where name = 'post_a')) = 1, 'helpful counted';
  assert (select helped_by_me from public.post_feed where id = (select id from ids where name = 'post_a')), 'helped by me';
  assert (select author_is_supporter from public.post_feed where board_id = 'notice'), 'supporter marked';
  assert (select title from public.posts where id = (select id from ids where name = 'post_a')) = '출입국 방문 질문', 'B cannot edit A';
  begin insert into public.post_reactions (post_id, user_id) values ((select id from ids where name = 'post_a'), '00000000-0000-0000-0000-00000000000c'); raise exception 'reaction for other';
  exception when insufficient_privilege then null; when others then if sqlerrm = 'reaction for other' then raise; end if; end;
end $$;

-- 작성자는 숨김·복구를 못 하고 삭제만 할 수 있다
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
do $$ begin
  begin update public.posts set status = 'hidden' where id = (select id from ids where name = 'post_a'); raise exception 'author hid';
  exception when raise_exception then if sqlerrm <> 'status change not allowed' then raise; end if; end;
  begin update public.posts set report_count = 5 where id = (select id from ids where name = 'post_a'); raise exception 'author reset reports';
  exception when raise_exception then if sqlerrm <> 'immutable column' then raise; end if; end;
end $$;
update public.posts set title = '출입국 방문 질문(수정)' where id = (select id from ids where name = 'post_a');

-- 차단: A가 B를 차단하면 B의 댓글이 A에게 안 보인다
insert into public.blocks (blocker_id, blocked_id) values (auth.uid(), '00000000-0000-0000-0000-00000000000b');
do $$ begin
  assert (select count(*) from public.comment_feed) = 0, 'blocked comment hidden';
  assert (select count(*) from public.blocks) = 1, 'own block visible';
end $$;

-- 신고 3건이면 자동 숨김. 중복 신고 불가. 신고자는 남의 신고를 못 본다.
insert into public.reports (reporter_id, target_type, target_id, reason) values (auth.uid(), 'comment', (select id from ids where name = 'comment_b'), 'spam');
do $$ begin
  begin insert into public.reports (reporter_id, target_type, target_id, reason) values (auth.uid(), 'comment', (select id from ids where name = 'comment_b'), 'spam'); raise exception 'duplicate report';
  exception when unique_violation then null; end;
end $$;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
insert into public.reports (reporter_id, target_type, target_id, reason) values (auth.uid(), 'post', (select id from ids where name = 'post_a'), 'identity');
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
insert into public.reports (reporter_id, target_type, target_id, reason) values (auth.uid(), 'post', (select id from ids where name = 'post_a'), 'identity');
do $$ begin assert (select count(*) from public.reports) = 1, 'C sees only own report'; end $$;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000d';
insert into public.reports (reporter_id, target_type, target_id, reason) values (auth.uid(), 'post', (select id from ids where name = 'post_a'), 'identity');
do $$ begin
  assert (select count(*) from public.post_feed where id = (select id from ids where name = 'post_a')) = 0, 'auto hidden after 3 reports';
end $$;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
do $$ begin
  assert (select status from public.post_feed where id = (select id from ids where name = 'post_a')) = 'hidden', 'author still sees own hidden post';
  begin insert into public.comments (post_id, author_id, body) values ((select id from ids where name = 'post_a'), auth.uid(), '숨김 글 댓글'); raise exception 'comment on hidden';
  exception when insufficient_privilege then null; when others then if sqlerrm = 'comment on hidden' then raise; end if; end;
end $$;

-- 모더레이터: 신고 목록 확인, 복구, 처리. 감사 로그.
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a0';
do $$ begin
  assert (select count(*) from public.reports where status = 'open') = 4, 'moderator sees all reports';
  perform public.moderate_content('post', (select id from ids where name = 'post_a'), 'visible', 'reviewed');
  perform public.resolve_report(r.id, 'dismissed') from public.reports r where r.target_type = 'post';
end $$;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
do $$ begin
  assert (select count(*) from public.post_feed where id = (select id from ids where name = 'post_a')) = 1, 'restored';
  begin perform public.moderate_content('post', (select id from ids where name = 'post_a'), 'hidden'); raise exception 'member moderated';
  exception when raise_exception then if sqlerrm <> 'staff only' then raise; end if; end;
end $$;

-- 작성자 삭제
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select public.delete_own_content('post', (select id from ids where name = 'post_a'));
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
do $$ begin
  begin perform public.delete_own_content('comment', (select id from ids where name = 'post_a')); raise exception 'deleted wrong';
  exception when raise_exception then if sqlerrm <> 'not found' then raise; end if; end;
end $$;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
do $$ begin assert (select count(*) from public.post_feed where id = (select id from ids where name = 'post_a')) = 0, 'deleted gone'; end $$;
reset role;
do $$ begin assert (select count(*) from public.audit_logs where action like 'content.%' or action like 'report.%') = 4, 'moderation audited'; end $$;
-- 탈퇴하면 글도 삭제
delete from auth.users where id = '00000000-0000-0000-0000-00000000005a';
do $$ begin assert (select count(*) from public.posts where board_id = 'notice') = 0, 'posts removed with account'; end $$;
select 'community tests passed' as result;
