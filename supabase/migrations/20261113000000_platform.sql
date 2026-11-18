-- DARI 통합 운영 기반: 프로필, 역할, 지원기관, 동의, 기기, 알림 설정, 감사 로그.
-- 신청서 원문·초안·메타데이터는 이 DB에 저장하지 않는다(기기에만 보관).

create extension if not exists citext;

-- 역할 ------------------------------------------------------------------
create type public.app_role as enum ('user', 'supporter', 'moderator', 'admin');

-- 프로필: 실명·국적·체류자격은 받지 않는다. 화면에는 닉네임만 보인다.
create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  nickname citext unique check (nickname is null or char_length(nickname::text) between 2 and 20),
  preferred_language text not null default 'ko' check (preferred_language in ('ko','en','fr','ru','ar','fa')),
  age_confirmed_at timestamptz,
  status text not null default 'active' check (status in ('active','suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  granted_by uuid references auth.users(id) on delete set null,
  granted_at timestamptz not null default now(),
  primary key (user_id, role)
);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 80),
  email_domain citext,
  approved_at timestamptz,
  approved_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.org_members (
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  approved_at timestamptz,
  primary key (org_id, user_id)
);

-- 약관·처리방침 동의 이력(버전별). 철회해도 기록은 남긴다.
create table public.consents (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  document text not null check (document in ('terms','privacy','community')),
  version text not null,
  agreed_at timestamptz not null default now(),
  withdrawn_at timestamptz
);
create index consents_user_idx on public.consents (user_id, document);

create table public.devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null check (platform in ('ios','android','web')),
  push_token text not null unique,
  last_seen_at timestamptz not null default now()
);

create table public.notification_prefs (
  user_id uuid primary key references auth.users(id) on delete cascade,
  community_replies boolean not null default true,
  announcements boolean not null default true,
  schedule_reminders boolean not null default true
);

-- 감사 로그: 역할 변경·정지·기관 승인 등. 내용 본문은 남기지 않는다.
create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  target_type text not null,
  target_id text not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- 권한 확인 함수 ------------------------------------------------------------
create or replace function public.has_role(check_role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.user_roles r
    join public.profiles p on p.user_id = r.user_id
    where r.user_id = auth.uid() and p.status = 'active'
      and (r.role = check_role or r.role = 'admin')
  );
$$;

create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_role('moderator');
$$;

-- 가입 시 프로필·기본 역할·알림 설정 생성
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (user_id) values (new.id) on conflict do nothing;
  insert into public.user_roles (user_id, role) values (new.id, 'user') on conflict do nothing;
  insert into public.notification_prefs (user_id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- 본인이 바꿀 수 없는 프로필 칸(status) 보호
create or replace function public.guard_profile_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status and not public.is_staff() then
    raise exception 'status can only be changed by staff';
  end if;
  if new.user_id is distinct from old.user_id then
    raise exception 'user_id is immutable';
  end if;
  return new;
end;
$$;
create trigger profiles_guard before update on public.profiles
  for each row execute function public.guard_profile_update();

-- 관리자용: 역할 부여·회수(감사 로그 포함)
create or replace function public.set_user_role(target uuid, target_role public.app_role, enabled boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role('admin') then raise exception 'admin only'; end if;
  if enabled then
    insert into public.user_roles (user_id, role, granted_by) values (target, target_role, auth.uid()) on conflict do nothing;
  else
    delete from public.user_roles where user_id = target and role = target_role;
  end if;
  insert into public.audit_logs (actor_id, action, target_type, target_id, detail)
    values (auth.uid(), case when enabled then 'role.grant' else 'role.revoke' end, 'user', target::text, jsonb_build_object('role', target_role));
end;
$$;

-- 모더레이터용: 사용자 정지·해제
create or replace function public.set_user_status(target uuid, new_status text, reason text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'staff only'; end if;
  if new_status not in ('active','suspended') then raise exception 'invalid status'; end if;
  update public.profiles set status = new_status where user_id = target;
  insert into public.audit_logs (actor_id, action, target_type, target_id, detail)
    values (auth.uid(), 'user.status', 'user', target::text, jsonb_build_object('status', new_status, 'reason', reason));
end;
$$;

-- 행 단위 권한(RLS) --------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.organizations enable row level security;
alter table public.org_members enable row level security;
alter table public.consents enable row level security;
alter table public.devices enable row level security;
alter table public.notification_prefs enable row level security;
alter table public.audit_logs enable row level security;

-- 프로필: 본인 행은 읽기·수정, 운영자는 전체 읽기. 다른 사용자는 공개 뷰(public_profiles)로만 닉네임을 본다.
create policy profiles_self_select on public.profiles for select using (user_id = auth.uid() or public.is_staff());
create policy profiles_self_update on public.profiles for update using (user_id = auth.uid() or public.is_staff()) with check (user_id = auth.uid() or public.is_staff());

create view public.public_profiles with (security_barrier = true) as
  select user_id, nickname,
    exists (select 1 from public.user_roles r where r.user_id = p.user_id and r.role = 'supporter') as is_supporter
  from public.profiles p where status = 'active' and nickname is not null;
grant select on public.public_profiles to anon, authenticated;

create policy roles_select on public.user_roles for select using (user_id = auth.uid() or public.is_staff());
-- 역할 쓰기는 set_user_role() 함수로만.

create policy orgs_select on public.organizations for select using (approved_at is not null or public.has_role('admin'));
create policy orgs_admin_write on public.organizations for all using (public.has_role('admin')) with check (public.has_role('admin'));

create policy org_members_select on public.org_members for select using (user_id = auth.uid() or public.has_role('admin'));
create policy org_members_admin_write on public.org_members for all using (public.has_role('admin')) with check (public.has_role('admin'));

create policy consents_self_select on public.consents for select using (user_id = auth.uid());
create policy consents_self_insert on public.consents for insert with check (user_id = auth.uid());
create policy consents_self_withdraw on public.consents for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy devices_self on public.devices for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy prefs_self on public.notification_prefs for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy audit_admin_select on public.audit_logs for select using (public.has_role('admin'));
-- 감사 로그 쓰기는 security definer 함수로만.

grant usage on type public.app_role to anon, authenticated;
grant execute on function public.has_role(public.app_role), public.is_staff(), public.set_user_role(uuid, public.app_role, boolean), public.set_user_status(uuid, text, text) to authenticated;
