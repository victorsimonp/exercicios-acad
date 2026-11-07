import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { expect, test, vi } from 'vitest';
import { Layout } from './layout';

const state = vi.hoisted(() => ({
  activeSession: null as null | { id: string },
}));
function LayoutFixture() {
  return (
    <Layout
      account={{
        user: {
          id: 'test',
          name: 'Teste',
          email: 'test@example.invalid',
          settings: {},
        },
        weekNumber: 1,
        setWeekNumber: vi.fn(),
        logout: vi.fn(),
        activeSession: state.activeSession,
      }}
    >
      {null}
    </Layout>
  );
}

test('rodapé alterna Iniciar/Continuar e retoma o ID retornado pelo backend', () => {
  state.activeSession = null;
  const view = render(
    <MemoryRouter>
      <LayoutFixture />
    </MemoryRouter>,
  );
  const mobile = () =>
    within(document.querySelector('.mobile-nav') as HTMLElement);
  expect(mobile().getByRole('link', { name: 'Iniciar' })).toHaveAttribute(
    'href',
    '/iniciar',
  );
  state.activeSession = { id: 'sessao-persistida' };
  view.rerender(
    <MemoryRouter>
      <LayoutFixture />
    </MemoryRouter>,
  );
  expect(mobile().getByRole('link', { name: 'Continuar' })).toHaveAttribute(
    'href',
    '/sessao/sessao-persistida',
  );
  state.activeSession = null;
  view.rerender(
    <MemoryRouter>
      <LayoutFixture />
    </MemoryRouter>,
  );
  expect(mobile().getByRole('link', { name: 'Iniciar' })).toHaveAttribute(
    'href',
    '/iniciar',
  );
  expect(screen.queryByText('Continuar')).not.toBeInTheDocument();
});
