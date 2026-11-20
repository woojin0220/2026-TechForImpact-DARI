import { useEffect, useMemo, useState } from 'react';
import { AuthGate } from '../platform/AccountScreens';
import { useAuth } from '../platform/AuthContext';
import { accountCopyFor } from '../platform/accountCopy';
import { platformClient } from '../platform/client';
import type { Account } from '../platform/account';
import { communityApi } from '../community/api';
import { communityCopyFor } from '../community/copy';
import { CommunityHome, PostComposer, PostDetail } from '../community/CommunityScreens';
import type { BoardId } from '../community/model';
import type { Translator } from '../community/translation';
import { deviceTranslator } from '../community/translationEngine';
import type { TabsCopy } from './tabsCopy';
import '../platform/account.css';
import '../community/community.css';

/** Community requires a signed-in, onboarded member. */
export function CommunityTab({ language, onOpenProfile }: { copy: TabsCopy; language: string; onOpenProfile: () => void }) {
  const accountCopy = accountCopyFor(language);
  return <main className="account-main" tabIndex={-1}>
    <AuthGate copy={accountCopy} language={language}>{account => <CommunityRoutes key={account.profile.user_id} account={account} language={language} onOpenProfile={onOpenProfile} />}</AuthGate>
  </main>;
}

type View = { kind: 'list' } | { kind: 'post'; id: string } | { kind: 'write' };

function CommunityRoutes({ account, language, onOpenProfile }: { account: Account; language: string; onOpenProfile: () => void }) {
  const { api: platformApi } = useAuth();
  const api = useMemo(() => { const client = platformClient(); return client ? communityApi(client) : null; }, []);
  const [view, setView] = useState<View>({ kind: 'list' });
  const [board, setBoard] = useState<BoardId>('qna');
  const [translator, setTranslator] = useState<Translator | null>(null);
  useEffect(() => { let live = true; void deviceTranslator().then(found => { if (live) setTranslator(found); }); return () => { live = false; }; }, []);
  const copy = communityCopyFor(language);
  const accountCopy = accountCopyFor(language);
  if (!api || !platformApi) return null;
  const shared = { copy, accountCopy, api, account, language, translator };
  function go(next: View) { setView(next); window.scrollTo(0, 0); }
  if (view.kind === 'post') return <PostDetail {...shared} postId={view.id} onBack={() => go({ kind: 'list' })} />;
  if (view.kind === 'write') return <PostComposer {...shared} initialBoard={board} onCancel={() => go({ kind: 'list' })} onDone={id => go({ kind: 'post', id })} />;
  return <CommunityHome {...shared} board={board} onBoard={setBoard} onOpenPost={id => go({ kind: 'post', id })} onWrite={() => go({ kind: 'write' })} onAccount={onOpenProfile} />;
}
