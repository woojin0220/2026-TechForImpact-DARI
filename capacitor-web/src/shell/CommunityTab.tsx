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
import {usePersonal} from '../community/usePersonal';
import {experienceCopy} from '../community/experienceCopy';
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
  const { api: platformApi, communityOverride } = useAuth();
  const api = useMemo(() => { if (communityOverride) return communityOverride; const client = platformClient(); return client ? communityApi(client) : null; }, [communityOverride]);
  const [view, setView] = useState<View>({ kind: 'list' });
  const [board, setBoard] = useState<BoardId>('qna');
  const [discovery, setDiscovery] = useState({search:'',unanswered:false});
  const [savedOnly,setSavedOnly]=useState(false);
  const personal=usePersonal(account.profile.user_id);
  const ec=experienceCopy(language);
  const [translator, setTranslator] = useState<Translator | null>(null);
  useEffect(() => { if (communityOverride) { setTranslator(null); return; } let live = true; void deviceTranslator().then(found => { if (live) setTranslator(found); }); return () => { live = false; }; }, [communityOverride]);
  const copy = communityCopyFor(language);
  const accountCopy = accountCopyFor(language);
  if (!api || !platformApi) return null;
  const shared = { copy, accountCopy, api, account, language, translator };
  function go(next: View) { setView(next); window.scrollTo(0, 0); }
  const warning=personal.savedError?<p className="account-error" role="alert">{ec.savedError}</p>:null;
  if (view.kind === 'post') return <>{warning}<PostDetail {...shared} postId={view.id} saved={personal.saved.includes(view.id)} onToggleSaved={()=>personal.toggleSaved(view.id)} onBack={() => go({ kind: 'list' })} /></>;
  if (view.kind === 'write') return <PostComposer {...shared} initialBoard={board} draft={personal.draft} draftError={personal.draftError} onDraft={personal.updateDraft} onCancel={() => go({ kind: 'list' })} onDone={(id,posted) => {personal.clearDraft(posted);go({ kind: 'post', id });}} />;
  return <>{warning}{personal.draftError&&<p className="account-error" role="alert">{ec.draftError}</p>}<CommunityHome key={savedOnly?'saved':'feed'} {...shared} board={board} onBoard={setBoard} onOpenPost={id => go({ kind: 'post', id })} onWrite={() => go({ kind: 'write' })} onAccount={onOpenProfile} initialDiscovery={discovery} onDiscoveryChange={setDiscovery} savedOnly={savedOnly} savedIds={personal.saved} onSavedOnly={value=>{setSavedOnly(value);setDiscovery({search:'',unanswered:false});}} draft={personal.draft} onDiscardDraft={()=>{if(window.confirm(ec.discardConfirm))personal.clearDraft();}} /></>;
}
