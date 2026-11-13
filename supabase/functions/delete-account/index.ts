// 회원 탈퇴: 요청한 본인의 auth 계정을 삭제한다. 관련 행은 on delete cascade로 함께 지워진다.
// 배포: supabase functions deploy delete-account
// 필요 비밀값(자동 제공): SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: cors });
  const authorization = request.headers.get('Authorization') ?? '';
  const url = Deno.env.get('SUPABASE_URL')!;
  const asUser = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authorization } } });
  const { data, error } = await asUser.auth.getUser();
  if (error || !data.user) return Response.json({ error: 'unauthorized' }, { status: 401, headers: cors });
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  await admin.from('audit_logs').insert({ actor_id: null, action: 'user.delete', target_type: 'user', target_id: data.user.id });
  const removed = await admin.auth.admin.deleteUser(data.user.id);
  if (removed.error) return Response.json({ error: 'delete_failed' }, { status: 500, headers: cors });
  return Response.json({ deleted: true }, { headers: cors });
});
