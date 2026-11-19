-- 가입할 때 고르는 회원 유형과 지원기관 가입 신청.
-- 회원 유형은 본인이 밝힌 것일 뿐 권한을 주지 않는다. 권한은 user_roles, 뱃지는 member_badges가 정한다.
--   general  일반 회원
--   supporter 지원기관 담당자: 운영자가 신청을 승인하면 supporter 역할이 생긴다.
--   refugee  난민 인정을 받은 사람: 지원기관이 대면으로 확인하면 recognized_refugee 뱃지가 생긴다.

alter table public.profiles add column member_type text
  check (member_type is null or member_type in ('general','supporter','refugee'));

create table public.supporter_applications (
  id bigint generated always as identity primary key,
  user_id uuid not null unique references auth.users(id) on delete cascade,
  organization_name text not null check (char_length(btrim(organization_name)) between 2 and 80),
  note text check (note is null or char_length(note) <= 300),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  decided_by uuid references auth.users(id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.supporter_applications enable row level security;
revoke all on public.supporter_applications from anon;
grant select, insert on public.supporter_applications to authenticated;

create policy supporter_apps_select on public.supporter_applications for select
  using (user_id = auth.uid() or public.has_role('admin'));
-- 본인 것만, 대기 상태로만 낼 수 있다. 결과는 review_supporter_application으로만 바뀐다.
create policy supporter_apps_insert on public.supporter_applications for insert
  with check (user_id = auth.uid() and status = 'pending' and decided_by is null and decided_at is null);

-- 거절된 신청은 다시 낼 수 있도록 본인이 지울 수 있다(대기 중이면 취소).
create policy supporter_apps_delete on public.supporter_applications for delete
  using (user_id = auth.uid() and status <> 'approved');
grant delete on public.supporter_applications to authenticated;

-- 관리자용: 지원기관 신청 승인·거절(감사 로그 포함). 승인하면 supporter 역할을 준다.
create or replace function public.review_supporter_application(application bigint, approve boolean)
returns void language plpgsql security definer set search_path = public as $$
declare applicant uuid;
begin
  if not public.has_role('admin') then raise exception 'admin only'; end if;
  update public.supporter_applications
    set status = case when approve then 'approved' else 'rejected' end, decided_by = auth.uid(), decided_at = now()
    where id = application and status = 'pending'
    returning user_id into applicant;
  if applicant is null then raise exception 'no pending application'; end if;
  if approve then
    insert into public.user_roles (user_id, role, granted_by) values (applicant, 'supporter', auth.uid()) on conflict do nothing;
  end if;
  insert into public.audit_logs (actor_id, action, target_type, target_id, detail)
    values (auth.uid(), case when approve then 'supporter.approve' else 'supporter.reject' end, 'user', applicant::text,
            jsonb_build_object('application', application));
end;
$$;
revoke all on function public.review_supporter_application(bigint, boolean) from public, anon;
grant execute on function public.review_supporter_application(bigint, boolean) to authenticated;
