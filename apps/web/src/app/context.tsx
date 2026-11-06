import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Program, User } from '@ht/shared';
import { api, ApiError } from '../services/api';
import { getSupabase, supabase, supabaseConfigError } from '../lib/supabase';
type Context = {
  user: User;
  programs: Program[];
  program: Program | undefined;
  setProgramId: (id: string) => void;
  weekNumber: number;
  setWeekNumber: (n: number) => void;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
};
export const TrainingContext = createContext<Context | null>(null);
export function useTraining() {
  const ctx = useContext(TrainingContext);
  if (!ctx) throw new Error('Contexto indisponível');
  return ctx;
}
export function AccountGate({
  children,
  login,
}: {
  children: ReactNode;
  login: ReactNode;
}) {
  const client = useQueryClient();
  const [authReady, setAuthReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [authError, setAuthError] = useState<Error | null>(null);
  useEffect(() => {
    if (!supabase) {
      setAuthReady(true);
      return;
    }
    let active = true;
    void supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      setAuthError(error);
      setSignedIn(!!data.session);
      setAuthReady(true);
    });
    const { data: listener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSignedIn(!!session);
        setAuthReady(true);
        if (event === 'SIGNED_OUT') client.clear();
        else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED')
          void client.invalidateQueries({ queryKey: ['me'] });
      },
    );
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [client]);
  const user = useQuery({
    queryKey: ['me'],
    queryFn: () => api<User>('/auth/me'),
    retry: false,
    enabled: authReady && signedIn,
  });
  const programs = useQuery({
    queryKey: ['programs'],
    queryFn: () => api<Program[]>('/programs'),
    enabled: !!user.data,
  });
  const [selectedWeek, setWeekNumber] = useState<number | null>(null);
  const [selectedProgram, setSelectedProgram] = useState<string | null>(null);
  const program =
    programs.data?.find(
      (p) => p.id === selectedProgram && p.status === 'active',
    ) ?? programs.data?.find((p) => p.status === 'active');
  const current = program
    ? Math.max(
        1,
        Math.min(
          program.totalWeeks,
          Math.floor(
            (Date.now() - new Date(program.startDate).getTime()) / 604800000,
          ) + 1,
        ),
      )
    : 1;
  const weekNumber = Math.min(
    program?.totalWeeks ?? 8,
    selectedWeek ?? current,
  );
  useEffect(() => {
    document.documentElement.dataset.theme =
      user.data?.settings.theme ?? 'dark';
  }, [user.data]);
  if (supabaseConfigError)
    return (
      <div className="center-screen">
        <p className="error">{supabaseConfigError}</p>
      </div>
    );
  if (authError)
    return (
      <div className="center-screen">
        <p className="error">{authError.message}</p>
      </div>
    );
  if (authReady && !signedIn) return login;
  if (!authReady || user.isPending)
    return <div className="center-screen">Carregando sua conta…</div>;
  if (user.error instanceof ApiError && user.error.status === 401) return login;
  if (user.error || programs.error)
    return (
      <div className="center-screen">
        <div className="error">
          {(user.error ?? programs.error)?.message}
          <button
            onClick={() => {
              void user.refetch();
              void programs.refetch();
            }}
          >
            Tentar novamente
          </button>
        </div>
      </div>
    );
  if (!user.data || programs.isPending)
    return <div className="center-screen">Carregando programa…</div>;
  return (
    <TrainingContext.Provider
      value={{
        user: user.data,
        programs: programs.data ?? [],
        program,
        setProgramId: (id) => {
          setSelectedProgram(id);
          setWeekNumber(null);
        },
        weekNumber,
        setWeekNumber,
        refresh: async () => {
          await client.invalidateQueries();
        },
        logout: async () => {
          const { error } = await getSupabase().auth.signOut();
          if (error) throw error;
          client.clear();
          setSignedIn(false);
        },
      }}
    >
      {children}
    </TrainingContext.Provider>
  );
}
