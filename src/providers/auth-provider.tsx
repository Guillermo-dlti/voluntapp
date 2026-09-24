import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { AuthError, authMessage, currentAccount, loginAccount, logoutAccount, type Account } from '@/services/auth';
import { readSession, removeSession, saveSession } from '@/services/session-storage';

interface AuthContextValue {
  user: Account | null;
  status: 'loading' | 'ready' | 'error';
  error: string;
  signIn: (identifier: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Account | null>(null);
  const [status, setStatus] = useState<AuthContextValue['status']>('loading');
  const [error, setError] = useState('');
  const tokenRef = useRef<string | null>(null);
  const generation = useRef(0);
  const refreshing = useRef(false);

  const refresh = useCallback(async () => {
    if (refreshing.current) return;
    refreshing.current = true;
    const version = generation.current;
    try {
      const token = tokenRef.current ?? await readSession();
      const account = token ? await currentAccount(token) : null;
      if (version !== generation.current) return;
      tokenRef.current = token;
      setUser(account);
      setError('');
      setStatus('ready');
    } catch (cause: unknown) {
      if (version !== generation.current) return;
      if (cause instanceof AuthError && cause.status === 401) {
        try {
          await removeSession();
          if (version !== generation.current) return;
          tokenRef.current = null;
          setUser(null);
          setError('Tu sesión terminó. Inicia sesión de nuevo.');
          setStatus('ready');
        } catch { setError('No pudimos borrar la sesión anterior. Inténtalo de nuevo.'); setStatus('error'); }
      } else { setError(authMessage(cause)); setStatus('error'); }
    } finally { refreshing.current = false; }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active' && tokenRef.current) void refresh();
    });
    return () => subscription.remove();
  }, [refresh]);

  const signIn = useCallback(async (identifier: string, password: string) => {
    const session = await loginAccount(identifier, password);
    try { await saveSession(session.token); }
    catch (cause: unknown) { await logoutAccount(session.token).catch(() => undefined); throw cause; }
    generation.current += 1;
    tokenRef.current = session.token;
    setUser(session.user);
    setError('');
    setStatus('ready');
  }, []);

  const signOut = useCallback(async () => {
    const token = tokenRef.current ?? await readSession();
    if (token) await logoutAccount(token);
    await removeSession();
    generation.current += 1;
    tokenRef.current = null;
    setUser(null);
    setError('');
    setStatus('ready');
  }, []);

  return <AuthContext.Provider value={{ user, status, error, signIn, signOut, refresh }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('AuthProvider is required.');
  return context;
}
