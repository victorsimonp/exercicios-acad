import { act, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { StartupStatus } from './startup-status';
import { withDeadline, ConnectionError } from '../lib/deadline';

afterEach(() => vi.useRealTimers());
test('aviso de conexão só aparece após cinco segundos e desaparece na conclusão', () => {
  vi.useFakeTimers();
  const view = render(<StartupStatus pending retry={vi.fn()} />);
  expect(screen.queryByText(/Estamos conectando/)).not.toBeInTheDocument();
  act(() => vi.advanceTimersByTime(5000));
  expect(screen.getByRole('status')).toHaveTextContent(
    'Estamos conectando ao servidor. Isso pode levar alguns instantes.',
  );
  view.rerender(<StartupStatus pending={false} retry={vi.fn()} />);
  expect(screen.queryByText(/Estamos conectando/)).not.toBeInTheDocument();
});

test('operações paradas têm prazo finito, sem ficar em loading indefinidamente', async () => {
  vi.useFakeTimers();
  const assertion = expect(
    withDeadline(new Promise(() => {})),
  ).rejects.toBeInstanceOf(ConnectionError);
  await vi.advanceTimersByTimeAsync(60000);
  await assertion;
});
