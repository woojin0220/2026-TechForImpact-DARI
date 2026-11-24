import { consentDocuments, consentVersions, type Account } from './account.ts';
import type { PlatformApi } from './api';
import type { CommunityApi } from '../community/api';
import { boardIds, isValidBody, isValidTitle, type CommentItem, type PostSummary, type ReportReason } from '../community/model.ts';

/** No Supabase client, session token, credentials or network access in this adapter. */
export const SUPERVISOR_ID = '00000000-0000-4000-8000-000000000001';
export const SUPERVISOR_DATA_KEY = 'dari.dev.supervisor.data.v1';
const MEMBER_ID = '00000000-0000-4000-8000-000000000002';
type Report = { targetType: string; targetId: string; reason: ReportReason; detail: string };
type Snapshot = { version: 1; account: Account; posts: PostSummary[]; comments: CommentItem[]; blocked: string[]; helpful: string[]; reports: Report[]; memberVerified: boolean };
type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem' | 'removeItem'>;
export type DevSupervisorSandbox = {
  account: () => Account;
  platform: PlatformApi;
  community: CommunityApi;
};

function seed(language: string): Snapshot {
  const now = new Date().toISOString();
  const account: Account = {
    email: 'supervisor@example.invalid',
    profile: { user_id: SUPERVISOR_ID, nickname: 'Supervisor', preferred_language: language, age_confirmed_at: now, status: 'active', member_type: 'supporter' },
    roles: ['user', 'supporter', 'moderator', 'admin'],
    consents: consentDocuments.map(document => ({ document, version: consentVersions[document], withdrawn_at: null })),
    badges: [], supporterApplication: { organization_name: 'DARI Local Test', status: 'approved', created_at: now },
  };
  const author = { author_id: MEMBER_ID, author_nickname: '가상 회원', author_is_supporter: false, author_badges: [] };
  const post = (id: string, board_id: PostSummary['board_id'], title: string, body: string): PostSummary => ({
    ...author, id, board_id, title, body, language: 'ko', status: 'visible', created_at: now, comment_count: 0, helpful_count: 0, helped_by_me: false,
  });
  return { version: 1, account, posts: [
    post('sample-question', 'qna', '[샘플] 신청서 작성 경험을 나눠요', '커뮤니티 기능 확인용 가상 게시글입니다. 댓글, 공감, 신고와 차단을 시험할 수 있어요.'),
    post('sample-life', 'life', '[샘플] 생활 정보를 나눠요', '실제 안내가 아닌 테스트용 게시글입니다. 개인정보를 입력하지 말아 주세요.'),
    { ...post('sample-notice', 'notice', '[샘플 공지] Supervisor 테스트 공간', '여기에 작성한 글과 댓글은 이 브라우저 탭의 테스트 데이터에만 저장됩니다.'), author_id: SUPERVISOR_ID, author_nickname: 'Supervisor', author_is_supporter: true },
  ], comments: [{ ...author, id: 'sample-comment', post_id: 'sample-question', body: '이 댓글도 기능 확인을 위한 가상 데이터예요.', language: 'ko', status: 'visible', created_at: now }],
  blocked: [], helpful: [], reports: [], memberVerified: false };
}

export function createDevSupervisor({ development, language, storage, onExit }: { development: boolean; language: string; storage: Storage; onExit: () => void }): DevSupervisorSandbox {
  if (!development) throw new Error('Development supervisor is disabled');
  let state = seed(language);
  try {
    const saved = JSON.parse(storage.getItem(SUPERVISOR_DATA_KEY) ?? 'null') as Snapshot | null;
    if (saved?.version === 1 && saved.account?.profile.user_id === SUPERVISOR_ID && Array.isArray(saved.posts) && Array.isArray(saved.comments) && Array.isArray(saved.blocked) && Array.isArray(saved.helpful) && Array.isArray(saved.reports)) {
      // Persisted test input can never grant a different identity or arbitrary account roles.
      state = { ...saved, account: { ...seed(language).account, profile: { ...seed(language).account.profile, nickname: saved.account.profile.nickname, preferred_language: language }, badges: saved.account.badges ?? [] } };
    }
  } catch { /* Malformed demonstration data cannot affect real application storage. */ }
  const clone = <T,>(value: T): T => structuredClone(value);
  const write = (change: (next: Snapshot) => void) => { const next = clone(state); change(next); storage.setItem(SUPERVISOR_DATA_KEY, JSON.stringify(next)); state = next; };
  const actor = (id: string) => { if (id !== SUPERVISOR_ID) throw new Error('Test account identity mismatch'); };
  const visible = (post: PostSummary) => post.status === 'visible' && !state.blocked.includes(post.author_id);
  const summary = (post: PostSummary): PostSummary => ({ ...clone(post),
    author_nickname: post.author_id === SUPERVISOR_ID ? state.account.profile.nickname : post.author_nickname,
    author_badges: post.author_id === MEMBER_ID && state.memberVerified ? ['recognized_refugee'] : post.author_badges,
    comment_count: state.comments.filter(item => item.post_id === post.id && item.status === 'visible' && !state.blocked.includes(item.author_id)).length,
    helped_by_me: state.helpful.includes(post.id), helpful_count: state.helpful.includes(post.id) ? 1 : 0,
  });
  const community: CommunityApi = {
    async listPosts(board, before) { return state.posts.filter(post => visible(post) && post.board_id === board && (!before || post.created_at < before)).sort((a,b) => b.created_at.localeCompare(a.created_at)).slice(0,20).map(summary); },
    async getPost(id) { const post = state.posts.find(item => item.id === id && visible(item)); return post ? summary(post) : null; },
    async listComments(postId) { return clone(state.comments.filter(item => item.post_id === postId && item.status === 'visible' && !state.blocked.includes(item.author_id))).map(item => ({ ...item, author_nickname: item.author_id === SUPERVISOR_ID ? state.account.profile.nickname : item.author_nickname })); },
    async createPost(authorId, input) {
      actor(authorId); if (!boardIds.includes(input.board) || !isValidTitle(input.title) || !isValidBody(input.body)) throw new Error('Invalid test post');
      const id = crypto.randomUUID();
      write(next => next.posts.unshift({ id, board_id: input.board, author_id: SUPERVISOR_ID, title: input.title.trim(), body: input.body.trim(), language: input.language,
        status: 'visible', created_at: new Date().toISOString(), comment_count: 0, helpful_count: 0, helped_by_me: false, author_nickname: next.account.profile.nickname, author_is_supporter: true, author_badges: [] }));
      return id;
    },
    async createComment(authorId, postId, body, language) {
      actor(authorId); if (!state.posts.some(item => item.id === postId && visible(item)) || !isValidBody(body,2000)) throw new Error('Invalid test comment');
      write(next => next.comments.push({ id: crypto.randomUUID(), post_id: postId, author_id: SUPERVISOR_ID, author_nickname: next.account.profile.nickname,
        author_is_supporter: true, author_badges: [], body: body.trim(), language, status: 'visible', created_at: new Date().toISOString() }));
      return null;
    },
    async setHelpful(userId, postId, on) { actor(userId); if (!state.posts.some(post => post.id === postId && visible(post) && post.author_id !== SUPERVISOR_ID)) throw new Error('Invalid reaction'); write(next => { next.helpful = next.helpful.filter(id => id !== postId); if (on) next.helpful.push(postId); }); return null; },
    async report(reporterId, targetType, targetId, reason, detail) { actor(reporterId); if (state.reports.some(item => item.targetType === targetType && item.targetId === targetId)) throw { code: '23505' }; write(next => next.reports.push({ targetType, targetId, reason, detail: detail.trim() })); return null; },
    async block(blockerId, blockedId) { actor(blockerId); if (blockedId === SUPERVISOR_ID) throw new Error('Cannot block yourself'); write(next => { if (!next.blocked.includes(blockedId)) next.blocked.push(blockedId); }); return null; },
    async deleteOwn(targetType, id) { write(next => { const items = targetType === 'post' ? next.posts : next.comments; const item = items.find(value => value.id === id); if (!item || item.author_id !== SUPERVISOR_ID) throw new Error('Cannot delete another member’s content'); item.status = 'deleted'; }); return null; },
  };
  const platform: PlatformApi = {
    async sendEmailCode() { throw new Error('Exit the test account before signing in'); },
    async verifyEmailCode() { throw new Error('Exit the test account before signing in'); },
    async signOut() { onExit(); return null; },
    async loadAccount(userId) { actor(userId); return clone(state.account); },
    async completeOnboarding() { throw new Error('The test account is already configured'); },
    async applyAsSupporter() { throw new Error('The test account already has a local supporter role'); },
    async updateNickname(userId, nickname) { actor(userId); write(next => { next.account.profile.nickname = nickname.trim(); }); return null; },
    async updateLanguage(userId, language) { actor(userId); write(next => { next.account.profile.preferred_language = language; }); return null; },
    async requestBadgeCode() { return { code: '654321', expires_at: new Date(Date.now()+600000).toISOString() }; },
    async grantBadge(code) { if (code.trim() === '654321') throw new Error('cannot verify yourself'); if (code.trim() !== '123456') throw new Error('invalid or expired code'); write(next => { next.memberVerified = true; }); return '가상 회원'; },
    async setBadgeVisibility(badge, show) { write(next => { const held = next.account.badges.find(item => item.badge === badge); if (!held) throw new Error('No test badge'); held.visible = show; }); return null; },
    async removeBadge(userId, badge) { actor(userId); write(next => { next.account.badges = next.account.badges.filter(item => item.badge !== badge); }); return null; },
    async deleteAccount() { storage.removeItem(SUPERVISOR_DATA_KEY); onExit(); },
  };
  return { account: () => clone(state.account), platform, community };
}
