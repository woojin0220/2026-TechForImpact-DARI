import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { MemberBadge } from '../platform/AccountScreens';
import { canVerifyBadges, type Account, type BadgeType } from '../platform/account';
import type { AccountCopy } from '../platform/accountCopy';
import type { CommunityApi } from './api';
import { pageSize } from './api';
import type { CommunityCopy } from './copy';
import { boardIds, detectSensitive, excerpt, isValidBody, isValidTitle, relativeTime, reportReasons, writableBoards, type Author, type BoardFilter, type BoardId, type CommentItem, type PostSummary, type ReportReason } from './model';

type Shared = { copy: CommunityCopy; accountCopy: AccountCopy; api: CommunityApi; account: Account; language: string };

const boardKey = (board: BoardId) => `board_${board}` as const;
function fill(text: string, values: Record<string, string | number>) { return text.replace(/\{(\w+)\}/g, (_, key) => String(values[key] ?? '')); }
function isDuplicate(error: unknown) { return (error as { code?: string } | null)?.code === '23505'; }

function AuthorLine({ item, copy, accountCopy, language }: { item: Author & { created_at: string }; copy: CommunityCopy; accountCopy: AccountCopy; language: string }) {
  return <p className="post-meta">
    <span className="post-author" dir="auto">{item.author_nickname ?? copy.formerMember}</span>
    {item.author_is_supporter && <span className="supporter-mark">{copy.supporterMark}</span>}
    {item.author_badges.map(badge => <MemberBadge key={badge} badge={badge as BadgeType} copy={accountCopy} />)}
    <time dateTime={item.created_at}>{relativeTime(item.created_at, language)}</time>
  </p>;
}

export function CommunityHome({ copy, accountCopy, api, language, board, onBoard, onOpenPost, onWrite, onAccount }: Shared & {
  board: BoardFilter; onBoard: (board: BoardFilter) => void; onOpenPost: (id: string) => void; onWrite: () => void; onAccount: () => void;
}) {
  const [posts, setPosts] = useState<PostSummary[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [hasMore, setHasMore] = useState(false);
  const load = useCallback(async (before?: string) => {
    if (!before) setStatus('loading');
    try {
      const page = await api.listPosts(board, before);
      setPosts(current => before ? [...current, ...page] : page);
      setHasMore(page.length === pageSize);
      setStatus('ready');
    } catch { setStatus('error'); }
  }, [api, board]);
  useEffect(() => { void load(); }, [load]);
  const filters: BoardFilter[] = ['all', ...boardIds];
  return <section className="community">
    <header className="community-header">
      <h1>{copy.title}</h1>
      <button type="button" className="secondary" onClick={onAccount}>{accountCopy.myAccount}</button>
    </header>
    <p className="account-intro">{copy.intro}</p>
    <div className="board-tabs" role="tablist" aria-label={copy.board}>
      {filters.map(item => <button key={item} type="button" role="tab" aria-selected={board === item} onClick={() => onBoard(item)}>{item === 'all' ? copy.boardAll : copy[boardKey(item)]}</button>)}
    </div>
    {status === 'loading' && <p className="account-intro" aria-busy="true">{copy.loading}</p>}
    {status === 'error' && <div className="account-actions"><p className="account-intro">{copy.loadFailed}</p><button type="button" className="secondary" onClick={() => void load()}>{copy.retry}</button></div>}
    {status === 'ready' && !posts.length && <p className="community-empty">{copy.empty}</p>}
    <ul className="post-list">
      {posts.map(post => <li key={post.id}><button type="button" className="post-card" onClick={() => onOpenPost(post.id)}>
        {board === 'all' && <span className="board-label">{copy[boardKey(post.board_id)]}</span>}
        <strong dir="auto">{post.title}</strong>
        <span className="post-excerpt" dir="auto">{excerpt(post.body)}</span>
        <AuthorLine item={post} copy={copy} accountCopy={accountCopy} language={language} />
        <span className="post-counts"><span>{fill(copy.comments, { count: post.comment_count })}</span><span>{copy.helpful} {post.helpful_count}</span></span>
      </button></li>)}
    </ul>
    {status === 'ready' && hasMore && <button type="button" className="secondary" onClick={() => void load(posts.at(-1)?.created_at)}>{copy.loadMore}</button>}
    <button type="button" className="primary write-button" onClick={onWrite}><span aria-hidden="true">+</span>{copy.write}</button>
  </section>;
}

function ReportPanel({ copy, onSend, onCancel }: { copy: CommunityCopy; onSend: (reason: ReportReason, detail: string) => Promise<void>; onCancel: () => void }) {
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [detail, setDetail] = useState('');
  const [pending, setPending] = useState(false);
  return <form className="report-panel" onSubmit={async event => { event.preventDefault(); if (!reason) return; setPending(true); await onSend(reason, detail); setPending(false); }}>
    <fieldset><legend>{copy.reportTitle}</legend>
      {reportReasons.map(item => <label key={item} className="report-reason"><input type="radio" name="reason" checked={reason === item} onChange={() => setReason(item)} /><span>{copy[`reason_${item}`]}</span></label>)}
    </fieldset>
    <label className="account-field">{copy.reportDetail}<textarea rows={2} maxLength={500} dir="auto" value={detail} onChange={event => setDetail(event.target.value)} /></label>
    <div className="account-links"><button className="secondary" disabled={!reason || pending}>{copy.reportSend}</button><button type="button" className="quiet" onClick={onCancel}>{copy.cancel}</button></div>
  </form>;
}

type Target = { type: 'post' | 'comment'; id: string; authorId: string };

export function PostDetail({ copy, accountCopy, api, account, language, postId, onBack }: Shared & { postId: string; onBack: () => void }) {
  const me = account.profile.user_id;
  const [post, setPost] = useState<PostSummary | null | undefined>(undefined);
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [draft, setDraft] = useState('');
  const [reporting, setReporting] = useState<Target | null>(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const load = useCallback(async () => {
    try {
      const [item, list] = await Promise.all([api.getPost(postId), api.listComments(postId)]);
      setPost(item); setComments(list); setError('');
    } catch { setPost(null); setError(copy.loadFailed); }
  }, [api, postId, copy]);
  useEffect(() => { void load(); }, [load]);

  async function act(task: () => Promise<unknown>, done?: string) {
    setPending(true); setError(''); setNotice('');
    try { await task(); if (done) setNotice(done); return true; } catch (problem) { setError(isDuplicate(problem) ? copy.reportAlready : copy.errorGeneric); return false; } finally { setPending(false); }
  }
  async function sendComment(event: FormEvent) {
    event.preventDefault();
    if (!isValidBody(draft, 2000)) return;
    if (detectSensitive(draft).length && !window.confirm(copy.sensitiveWarning)) return;
    if (await act(() => api.createComment(me, postId, draft, language))) { setDraft(''); await load(); }
  }
  async function toggleHelpful() {
    if (!post) return;
    if (await act(() => api.setHelpful(me, post.id, !post.helped_by_me))) await load();
  }
  async function remove(target: Target) {
    if (!window.confirm(copy.deleteConfirm)) return;
    if (await act(() => api.deleteOwn(target.type, target.id))) { if (target.type === 'post') onBack(); else await load(); }
  }
  async function block(authorId: string) {
    if (!window.confirm(copy.blockConfirm)) return;
    if (await act(() => api.block(me, authorId), copy.blockDone)) await load();
  }
  function Actions({ target }: { target: Target }) {
    if (target.authorId === me) return <div className="item-actions"><button type="button" className="quiet" disabled={pending} onClick={() => void remove(target)}>{copy.delete}</button></div>;
    return <div className="item-actions">
      <button type="button" className="quiet" disabled={pending} onClick={() => { setReporting(target); setNotice(''); }}>{copy.report}</button>
      <button type="button" className="quiet" disabled={pending} onClick={() => void block(target.authorId)}>{copy.block}</button>
    </div>;
  }

  return <section className="community">
    <button type="button" className="quiet community-back" onClick={onBack}>{copy.back}</button>
    {post === undefined && <p className="account-intro" aria-busy="true">{copy.loading}</p>}
    {post === null && <p className="account-intro">{error || copy.postNotFound}</p>}
    {post && <>
      <article className="post-detail">
        <span className="board-label">{copy[boardKey(post.board_id)]}</span>
        <h1 dir="auto">{post.title}</h1>
        <AuthorLine item={post} copy={copy} accountCopy={accountCopy} language={language} />
        <p className="post-body" dir="auto">{post.body}</p>
        <div className="post-toolbar">
          <button type="button" className={post.helped_by_me ? 'primary' : 'secondary'} aria-pressed={post.helped_by_me} disabled={pending || post.author_id === me} onClick={() => void toggleHelpful()}>{copy.helpful} {post.helpful_count}</button>
          <Actions target={{ type: 'post', id: post.id, authorId: post.author_id }} />
        </div>
      </article>
      {notice && <p className="account-saved" role="status">{notice}</p>}
      {error && <p className="account-error" role="alert">{error}</p>}
      {reporting && <ReportPanel copy={copy} onCancel={() => setReporting(null)}
        onSend={async (reason, detail) => { if (await act(() => api.report(me, reporting.type, reporting.id, reason, detail), copy.reportDone)) setReporting(null); }} />}
      <section className="comments" aria-labelledby="comments-title">
        <h2 id="comments-title">{copy.commentsTitle} <span>{comments.length}</span></h2>
        {!comments.length && <p className="community-empty">{copy.noComments}</p>}
        <ul>{comments.map(comment => <li key={comment.id} className="comment">
          <AuthorLine item={comment} copy={copy} accountCopy={accountCopy} language={language} />
          <p dir="auto">{comment.body}</p>
          <Actions target={{ type: 'comment', id: comment.id, authorId: comment.author_id }} />
        </li>)}</ul>
        <form className="comment-form" onSubmit={sendComment}>
          <label className="sr-only" htmlFor="comment-input">{copy.commentLabel}</label>
          <textarea id="comment-input" rows={2} maxLength={2000} dir="auto" placeholder={copy.commentLabel} value={draft} onChange={event => setDraft(event.target.value)} />
          <button className="primary" disabled={pending || !draft.trim()}>{copy.commentSend}</button>
        </form>
      </section>
    </>}
  </section>;
}

export function PostComposer({ copy, api, account, language, initialBoard, onDone, onCancel }: Shared & { initialBoard: BoardFilter; onDone: (id: string) => void; onCancel: () => void }) {
  const boards = writableBoards(canVerifyBadges(account.roles));
  const [board, setBoard] = useState<BoardId>(initialBoard !== 'all' && boards.includes(initialBoard) ? initialBoard : boards[0]);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [confirmed, setConfirmed] = useState('');
  const sensitive = detectSensitive(`${title}\n${body}`);
  const needsConfirm = sensitive.length > 0 && confirmed !== `${title}\n${body}`;
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!isValidTitle(title)) { setError(copy.errorTitle); return; }
    if (!isValidBody(body)) { setError(copy.errorBody); return; }
    if (needsConfirm) { setConfirmed(`${title}\n${body}`); return; }
    setPending(true); setError('');
    try { onDone(await api.createPost(account.profile.user_id, { board, title, body, language })); }
    catch { setError(copy.errorGeneric); setPending(false); }
  }
  return <section className="community">
    <button type="button" className="quiet community-back" onClick={onCancel}>{copy.cancel}</button>
    <h1>{copy.composeTitle}</h1>
    <p className="account-intro">{copy.composeNote}</p>
    <form className="compose-form" onSubmit={submit}>
      <fieldset className="board-picker"><legend>{copy.board}</legend>
        {boards.map(item => <label key={item}><input type="radio" name="board" checked={board === item} onChange={() => setBoard(item)} /><span>{copy[boardKey(item)]}</span></label>)}
      </fieldset>
      <label className="account-field">{copy.postTitle}<input maxLength={100} dir="auto" value={title} onChange={event => setTitle(event.target.value)} /></label>
      <label className="account-field">{copy.postBody}<textarea rows={8} maxLength={5000} dir="auto" value={body} onChange={event => setBody(event.target.value)} /></label>
      {sensitive.length > 0 && <p className="account-error" role="alert">{copy.sensitiveWarning}</p>}
      {error && <p className="account-error" role="alert">{error}</p>}
      <button className="primary full" disabled={pending}>{confirmed === `${title}\n${body}` && sensitive.length ? copy.publishAnyway : copy.publish}</button>
    </form>
  </section>;
}
