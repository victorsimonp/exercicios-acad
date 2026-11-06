import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, expect, test, vi } from 'vitest';
const auth = vi.hoisted(() => ({
  signUp: vi.fn(),
  signInWithPassword: vi.fn(),
  resetPasswordForEmail: vi.fn(),
}));
vi.mock('../lib/supabase', () => ({ getSupabase: () => ({ auth }) }));
import { LoginPage } from './login';
beforeEach(() => {
  vi.clearAllMocks();
});
function mount() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <LoginPage />
    </QueryClientProvider>,
  );
}
test('cadastro entra com a sessão real sem solicitar confirmação de email', async () => {
  auth.signUp.mockResolvedValue({
    data: { session: { access_token: 'real-session' } },
    error: null,
  });
  mount();
  fireEvent.click(screen.getByRole('button', { name: 'Criar conta' }));
  fireEvent.change(screen.getByLabelText('Email'), {
    target: { value: 'atleta@example.com' },
  });
  fireEvent.change(screen.getByLabelText('Senha'), {
    target: { value: 'Senha-de-teste-123' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Criar minha conta' }));
  await waitFor(() => expect(auth.signUp).toHaveBeenCalled());
  expect(auth.signUp).toHaveBeenCalledWith(
    expect.objectContaining({
      email: 'atleta@example.com',
      options: expect.objectContaining({
        data: { name: 'Atleta' },
      }),
    }),
  );
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

test('informa configuração pendente quando Supabase não entrega sessão no cadastro', async () => {
  auth.signUp.mockResolvedValue({ data: { session: null }, error: null });
  mount();
  fireEvent.click(screen.getByRole('button', { name: 'Criar conta' }));
  fireEvent.change(screen.getByLabelText('Email'), {
    target: { value: 'atleta@example.com' },
  });
  fireEvent.change(screen.getByLabelText('Senha'), {
    target: { value: 'Senha-de-teste-123' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Criar minha conta' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Desative “Confirm email”',
  );
});
test('login usa signInWithPassword e apresenta falhas de autenticação', async () => {
  auth.signInWithPassword.mockResolvedValue({
    data: {},
    error: new Error('Credenciais inválidas'),
  });
  mount();
  fireEvent.change(screen.getByLabelText('Email'), {
    target: { value: 'atleta@example.com' },
  });
  fireEvent.change(screen.getByLabelText('Senha'), {
    target: { value: 'Senha-de-teste-123' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Entrar na plataforma' }));
  await waitFor(() =>
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Credenciais inválidas',
    ),
  );
});
test('recuperação encaminha ao Supabase a URL de redefinição', async () => {
  auth.resetPasswordForEmail.mockResolvedValue({ data: {}, error: null });
  mount();
  fireEvent.click(screen.getByRole('button', { name: 'Esqueci minha senha' }));
  fireEvent.change(screen.getByLabelText('Email da conta'), {
    target: { value: 'atleta@example.com' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Enviar instruções' }));
  await waitFor(() =>
    expect(auth.resetPasswordForEmail).toHaveBeenCalledWith(
      'atleta@example.com',
      { redirectTo: expect.stringContaining('/auth/redefinir-senha') },
    ),
  );
});
