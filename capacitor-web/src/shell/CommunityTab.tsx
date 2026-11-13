import { useState } from 'react';
import { AccountScreen, AuthGate } from '../platform/AccountScreens';
import { useAuth } from '../platform/AuthContext';
import { accountCopyFor } from '../platform/accountCopy';
import type { Account } from '../platform/account';
import type { TabsCopy } from './tabsCopy';
import '../platform/account.css';

/** Community requires a signed-in, onboarded member. Its board screens will replace the placeholder. */
export function CommunityTab({ copy, language }: { copy: TabsCopy; language: string }) {
  const accountCopy = accountCopyFor(language);
  return <main className="account-main" tabIndex={-1}>
    <AuthGate copy={accountCopy} language={language}>{account => <CommunityHome key={account.profile.user_id} account={account} copy={copy} language={language} />}</AuthGate>
  </main>;
}

function CommunityHome({ account, copy, language }: { account: Account; copy: TabsCopy; language: string }) {
  const { api, refresh } = useAuth();
  const accountCopy = accountCopyFor(language);
  const [accountOpen, setAccountOpen] = useState(false);
  if (accountOpen && api) return <AccountScreen copy={accountCopy} account={account} api={api} onBack={() => setAccountOpen(false)} onChanged={() => void refresh()} />;
  return <section className="account-screen">
    <button type="button" className="secondary tab-account-button" onClick={() => setAccountOpen(true)}>{accountCopy.myAccount}</button>
    <h1>{copy.communityTitle}</h1>
    <p className="account-intro">{copy.comingSoon}</p>
  </section>;
}
