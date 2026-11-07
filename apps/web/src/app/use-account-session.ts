import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { withDeadline } from '../lib/deadline';

type SessionState = {
  ready: boolean;
  subject: string | null;
  error: Error | null;
};

export function useAccountSession() {
  const client = useQueryClient();
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<SessionState>({
    ready: false,
    subject: null,
    error: null,
  });
  useEffect(() => {
    if (!supabase) return;
    let alive = true;
    let eventReceived = false;
    let subject: string | null | undefined;
    const apply = (next: string | null) => {
      if (!alive) return;
      // Clear all private caches before a different account can render them.
      if (subject !== undefined && next !== subject) client.clear();
      subject = next;
      setState({ ready: true, subject: next, error: null });
    };
    const { data: listener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        eventReceived = true;
        apply(session?.user.id ?? null);
        if (event === 'SIGNED_OUT') client.clear();
        if (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN')
          void client.invalidateQueries({ queryKey: ['me'] });
      },
    );
    void withDeadline(supabase.auth.getSession())
      .then(({ data, error }) => {
        if (!alive || eventReceived) return;
        if (error) throw error;
        apply(data.session?.user.id ?? null);
      })
      .catch((error: unknown) => {
        if (alive && !eventReceived)
          setState({
            ready: false,
            subject: null,
            error:
              error instanceof Error
                ? error
                : new Error('Não foi possível verificar sua sessão.'),
          });
      });
    return () => {
      alive = false;
      listener.subscription.unsubscribe();
    };
  }, [client, attempt]);
  return {
    ...state,
    retry: () => {
      setState({ ready: false, subject: null, error: null });
      setAttempt((value) => value + 1);
    },
  };
}
