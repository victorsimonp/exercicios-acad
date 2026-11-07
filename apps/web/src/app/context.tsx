import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Program, User, Session } from '@ht/shared';
import { api, ApiError } from '../services/api';
import { getSupabase, supabaseConfigError } from '../lib/supabase';
import { useAccountSession } from './use-account-session';
import { Layout } from './layout';
import { DashboardLoading } from '../components/dashboard-loading';
import { StartupStatus } from '../components/startup-status';
type Context = {
  user: User;
  activeSession?: Session | null;
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
  const auth = useAccountSession();
  const signedIn = auth.ready && !!auth.subject && !auth.error;
  const user = useQuery({
    queryKey: ['me', auth.subject],
    queryFn: ({ signal }) =>
      api<User>('/auth/me', 'GET', undefined, { signal }),
    retry: false,
    enabled: signedIn,
  });
  const programs = useQuery({
    queryKey: ['programs', auth.subject],
    queryFn: ({ signal }) =>
      api<Program[]>('/programs', 'GET', undefined, { signal }),
    enabled: signedIn && !!user.data,
    retry: false,
  });
  const activeSession = useQuery({
    queryKey: ['active-session', user.data?.id],
    queryFn: ({ signal }) =>
      api<Session | null>('/sessions/active', 'GET', undefined, { signal }),
    enabled: signedIn && !!user.data,
    refetchInterval: 15000,
    retry: false,
  });
  const [selectedWeek, setWeekNumber] = useState<number | null>(null);
  const [selectedProgram, setSelectedProgram] = useState<string | null>(null);
  useEffect(() => {
    setSelectedProgram(null);
    setWeekNumber(null);
  }, [auth.subject]);
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
  const unauthorized = [user.error, programs.error].some(
    (error) => error instanceof ApiError && error.status === 401,
  );
  if (
    !supabaseConfigError &&
    auth.ready &&
    !auth.error &&
    (!signedIn || unauthorized)
  )
    return login;
  const startupError = supabaseConfigError
    ? new Error(supabaseConfigError)
    : (auth.error ?? user.error ?? programs.error);
  const ready = signedIn && !!user.data && !!programs.data && !unauthorized;
  const retry = () => {
    if (auth.error) auth.retry();
    else {
      if (!user.data || user.error) void user.refetch();
      if (user.data && programs.error) void programs.refetch();
    }
  };
  const logout = async () => {
    const { error } = await getSupabase().auth.signOut({ scope: 'local' });
    if (error) throw error;
    client.clear();
  };
  const status = (
    <StartupStatus
      pending={!ready && !startupError}
      error={startupError}
      retry={retry}
    />
  );
  return (
    <Layout
      account={
        ready && user.data
          ? {
              user: user.data,
              program,
              weekNumber,
              setWeekNumber,
              logout,
              activeSession: activeSession.data,
            }
          : undefined
      }
    >
      {!ready || !user.data ? (
        <DashboardLoading status={status} />
      ) : (
        <>
          {startupError && status}
          <TrainingContext.Provider
            value={{
              user: user.data,
              activeSession: activeSession.data,
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
              logout,
            }}
          >
            {children}
          </TrainingContext.Provider>
        </>
      )}
    </Layout>
  );
}
