-- 커뮤니티: 게시판, 글, 댓글, 도움됨, 신고, 차단.
-- 신청서 데이터와 연결하지 않는다. 탈퇴하면 작성한 글·댓글도 함께 삭제한다(cascade).

create table public.boards (
  id text primary key check (id ~ '^[a-z_]{2,20}$'),
  sort int not null default 0,
  staff_only_write boolean not null default false
);
insert into public.boards (id, sort, staff_only_write) values
  ('qna', 1, false),      -- 질문과 답변
  ('life', 2, false),     -- 생활 정보
  ('notice', 3, true);    -- 지원기관 공지(지원기관 담당자·관리자만 작성)

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  board_id text not null references public.boards(id),
  author_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 2 and 100),
  body text not null check (char_length(btrim(body)) between 1 and 5000),
  language text not null default 'ko' check (language in ('ko','en','fr','ru','ar','fa')),
  status text not null default 'visible' check (status in ('visible','hidden','deleted')),
  report_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index posts_board_created on public.posts (board_id, created_at desc) where status = 'visible';
create index posts_author on public.posts (author_id);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  language text not null default 'ko' check (language in ('ko','en','fr','ru','ar','fa')),
  status text not null default 'visible' check (status in ('visible','hidden','deleted')),
  report_count int not null default 0,
  created_at timestamptz not null default now()
);
create index comments_post_created on public.comments (post_id, created_at);

create table public.post_reactions (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  target_type text not null check (target_type in ('post','comment','user')),
  target_id uuid not null,
  reason text not null check (reason in ('identity','scam','hate','spam','other')),
  detail text check (detail is null or char_length(detail) <= 500),
  status text not null default 'open' check (status in ('open','resolved','dismissed')),
  resolved_by uuid references auth.users(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  unique (reporter_id, target_type, target_id)
);
create index reports_open on public.reports (created_at) where status = 'open';

create table public.blocks (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

-- 도우미 함수 --------------------------------------------------------------
-- 가입 절차(닉네임·나이 확인)를 마친 정상 회원인지
create or replace function public.is_active_member()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles p where p.user_id = auth.uid() and p.status = 'active'
    and p.nickname is not null and p.age_confirmed_at is not null);
$$;

create or replace function public.can_write_board(target_board text)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_active_member() and exists (
    select 1 from public.boards b where b.id = target_board and (not b.staff_only_write or public.has_role('supporter')));
$$;

create or replace function public.has_blocked(other uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.blocks b where b.blocker_id = auth.uid() and b.blocked_id = other);
$$;

-- 작성자는 제목·본문 수정과 삭제(status=deleted)만 할 수 있다. 숨김·복구는 운영자만.
create or replace function public.guard_content_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.author_id is distinct from old.author_id or new.created_at is distinct from old.created_at
     or new.report_count is distinct from old.report_count then
    if not (coalesce(current_setting('dari.internal', true), '') = 'on') then raise exception 'immutable column'; end if;
  end if;
  if tg_table_name = 'posts' then
    if new.board_id is distinct from old.board_id and not public.is_staff() then raise exception 'board cannot be changed'; end if;
  end if;
  if new.status is distinct from old.status and not public.is_staff()
     and not (coalesce(current_setting('dari.internal', true), '') = 'on') then
    if not (old.author_id = auth.uid() and new.status = 'deleted') then raise exception 'status change not allowed'; end if;
  end if;
  if tg_table_name = 'posts' then new.updated_at = now(); end if;
  return new;
end;
$$;
create trigger posts_guard before update on public.posts for each row execute function public.guard_content_update();
create trigger comments_guard before update on public.comments for each row execute function public.guard_content_update();

-- 신고 3건이 쌓이면 자동으로 숨기고 운영자 확인을 기다린다.
create or replace function public.apply_report()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform set_config('dari.internal', 'on', true);
  if new.target_type = 'post' then
    update public.posts set report_count = report_count + 1,
      status = case when report_count + 1 >= 3 and status = 'visible' then 'hidden' else status end
      where id = new.target_id;
  elsif new.target_type = 'comment' then
    update public.comments set report_count = report_count + 1,
      status = case when report_count + 1 >= 3 and status = 'visible' then 'hidden' else status end
      where id = new.target_id;
  end if;
  perform set_config('dari.internal', 'off', true);
  return new;
end;
$$;
create trigger reports_apply after insert on public.reports for each row execute function public.apply_report();

-- 운영자: 글·댓글 숨김/복구, 신고 처리
create or replace function public.moderate_content(target_type text, target uuid, new_status text, reason text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'staff only'; end if;
  if new_status not in ('visible','hidden','deleted') then raise exception 'invalid status'; end if;
  if target_type = 'post' then update public.posts set status = new_status where id = target;
  elsif target_type = 'comment' then update public.comments set status = new_status where id = target;
  else raise exception 'invalid target'; end if;
  insert into public.audit_logs (actor_id, action, target_type, target_id, detail)
    values (auth.uid(), 'content.' || new_status, target_type, target::text, jsonb_build_object('reason', reason));
end;
$$;

-- 작성자: 내 글·댓글 삭제(숨김 처리로 보관하지 않고 status=deleted). 함수로만 한다.
create or replace function public.delete_own_content(target_type text, target uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if target_type = 'post' then
    update public.posts set status = 'deleted' where id = target and author_id = auth.uid() and status <> 'deleted';
  elsif target_type = 'comment' then
    update public.comments set status = 'deleted' where id = target and author_id = auth.uid() and status <> 'deleted';
  else raise exception 'invalid target'; end if;
  if not found then raise exception 'not found'; end if;
end;
$$;

create or replace function public.resolve_report(report uuid, outcome text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'staff only'; end if;
  if outcome not in ('resolved','dismissed') then raise exception 'invalid outcome'; end if;
  update public.reports set status = outcome, resolved_by = auth.uid(), resolved_at = now() where id = report;
  insert into public.audit_logs (actor_id, action, target_type, target_id, detail)
    values (auth.uid(), 'report.' || outcome, 'report', report::text, '{}'::jsonb);
end;
$$;

-- 행 단위 권한 ---------------------------------------------------------------
alter table public.boards enable row level security;
alter table public.posts enable row level security;
alter table public.comments enable row level security;
alter table public.post_reactions enable row level security;
alter table public.reports enable row level security;
alter table public.blocks enable row level security;
revoke all on public.boards from anon;
revoke all on public.posts, public.comments, public.post_reactions, public.reports, public.blocks from anon;

create policy boards_read on public.boards for select to authenticated using (true);

-- 글: 정상 회원은 보이는 글(차단한 사람 제외)과 내 글을, 운영자는 전부 읽는다.
create policy posts_read on public.posts for select to authenticated using (
  public.is_staff()
  or (author_id = auth.uid() and status <> 'deleted')
  or (status = 'visible' and public.is_active_member() and not public.has_blocked(author_id)));
create policy posts_insert on public.posts for insert to authenticated with check (
  author_id = auth.uid() and status = 'visible' and report_count = 0 and public.can_write_board(board_id));
create policy posts_update on public.posts for update to authenticated
  using (author_id = auth.uid() or public.is_staff()) with check (author_id = auth.uid() or public.is_staff());

create policy comments_read on public.comments for select to authenticated using (
  public.is_staff()
  or (author_id = auth.uid() and status <> 'deleted')
  or (status = 'visible' and public.is_active_member() and not public.has_blocked(author_id)
      and exists (select 1 from public.posts p where p.id = post_id and p.status = 'visible')));
create policy comments_insert on public.comments for insert to authenticated with check (
  author_id = auth.uid() and status = 'visible' and report_count = 0 and public.is_active_member()
  and exists (select 1 from public.posts p where p.id = post_id and p.status = 'visible'));
create policy comments_update on public.comments for update to authenticated
  using (author_id = auth.uid() or public.is_staff()) with check (author_id = auth.uid() or public.is_staff());

create policy reactions_read on public.post_reactions for select to authenticated using (public.is_active_member());
create policy reactions_insert on public.post_reactions for insert to authenticated with check (user_id = auth.uid() and public.is_active_member());
create policy reactions_delete on public.post_reactions for delete to authenticated using (user_id = auth.uid());

create policy reports_insert on public.reports for insert to authenticated with check (
  reporter_id = auth.uid() and status = 'open' and resolved_by is null and public.is_active_member());
create policy reports_read on public.reports for select to authenticated using (reporter_id = auth.uid() or public.is_staff());

create policy blocks_own on public.blocks for all to authenticated using (blocker_id = auth.uid()) with check (blocker_id = auth.uid());

-- 화면용 뷰: 호출한 사람의 권한(RLS)으로 실행한다.
create view public.post_feed with (security_invoker = true) as
  select p.id, p.board_id, p.author_id, p.title, p.body, p.language, p.status, p.created_at, p.updated_at,
    a.nickname as author_nickname, coalesce(a.is_supporter, false) as author_is_supporter, coalesce(a.badges, '{}') as author_badges,
    (select count(*) from public.comments c where c.post_id = p.id and c.status = 'visible')::int as comment_count,
    (select count(*) from public.post_reactions r where r.post_id = p.id)::int as helpful_count,
    exists (select 1 from public.post_reactions r where r.post_id = p.id and r.user_id = auth.uid()) as helped_by_me
  from public.posts p left join public.public_profiles a on a.user_id = p.author_id;

create view public.comment_feed with (security_invoker = true) as
  select c.id, c.post_id, c.author_id, c.body, c.language, c.status, c.created_at,
    a.nickname as author_nickname, coalesce(a.is_supporter, false) as author_is_supporter, coalesce(a.badges, '{}') as author_badges
  from public.comments c left join public.public_profiles a on a.user_id = c.author_id;

grant select on public.post_feed, public.comment_feed to authenticated;
revoke all on public.post_feed, public.comment_feed from anon;
grant execute on function public.is_active_member(), public.can_write_board(text), public.has_blocked(uuid),
  public.moderate_content(text, uuid, text, text), public.resolve_report(uuid, text), public.delete_own_content(text, uuid) to authenticated;
