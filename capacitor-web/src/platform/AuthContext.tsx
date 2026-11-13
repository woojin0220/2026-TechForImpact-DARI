import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { platformClient } from './client';
import { platformApi, type PlatformApi } from './api';
import type { Account } from './account';

export type AuthState =
  | { status: 'unconfigured' }
  | { status: 'loading' }
  | { status: 'signedOut' }
  | { status: 'error'; session: Session }
  | { status: 'signedIn'; session: Session; account: Account };

type AuthValue = { state: AuthState; api: PlatformApi | null; refresh: () => Promise<void> };
const AuthContext = createContext<AuthValue>({ state: { status: 'unconfigured' }, api: null, refresh: async () => {} });

/** Keeps the signed-in member and their profile, roles and consents in one place for every tab. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const client = useMemo(() => platformClient(), []);
  const api = useMemo(() => client ? platformApi(client) : null, [client]);
  const [session, setSession] = useState<Session | null | undefined>(client ? undefined : null);
  const [state, setState] = useState<AuthState>(client ? { status: 'loading' } : { status: 'unconfigured' });

  useEffect(() => {
    if (!client) return;
    let active = true;
    client.auth.getSession().then(({ data }) => { if (active) setSession(data.session); });
    const { data } = client.auth.onAuthStateChange((_event, next) => { if (active) setSession(next); });
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
  const refresh = useCallback(() => load(session), [load, session]);
  const value = useMemo(() => ({ state, api, refresh }), [state, api, refresh]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() { return useContext(AuthContext); }
