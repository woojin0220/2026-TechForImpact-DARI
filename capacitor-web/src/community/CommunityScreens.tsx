import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { MemberBadge } from '../platform/AccountScreens';
import { canVerifyBadges, type Account, type BadgeType } from '../platform/account';
import type { AccountCopy } from '../platform/accountCopy';
import type { CommunityApi } from './api';
import { pageSize } from './api';
import type { CommunityCopy } from './copy';
import { languageName, needsTranslation, type Translator } from './translation';
import { boardIds, detectSensitive, excerpt, isValidBody, isValidTitle, relativeTime, reportReasons, writableBoards, type Author, type BoardId, type CommentItem, type PostSummary, type ReportReason } from './model';

type Shared = { copy: CommunityCopy; accountCopy: AccountCopy; api: CommunityApi; account: Account; language: string; translator?: Translator | null };

type Translated = { text: string; state: 'original' | 'translating' | 'translated' | 'failed' };

/** Translates `text` from `source` into the reader's language when a device translator is available. */
function useTranslated(translator: Translator | null | undefined, text: string, source: string, target: string): Translated {
  const wanted = Boolean(translator) && needsTranslation(source, target) && Boolean(text.trim());
  const [result, setResult] = useState<Translated>({ text, state: wanted ? 'translating' : 'original' });
  useEffect(() => {
    if (!wanted || !translator) { setResult({ text, state: 'original' }); return; }
    let live = true;
    setResult({ text, state: 'translating' });
    translator.translate(text, source, target).then(
      translated => { if (live) setResult({ text: translated, state: 'translated' }); },
      () => { if (live) setResult({ text, state: 'failed' }); });
    return () => { live = false; };
  }, [translator, wanted, text, source, target]);
  return result;
}

const boardKey = (board: BoardId) => `board_${board}` as const;
function fill(text: string, values: Record<string, string | number>) { return text.replace(/\{(\w+)\}/g, (_, key) => String(values[key] ?? '')); }
function isDuplicate(error: unknown) { return (error as { code?: string } | null)?.code === '23505'; }

const iconProps = { viewBox: '0 0 24 24', 'aria-hidden': true, focusable: false } as const;
const Icon = {
  back: () => <svg {...iconProps}><path d="M15 5l-7 7 7 7" /></svg>,
  close: () => <svg {...iconProps}><path d="M6 6l12 12M18 6L6 18" /></svg>,
  shield: () => <svg {...iconProps}><path d="M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6z" /><path d="M9 12l2 2 4-4" /></svg>,
  comment: () => <svg {...iconProps}><path d="M20 12a8 8 0 0 1-11.6 7.1L4 20l1-4.1A8 8 0 1 1 20 12z" /></svg>,
  heart: () => <svg {...iconProps}><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" /></svg>,
  pencil: () => <svg {...iconProps}><path d="M4 20h4L19 9l-4-4L4 16z" /><path d="M13.5 6.5l4 4" /></svg>,
  send: () => <svg {...iconProps}><path d="M5 12h13M13 6l6 6-6 6" /></svg>,
  globe: () => <svg {...iconProps}><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z" /></svg>,
};

function Avatar({ name, supporter, size }: { name: string | null; supporter?: boolean; size?: 'small' }) {
  const initial = name ? Array.from(name.trim())[0]?.toUpperCase() : '';
  return <span className={`avatar${supporter ? ' supporter' : ''}${size ? ` ${size}` : ''}`} aria-hidden="true">{initial}</span>;
}

function AuthorLine({ item, copy, accountCopy, language }: { item: Author & { created_at: string }; copy: CommunityCopy; accountCopy: AccountCopy; language: string }) {
  return <p className="post-meta">
    <span className="post-author" dir="auto">{item.author_nickname ?? copy.formerMember}</span>
    {item.author_is_supporter && <span className="supporter-mark">{copy.supporterMark}</span>}
    {item.author_badges.map(badge => <MemberBadge key={badge} badge={badge as BadgeType} copy={accountCopy} />)}
    <time dateTime={item.created_at}>{relativeTime(item.created_at, language)}</time>
  </p>;
}

function Stats({ copy, comments, helpful, helped }: { copy: CommunityCopy; comments: number; helpful: number; helped?: boolean }) {
  return <span className="post-stats">
    <span><Icon.comment /><span className="sr-only">{copy.commentsTitle}</span>{comments}</span>
    <span className={helped ? 'on' : undefined}><Icon.heart /><span className="sr-only">{copy.helpful}</span>{helpful}</span>
  </span>;
}

function PostCardText({ post, translator, language }: { post: PostSummary; translator?: Translator | null; language: string }) {
  const fast = translator?.fast ? translator : null;
  const title = useTranslated(fast, post.title, post.language, language);
  const body = useTranslated(fast, excerpt(post.body, 160), post.language, language);
  return <>
    <strong className="post-title" dir="auto">{title.state === 'translated' && <Icon.globe />}{title.text}</strong>
    <span className="post-excerpt" dir="auto">{body.text}</span>
  </>;
}

export function CommunityHome({ copy, accountCopy, api, account, language, translator, board, onBoard, onOpenPost, onWrite, onAccount }: Shared & {
  board: BoardId; onBoard: (board: BoardId) => void; onOpenPost: (id: string) => void; onWrite: () => void; onAccount: () => void;
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
  return <section className="community community-home">
    <header className="community-topbar">
      <h1>{copy.title}</h1>
      <button type="button" className="avatar-button" aria-label={accountCopy.myAccount} onClick={onAccount}><Avatar name={account.profile.nickname} /></button>
    </header>
    <div className="board-tabs" role="tablist" aria-label={copy.board}>
      {boardIds.map(item => <button key={item} type="button" role="tab" aria-selected={board === item} onClick={() => onBoard(item)}>{copy[boardKey(item)]}</button>)}
    </div>
    <p className="safety-note"><Icon.shield /><span>{copy.intro}</span></p>
    {status === 'loading' && <ul className="post-list" aria-busy="true" aria-label={copy.loading}>{[0, 1, 2].map(key => <li key={key} className="post-skeleton" />)}</ul>}
    {status === 'error' && <div className="community-state"><p>{copy.loadFailed}</p><button type="button" className="secondary" onClick={() => void load()}>{copy.retry}</button></div>}
    {status === 'ready' && !posts.length && <div className="community-state"><Icon.comment /><p>{copy.empty}</p></div>}
    {status === 'ready' && posts.length > 0 && <ul className="post-list">
      {posts.map(post => <li key={post.id}><button type="button" className={`post-card${post.board_id === 'notice' ? ' notice' : ''}`} onClick={() => onOpenPost(post.id)}>
        <PostCardText post={post} translator={translator} language={language} />
        <span className="post-foot">
          <span className="post-byline"><Avatar name={post.author_nickname} supporter={post.author_is_supporter} size="small" /><AuthorLine item={post} copy={copy} accountCopy={accountCopy} language={language} /></span>
          <Stats copy={copy} comments={post.comment_count} helpful={post.helpful_count} helped={post.helped_by_me} />
        </span>
      </button></li>)}
    </ul>}
    {status === 'ready' && hasMore && <button type="button" className="secondary load-more" onClick={() => void load(posts.at(-1)?.created_at)}>{copy.loadMore}</button>}
    {writableBoards(canVerifyBadges(account.roles)).includes(board) && <button type="button" className="write-button" onClick={onWrite}><Icon.pencil /><span>{copy.write}</span></button>}
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
    <div className="report-actions"><button type="button" className="secondary" onClick={onCancel}>{copy.cancel}</button><button className="primary solid" disabled={!reason || pending}>{copy.reportSend}</button></div>
  </form>;
}

type Target = { type: 'post' | 'comment'; id: string; authorId: string };

function TranslationBar({ copy, language, source, states, original, onToggle }: { copy: CommunityCopy; language: string; source: string; states: Translated['state'][]; original: boolean; onToggle: () => void }) {
  if (states.every(state => state === 'original')) return null;
  const failed = states.some(state => state === 'failed');
  const busy = states.some(state => state === 'translating');
  return <p className="translation-bar" role="status">
    <Icon.globe />
    <span>{failed ? copy.translateFailed : busy ? copy.translating : fill(copy.translatedFrom, { language: languageName(source, language) })}</span>
    {!failed && !busy && <button type="button" className="quiet" aria-pressed={original} onClick={onToggle}>{original ? copy.showTranslation : copy.showOriginal}</button>}
  </p>;
}

function CommentText({ comment, copy, translator, language }: { comment: CommentItem; copy: CommunityCopy; translator?: Translator | null; language: string }) {
  const result = useTranslated(translator, comment.body, comment.language, language);
  const [original, setOriginal] = useState(false);
  return <>
    <p dir="auto">{original ? comment.body : result.text}</p>
    {result.state === 'translating' && <small className="translation-note">{copy.translating}</small>}
    {result.state === 'translated' && <small className="translation-note"><Icon.globe />{copy.translatedMark}<button type="button" className="quiet" aria-pressed={original} onClick={() => setOriginal(value => !value)}>{original ? copy.showTranslation : copy.showOriginal}</button></small>}
  </>;
}

export function PostDetail({ copy, accountCopy, api, account, language, translator, postId, onBack }: Shared & { postId: string; onBack: () => void }) {
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

  const [original, setOriginal] = useState(false);
  const title = useTranslated(translator, post?.title ?? '', post?.language ?? language, language);
  const body = useTranslated(translator, post?.body ?? '', post?.language ?? language, language);

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

  return <section className="community community-detail">
    <header className="detail-bar">
      <button type="button" className="icon-button community-back" aria-label={copy.back} onClick={onBack}><Icon.back /></button>
      {post && <span className="detail-board">{copy[boardKey(post.board_id)]}</span>}
    </header>
    {post === undefined && <div className="post-skeleton tall" aria-busy="true" aria-label={copy.loading} />}
    {post === null && <div className="community-state"><p>{error || copy.postNotFound}</p></div>}
    {post && <>
      <article className="post-detail">
        <h1 dir="auto">{original ? post.title : title.text}</h1>
        <div className="post-byline large"><Avatar name={post.author_nickname} supporter={post.author_is_supporter} /><AuthorLine item={post} copy={copy} accountCopy={accountCopy} language={language} /></div>
        <TranslationBar copy={copy} language={language} source={post.language} states={[title.state, body.state]} original={original} onToggle={() => setOriginal(value => !value)} />
        <p className="post-body" dir="auto">{original ? post.body : body.text}</p>
        <div className="post-toolbar">
          <button type="button" className="helpful-button" aria-pressed={post.helped_by_me} disabled={pending || post.author_id === me} onClick={() => void toggleHelpful()}><Icon.heart /><span>{copy.helpful}</span><b>{post.helpful_count}</b></button>
          <Actions target={{ type: 'post', id: post.id, authorId: post.author_id }} />
        </div>
      </article>
      {notice && <p className="community-toast" role="status">{notice}</p>}
      {error && <p className="account-error" role="alert">{error}</p>}
      {reporting && <ReportPanel copy={copy} onCancel={() => setReporting(null)}
        onSend={async (reason, detail) => { if (await act(() => api.report(me, reporting.type, reporting.id, reason, detail), copy.reportDone)) setReporting(null); }} />}
      <section className="comments" aria-labelledby="comments-title">
        <h2 id="comments-title">{copy.commentsTitle} <span>{comments.length}</span></h2>
        {!comments.length && <p className="community-empty">{copy.noComments}</p>}
        <ul>{comments.map(comment => <li key={comment.id} className={`comment${comment.author_id === me ? ' mine' : ''}`}>
          <Avatar name={comment.author_nickname} supporter={comment.author_is_supporter} size="small" />
          <div className="comment-body">
            <AuthorLine item={comment} copy={copy} accountCopy={accountCopy} language={language} />
            <CommentText comment={comment} copy={copy} translator={translator} language={language} />
            <Actions target={{ type: 'comment', id: comment.id, authorId: comment.author_id }} />
          </div>
        </li>)}</ul>
      </section>
      <form className="comment-form" onSubmit={sendComment}>
        <label className="sr-only" htmlFor="comment-input">{copy.commentLabel}</label>
        <textarea id="comment-input" rows={1} maxLength={2000} dir="auto" placeholder={copy.commentLabel} value={draft} onChange={event => setDraft(event.target.value)} />
        <button className="send-button" aria-label={copy.commentSend} disabled={pending || !draft.trim()}><Icon.send /></button>
      </form>
    </>}
  </section>;
}

export function PostComposer({ copy, api, account, language, initialBoard, onDone, onCancel }: Shared & { initialBoard: BoardId; onDone: (id: string) => void; onCancel: () => void }) {
  const boards = writableBoards(canVerifyBadges(account.roles));
  const [board, setBoard] = useState<BoardId>(boards.includes(initialBoard) ? initialBoard : boards[0]);
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
  const ready = isValidTitle(title) && isValidBody(body);
  return <section className="community community-compose">
    <header className="detail-bar">
      <button type="button" className="icon-button community-back" aria-label={copy.cancel} onClick={onCancel}><Icon.close /></button>
      <h1>{copy.composeTitle}</h1>
      <button form="compose-form" className={`publish-button${ready ? ' ready' : ''}`} disabled={pending}>{confirmed === `${title}\n${body}` && sensitive.length ? copy.publishAnyway : copy.publish}</button>
    </header>
    <form id="compose-form" className="compose-form" onSubmit={submit}>
      <fieldset className="board-picker"><legend>{copy.board}</legend>
        {boards.map(item => <label key={item}><input type="radio" name="board" checked={board === item} onChange={() => setBoard(item)} /><span>{copy[boardKey(item)]}</span></label>)}
      </fieldset>
      <label className="compose-field"><span className="sr-only">{copy.postTitle}</span><input className="compose-title" maxLength={100} dir="auto" placeholder={copy.postTitle} value={title} onChange={event => setTitle(event.target.value)} /></label>
      <label className="compose-field"><span className="sr-only">{copy.postBody}</span><textarea className="compose-body" rows={10} maxLength={5000} dir="auto" placeholder={copy.postBody} value={body} onChange={event => setBody(event.target.value)} /></label>
      {sensitive.length > 0 && <p className="compose-warning" role="alert">{copy.sensitiveWarning}</p>}
      {error && <p className="account-error" role="alert">{error}</p>}
      <p className="safety-note"><Icon.shield /><span>{copy.composeNote}</span></p>
    </form>
  </section>;
}
