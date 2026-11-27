import { localTestEntryEnabled } from './feedbackBuild';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { platformClient } from './client';
import { platformApi, type PlatformApi } from './api';
import type { Account } from './account';
import type { CommunityApi } from '../community/api';
import type { DevSupervisorSandbox } from './devSupervisor';

export type AuthState =
  | { status: 'unconfigured' }
  | { status: 'loading' }
  | { status: 'signedOut' }
  | { status: 'error'; session: Session }
  | { status: 'development'; account: Account }
  | { status: 'signedIn'; session: Session; account: Account };

type AuthValue = { state: AuthState; api: PlatformApi | null; refresh: () => Promise<void>;
  entryRevision?: number;
  enterSupervisor?: (language: string) => Promise<void>; exitSupervisor?: () => void; communityOverride?: CommunityApi };
const AuthContext = createContext<AuthValue>({ state: { status: 'unconfigured' }, api: null, refresh: async () => {} });
const TEST_ACCOUNT_KEY = 'dari.dev.supervisor.active.v1';

/** Keeps the signed-in member and their profile, roles and consents in one place for every tab. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const client = useMemo(() => platformClient(), []);
  const api = useMemo(() => client ? platformApi(client) : null, [client]);
  const [session, setSession] = useState<Session | null | undefined>(client ? undefined : null);
  const [state, setState] = useState<AuthState>(client ? { status: 'loading' } : { status: 'unconfigured' });
  const [sandbox, setSandbox] = useState<DevSupervisorSandbox | null>(null);
  const [testAccount, setTestAccount] = useState<Account | null>(null);
  const [entryRevision,setEntryRevision]=useState(0);
  const sessionOwner=useRef<string|null|undefined>(undefined);
  const exitSupervisor = useCallback(() => {
    try { sessionStorage.removeItem(TEST_ACCOUNT_KEY); } catch { /* Memory-only exit still works. */ }
    setSandbox(null); setTestAccount(null);
  }, []);
  const enterSupervisor = useCallback(async (language: string, restoring=false) => {
    if (!localTestEntryEnabled || !['signedOut', 'unconfigured'].includes(state.status)) return;
    // This local adapter is enabled only for development/feedback; it never manufactures a Supabase session.
    const { createDevSupervisor } = await import('./devSupervisor');
    const next = createDevSupervisor({ development: localTestEntryEnabled, language, storage: sessionStorage, onExit: exitSupervisor });
    sessionStorage.setItem(TEST_ACCOUNT_KEY, language);
    if(!restoring)setEntryRevision(previous=>previous+1);
    setTestAccount(next.account()); setSandbox(next);
  }, [state.status, exitSupervisor]);
  useEffect(() => {
    if (!localTestEntryEnabled || sandbox || !['signedOut', 'unconfigured'].includes(state.status)) return;
    let language: string | null = null;
    try { language = sessionStorage.getItem(TEST_ACCOUNT_KEY); } catch { return; }
    if (language) void enterSupervisor(language,true).catch(exitSupervisor);
  }, [state.status, sandbox, enterSupervisor, exitSupervisor]);

  useEffect(() => {
    if (!client) return;
    let active = true;
    client.auth.getSession().then(({ data }) => { if (active) {if(sessionOwner.current===undefined)sessionOwner.current=data.session?.user.id??null;setSession(data.session);} });
    const { data } = client.auth.onAuthStateChange((event, next) => { if (active) {if(event==='SIGNED_IN'&&sessionOwner.current===null&&next)setEntryRevision(previous=>previous+1);sessionOwner.current=next?.user.id??null;setSession(next);} });
    return () => { active = false; data.subscription.unsubscribe(); };
  }, [client]);

  const load = useCallback(async (current: Session | null | undefined) => {
    if (!api) return;
    if (current === undefined) { setState({ status: 'loading' }); return; }
    if (!current) { setState({ status: 'signedOut' }); return; }
    try {
      const account = await api.loadAccount(current.user.id, current.user.email ?? '');
      setState({ status: 'signedIn', session: current, account });
    } catch { setState({ status: 'error', session: current }); }
  }, [api]);

  useEffect(() => { void load(session); }, [session, load]);
  const refresh = useCallback(async () => {
    if (sandbox) { setTestAccount(sandbox.account()); return; }
    await load(session);
  }, [load, session, sandbox]);
  const value = useMemo<AuthValue>(() => ({
    state: sandbox && testAccount ? { status: 'development', account: testAccount } : state,
    api: sandbox ? sandbox.platform : api, refresh,entryRevision,
    enterSupervisor: localTestEntryEnabled && !sandbox && ['signedOut', 'unconfigured'].includes(state.status) ? enterSupervisor : undefined,
    exitSupervisor: sandbox ? exitSupervisor : undefined,
    communityOverride: sandbox?.community,
  }), [state, api, refresh, sandbox, testAccount, enterSupervisor, exitSupervisor,entryRevision]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() { return useContext(AuthContext); }
