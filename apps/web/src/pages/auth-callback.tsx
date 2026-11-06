import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useMutation } from '@tanstack/react-query';
import { z } from 'zod';
import { getSupabase } from '../lib/supabase';
import { ErrorMessage } from '../components/common';
export function AuthCallback({ recovery = false }: { recovery?: boolean }) {
  const nav = useNavigate();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [password, setPassword] = useState('');
  useEffect(() => {
    let active = true;
    void (async () => {
      const auth = getSupabase().auth;
      const result = await auth.getSession();
      if (result.error) throw result.error;
      if (!result.data.session)
        throw new Error(
          'Link inválido ou expirado. Solicite um novo email e abra o link no mesmo navegador usado na solicitação.',
        );
      if (!active) return;
      if (recovery) setReady(true);
      else nav('/', { replace: true });
    })().catch((e) => {
      if (active)
        setError(
          e instanceof Error
            ? e
            : new Error('Não foi possível confirmar o acesso.'),
        );
    });
    return () => {
      active = false;
    };
  }, [nav, recovery]);
  const update = useMutation({
    mutationFn: async () => {
      const parsed = z
        .string()
        .min(10, 'Use ao menos 10 caracteres.')
        .max(128)
        .parse(password);
      const { error } = await getSupabase().auth.updateUser({
        password: parsed,
      });
      if (error) throw error;
    },
    onSuccess: () => nav('/', { replace: true }),
  });
  return (
    <main className="center-screen">
      <section className="panel settings-panel">
        <h1>{recovery ? 'Redefinir senha' : 'Confirmando acesso…'}</h1>
        <ErrorMessage error={error ?? update.error} />
        {ready && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              update.mutate();
            }}
          >
            <label>
              Nova senha
              <input
                type="password"
                autoComplete="new-password"
                required
                minLength={10}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            <button className="primary" disabled={update.isPending}>
              Salvar nova senha
            </button>
          </form>
        )}
        {error && <Link to="/">Voltar ao login</Link>}
      </section>
    </main>
  );
}
