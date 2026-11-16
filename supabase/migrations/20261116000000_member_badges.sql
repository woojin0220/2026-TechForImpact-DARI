-- 회원 뱃지: 지원기관 담당자가 직접 확인한 사실을 표시한다(예: 난민 인정).
-- 서류 사진, 외국인등록번호, 체류자격 번호 등 증빙 자료는 저장하지 않는다.
-- 뱃지는 신원 노출 위험이 있으므로 기본은 숨김이고, 본인이 켜야 다른 회원에게 보인다.

create type public.badge_type as enum ('recognized_refugee');

create table public.member_badges (
  user_id uuid not null references auth.users(id) on delete cascade,
  badge public.badge_type not null,
  verified_by uuid references auth.users(id) on delete set null,
  verified_at timestamptz not null default now(),
  visible boolean not null default false,
  primary key (user_id, badge)
);

-- 대면 인증용 일회성 코드. 회원이 만들고 10분 안에 지원기관 담당자가 입력한다.
create table public.badge_requests (
  code text primary key check (code ~ '^[0-9]{6}$'),
  user_id uuid not null references auth.users(id) on delete cascade,
  badge public.badge_type not null,
  expires_at timestamptz not null,
  attempts int not null default 0
);
create unique index badge_requests_user_badge on public.badge_requests (user_id, badge);

alter table public.member_badges enable row level security;
alter table public.badge_requests enable row level security;
revoke all on public.badge_requests from anon, authenticated;

create policy badges_select on public.member_badges for select using (user_id = auth.uid() or public.is_staff());
-- 쓰기는 아래 함수로만. badge_requests는 정책이 없어 직접 읽기·쓰기 불가.

-- 본인: 인증 코드 발급(이전 코드는 폐기)
create or replace function public.create_badge_request(requested public.badge_type)
returns table (code text, expires_at timestamptz)
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  candidate text;
begin
  if me is null then raise exception 'sign in required'; end if;
  if not exists (select 1 from public.profiles p where p.user_id = me and p.status = 'active') then raise exception 'inactive account'; end if;
  if exists (select 1 from public.member_badges b where b.user_id = me and b.badge = requested) then raise exception 'badge already granted'; end if;
  delete from public.badge_requests r where r.user_id = me and r.badge = requested;
  delete from public.badge_requests r where r.expires_at < now();
  loop
    candidate := lpad((floor(random() * 1000000))::int::text, 6, '0');
    exit when not exists (select 1 from public.badge_requests r where r.code = candidate);
  end loop;
  insert into public.badge_requests (code, user_id, badge, expires_at) values (candidate, me, requested, now() + interval '10 minutes');
  return query select candidate, now() + interval '10 minutes';
end;
$$;

-- 지원기관 담당자·관리자: 코드로 뱃지 부여. 확인용으로 회원 닉네임을 돌려준다.
create or replace function public.grant_badge_by_code(entered text)
returns text
language plpgsql security definer set search_path = public as $$
declare
  request public.badge_requests;
  member_nickname text;
begin
  if not public.has_role('supporter') then raise exception 'supporter only'; end if;
  select * into request from public.badge_requests r where r.code = entered and r.expires_at >= now();
  if not found then raise exception 'invalid or expired code'; end if;
  if request.user_id = auth.uid() then raise exception 'cannot verify yourself'; end if;
  insert into public.member_badges (user_id, badge, verified_by) values (request.user_id, request.badge, auth.uid())
    on conflict (user_id, badge) do nothing;
  delete from public.badge_requests r where r.code = entered;
  insert into public.audit_logs (actor_id, action, target_type, target_id, detail)
    values (auth.uid(), 'badge.grant', 'user', request.user_id::text, jsonb_build_object('badge', request.badge));
  select p.nickname::text into member_nickname from public.profiles p where p.user_id = request.user_id;
  return member_nickname;
end;
$$;

-- 본인: 뱃지 표시 켜기/끄기
create or replace function public.set_badge_visibility(target_badge public.badge_type, show boolean)
returns void language sql security definer set search_path = public as $$
  update public.member_badges set visible = show where user_id = auth.uid() and badge = target_badge;
$$;

-- 본인은 언제든 자기 뱃지를 지울 수 있다. 운영자(모더레이터 이상)는 잘못 부여된 뱃지를 회수한다.
create or replace function public.revoke_badge(target uuid, target_badge public.badge_type, reason text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if target <> auth.uid() and not public.is_staff() then raise exception 'not allowed'; end if;
  delete from public.member_badges where user_id = target and badge = target_badge;
  insert into public.audit_logs (actor_id, action, target_type, target_id, detail)
    values (auth.uid(), 'badge.revoke', 'user', target::text, jsonb_build_object('badge', target_badge, 'reason', reason));
end;
$$;

-- 공개 프로필에 "본인이 켠" 뱃지만 추가
create or replace view public.public_profiles with (security_barrier = true) as
  select p.user_id, p.nickname,
    exists (select 1 from public.user_roles r where r.user_id = p.user_id and r.role = 'supporter') as is_supporter,
    coalesce((select array_agg(b.badge::text order by b.badge) from public.member_badges b where b.user_id = p.user_id and b.visible), '{}') as badges
  from public.profiles p where p.status = 'active' and p.nickname is not null;
grant select on public.public_profiles to anon, authenticated;

grant usage on type public.badge_type to anon, authenticated;
grant execute on function public.create_badge_request(public.badge_type), public.grant_badge_by_code(text),
  public.set_badge_visibility(public.badge_type, boolean), public.revoke_badge(uuid, public.badge_type, text) to authenticated;
