import { useMemo, useState } from 'react';
import { AccountScreen, AuthGate } from '../platform/AccountScreens';
import { useAuth } from '../platform/AuthContext';
import { accountCopyFor } from '../platform/accountCopy';
import { platformClient } from '../platform/client';
import type { Account } from '../platform/account';
import { communityApi } from '../community/api';
import { communityCopyFor } from '../community/copy';
import { CommunityHome, PostComposer, PostDetail } from '../community/CommunityScreens';
import type { BoardId } from '../community/model';
import type { TabsCopy } from './tabsCopy';
import '../platform/account.css';
import '../community/community.css';

/** Community requires a signed-in, onboarded member. */
export function CommunityTab({ language }: { copy: TabsCopy; language: string }) {
  const accountCopy = accountCopyFor(language);
  return <main className="account-main" tabIndex={-1}>
    <AuthGate copy={accountCopy} language={language}>{account => <CommunityRoutes key={account.profile.user_id} account={account} language={language} />}</AuthGate>
  </main>;
}

type View = { kind: 'list' } | { kind: 'post'; id: string } | { kind: 'write' } | { kind: 'account' };

function CommunityRoutes({ account, language }: { account: Account; language: string }) {
  const { api: platformApi, refresh } = useAuth();
  const api = useMemo(() => { const client = platformClient(); return client ? communityApi(client) : null; }, []);
  const [view, setView] = useState<View>({ kind: 'list' });
  const [board, setBoard] = useState<BoardId>('qna');
  const copy = communityCopyFor(language);
  const accountCopy = accountCopyFor(language);
  if (!api || !platformApi) return null;
  const shared = { copy, accountCopy, api, account, language };
  function go(next: View) { setView(next); window.scrollTo(0, 0); }
  if (view.kind === 'account') return <AccountScreen copy={accountCopy} account={account} api={platformApi} language={language} onBack={() => go({ kind: 'list' })} onChanged={() => void refresh()} />;
  if (view.kind === 'post') return <PostDetail {...shared} postId={view.id} onBack={() => go({ kind: 'list' })} />;
  if (view.kind === 'write') return <PostComposer {...shared} initialBoard={board} onCancel={() => go({ kind: 'list' })} onDone={id => go({ kind: 'post', id })} />;
  return <CommunityHome {...shared} board={board} onBoard={setBoard} onOpenPost={id => go({ kind: 'post', id })} onWrite={() => go({ kind: 'write' })} onAccount={() => go({ kind: 'account' })} />;
}
