import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import '../lib/errors';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Activity, ArrowRight, Check } from 'lucide-react';
import { getSupabase } from '../lib/supabase';
import { ErrorMessage } from '../components/common';
const schema = z.object({
  name: z.string().max(100),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email('Informe um email válido.')),
  password: z.string().min(1, 'Informe sua senha.').max(128),
  confirmPassword: z.string(),
});
export function LoginPage() {
  const [registering, setRegistering] = useState(false);
  const [recovering, setRecovering] = useState(false);
  const client = useQueryClient();
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(
      schema.superRefine((data, ctx) => {
        if (!registering) return;
        if (data.password.length < 10)
          ctx.addIssue({
            code: 'custom',
            path: ['password'],
            message: 'Use ao menos 10 caracteres.',
          });
        if (data.password !== data.confirmPassword)
          ctx.addIssue({
            code: 'custom',
            path: ['confirmPassword'],
            message: 'As senhas não coincidem.',
          });
      }),
    ),
    defaultValues: { name: '', email: '', password: '', confirmPassword: '' },
  });
  const mutation = useMutation({
    mutationFn: async (d: z.infer<typeof schema>) => {
      const auth = getSupabase().auth;
      const result = registering
        ? await auth.signUp({
            email: d.email,
            password: d.password,
            options: {
              data: { name: d.name || 'Atleta' },
            },
          })
        : await auth.signInWithPassword({
            email: d.email,
            password: d.password,
          });
      if (result.error) throw result.error;
      if (registering && !result.data.session)
        throw new Error(
          'O cadastro sem confirmação ainda não foi habilitado. Desative “Confirm email” no painel do Supabase para entrar diretamente.',
        );
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ['me'] }),
  });
  return (
    <main className="login">
      <section className="login-story">
        <div className="brand">
          <span className="brand-mark">
            <Activity size={24} />
          </span>{' '}
          hypertrophy<span className="muted"> / tracker</span>
        </div>
        <span className="pill">SEU PRÓXIMO NÍVEL COMEÇA AQUI</span>
        <h1>
          Consistência.
          <br />
          Progressão.
          <br />
          <em>Resultados.</em>
        </h1>
        <p>
          Seu treinamento, com direção. Registre cada série e acompanhe a
          evolução que você constrói todos os dias.
        </p>
        <div className="login-benefits">
          {[
            'Programa A/B de 8 semanas',
            'Cargas e RIR sob seu controle',
            'Seu histórico, sempre preservado',
          ].map((t) => (
            <p key={t}>
              <Check size={17} />
              {t}
            </p>
          ))}
        </div>
        <small>HYPERTROPHY TRACKER · TREINE COM PROPÓSITO</small>
      </section>
      <section className="login-form">
        <div>
          <p className="eyebrow">BEM-VINDO AO SEU ESPAÇO</p>
          <h2>{registering ? 'Comece seu ciclo.' : 'Vamos continuar?'}</h2>
          <p className="muted">
            {registering
              ? 'Crie sua conta e receba o programa inicial completo.'
              : 'Entre para acompanhar o seu treinamento.'}
          </p>
          {recovering ? (
            <PasswordRecovery onClose={() => setRecovering(false)} />
          ) : (
            <>
              <form onSubmit={form.handleSubmit((d) => mutation.mutate(d))}>
                {registering && (
                  <label>
                    Nome
                    <input autoComplete="name" {...form.register('name')} />
                  </label>
                )}
                <label>
                  Email
                  <input
                    type="email"
                    autoComplete="email"
                    {...form.register('email')}
                  />
                </label>
                <label>
                  Senha
                  <input
                    type="password"
                    autoComplete={
                      registering ? 'new-password' : 'current-password'
                    }
                    {...form.register('password')}
                  />
                </label>
                {registering && (
                  <label>
                    Confirmar senha
                    <input
                      type="password"
                      autoComplete="new-password"
                      {...form.register('confirmPassword')}
                    />
                  </label>
                )}
                {Object.values(form.formState.errors).map((e, i) => (
                  <p className="error" key={i}>
                    {e.message}
                  </p>
                ))}
                <ErrorMessage error={mutation.error} />
                <button className="primary" disabled={mutation.isPending}>
                  {mutation.isPending
                    ? 'Aguarde…'
                    : registering
                      ? 'Criar minha conta'
                      : 'Entrar na plataforma'}
                  <ArrowRight size={18} />
                </button>
              </form>
              <p className="muted">
                {registering ? 'Já tem uma conta?' : 'Primeira vez por aqui?'}{' '}
                <button
                  className="text-button"
                  onClick={() => {
                    setRegistering(!registering);
                    form.clearErrors();
                    mutation.reset();
                  }}
                >
                  {registering ? 'Entrar' : 'Criar conta'}
                </button>
              </p>
              <button
                className="text-button"
                onClick={() => setRecovering(true)}
              >
                Esqueci minha senha
              </button>
            </>
          )}
          <small className="muted">
            As cargas começam vazias. Você registra os seus próprios resultados.
          </small>
        </div>
      </section>
    </main>
  );
}
function PasswordRecovery({ onClose }: { onClose: () => void }) {
  const [email, setEmail] = useState('');
  const request = useMutation({
    mutationFn: async () => {
      const parsed = schema.shape.email.parse(email);
      const { error } = await getSupabase().auth.resetPasswordForEmail(parsed, {
        redirectTo: `${window.location.origin}/auth/redefinir-senha`,
      });
      if (error) throw error;
    },
  });
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        request.mutate();
      }}
    >
      <label>
        Email da conta
        <input
          required
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </label>
      {request.isSuccess && (
        <p role="status" className="notice">
          Se houver uma conta com esse email, você receberá as instruções para
          redefinir a senha.
        </p>
      )}
      <ErrorMessage error={request.error} />
      <button className="primary" disabled={request.isPending}>
        Enviar instruções
      </button>
      <button type="button" className="text-button" onClick={onClose}>
        Voltar para o login
      </button>
    </form>
  );
}
