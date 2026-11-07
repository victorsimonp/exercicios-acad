import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, useLocation } from 'react-router';
import { beforeEach, expect, test, vi } from 'vitest';
import type { User } from '@ht/shared';

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  api: vi.fn(),
  listener: undefined as
    | undefined
    | ((event: string, session: { user: { id: string } } | null) => void),
}));
vi.mock('../lib/supabase', () => ({
  supabaseConfigError: null,
  supabase: {
    auth: {
      getSession: mocks.getSession,
      onAuthStateChange: (listener: typeof mocks.listener) => {
        mocks.listener = listener;
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      },
    },
  },
  getSupabase: () => ({ auth: { signOut: vi.fn() } }),
}));
vi.mock('../services/api', async (original) => ({
  ...(await original<object>()),
  api: mocks.api,
}));
import { AccountGate, useTraining } from './context';
import { ApiError } from '../services/api';
import { ConnectionError } from '../lib/deadline';

const user: User = {
  id: 'profile',
  name: 'Atleta',
  email: 'test@example.invalid',
  settings: {},
};
const session = { data: { session: { user: { id: 'subject' } } }, error: null };
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
function PrivatePage() {
  const { user } = useTraining();
  const location = useLocation();
  return (
    <>
      <h1>Conta de {user.name}</h1>
      <p>{location.pathname}</p>
      <input aria-label="Estado local" />
    </>
  );
}
function mount(
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  }),
) {
  const view = render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <AccountGate login={<h1>Entrar na conta</h1>}>
          <PrivatePage />
        </AccountGate>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { ...view, client };
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSession.mockResolvedValue(session);
  mocks.api.mockImplementation(async (path: string) =>
    path === '/auth/me' ? user : path === '/programs' ? [] : null,
  );
});

test('restauração pendente mostra estrutura, sem dados antigos, login prematuro ou chamadas privadas', async () => {
  const restore = deferred<typeof session>();
  mocks.getSession.mockReturnValue(restore.promise);
  const client = new QueryClient();
  client.setQueryData(['me', 'subject'], { ...user, name: 'Conta antiga' });
  mount(client);
  expect(
    screen.getByRole('heading', { name: 'Seu treinamento' }),
  ).toBeVisible();
  expect(document.querySelector('.sidebar')).toBeInTheDocument();
  expect(document.querySelector('.mobile-nav')).toBeInTheDocument();
  expect(screen.queryByText('Conta antiga')).not.toBeInTheDocument();
  expect(screen.queryByText('Entrar na conta')).not.toBeInTheDocument();
  expect(mocks.api).not.toHaveBeenCalled();
});

test('backend lento mantém o mesmo layout, navegação segura e libera a rota após validar os dados', async () => {
  const account = deferred<User>();
  mocks.api.mockImplementation(async (path: string) =>
    path === '/auth/me' ? account.promise : path === '/programs' ? [] : null,
  );
  mount();
  const shell = document.querySelector('.app-layout');
  await waitFor(() => expect(mocks.api).toHaveBeenCalledTimes(1));
  fireEvent.click(screen.getByRole('link', { name: 'Dashboard' }));
  fireEvent.click(screen.getByRole('link', { name: 'Meus treinos' }));
  expect(screen.queryByLabelText('Estado local')).not.toBeInTheDocument();
  await act(async () => account.resolve(user));
  expect(await screen.findByText('Conta de Atleta')).toBeVisible();
  expect(screen.getByText('/treinos')).toBeVisible();
  expect(document.querySelector('.app-layout')).toBe(shell);
  expect(
    mocks.api.mock.calls.filter((call) => call[0] === '/auth/me'),
  ).toHaveLength(1);
});

test('sessão ausente apresenta login sem consultar a API', async () => {
  mocks.getSession.mockResolvedValue({ data: { session: null }, error: null });
  mount();
  expect(await screen.findByText('Entrar na conta')).toBeVisible();
  expect(mocks.api).not.toHaveBeenCalled();
});

test.each([
  new ConnectionError('network'),
  new ConnectionError('timeout'),
  new ApiError(503, 'Indisponível'),
])(
  'erro de conexão/servidor mantém o layout e permite recuperação: %s',
  async (error) => {
    mocks.api.mockRejectedValueOnce(error);
    mount();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível carregar suas informações. Tente novamente.',
    );
    expect(document.querySelector('.mobile-nav')).toBeInTheDocument();
    expect(screen.queryByText('Entrar na conta')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(await screen.findByText('Conta de Atleta')).toBeVisible();
  },
);

test('erro ao carregar programa pode ser recuperado sem repetir a consulta da conta', async () => {
  let failure = true;
  mocks.api.mockImplementation(async (path: string) => {
    if (path === '/auth/me') return user;
    if (path === '/programs') {
      if (failure) throw new ApiError(500, 'Falha');
      return [];
    }
    return null;
  });
  mount();
  await screen.findByRole('alert');
  failure = false;
  fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
  expect(await screen.findByText('Conta de Atleta')).toBeVisible();
  expect(
    mocks.api.mock.calls.filter((call) => call[0] === '/auth/me'),
  ).toHaveLength(1);
});

test('401 exige login; falha ao restaurar a sessão permite tentar a autenticação novamente', async () => {
  mocks.getSession.mockRejectedValueOnce(
    new Error('Não foi possível verificar sua sessão.'),
  );
  mocks.api.mockRejectedValueOnce(new ApiError(401, 'Sessão inválida'));
  mount();
  await screen.findByRole('alert');
  expect(mocks.api).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
  expect(await screen.findByText('Entrar na conta')).toBeVisible();
});

test('trocar de conta oculta dados e espera a validação da nova identidade', async () => {
  mount();
  await screen.findByText('Conta de Atleta');
  const account = deferred<User>();
  mocks.api.mockImplementation(async (path: string) =>
    path === '/auth/me' ? account.promise : [],
  );
  act(() =>
    mocks.listener?.('SIGNED_IN', { user: { id: 'outra-identidade' } }),
  );
  expect(screen.queryByText('Conta de Atleta')).not.toBeInTheDocument();
  expect(
    screen.getByRole('heading', { name: 'Seu treinamento' }),
  ).toBeVisible();
  await act(async () =>
    account.resolve({ ...user, id: 'other', name: 'Outra pessoa' }),
  );
  expect(await screen.findByText('Conta de Outra pessoa')).toBeVisible();
});

test('atualização em segundo plano preserva os estados locais da página', async () => {
  const { client } = mount();
  await screen.findByText('Conta de Atleta');
  fireEvent.change(screen.getByLabelText('Estado local'), {
    target: { value: 'preservado' },
  });
  await act(async () => {
    await client.invalidateQueries();
  });
  expect(screen.getByLabelText('Estado local')).toHaveValue('preservado');
});
