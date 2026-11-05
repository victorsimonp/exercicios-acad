import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { expect, test, vi } from 'vitest';
import type { ExerciseSet } from '@ht/shared';
import { SetRow } from './set-row';
const set: ExerciseSet = {
  id: 'set1',
  setNumber: 1,
  setType: 'work',
  prescribedRepsMin: 6,
  prescribedRepsMax: 10,
  actualReps: null,
  weight: null,
  weightBasis: 'total',
  rir: null,
  completed: false,
  techniqueOk: true,
  notes: '',
  revision: 0,
};
function setup() {
  const onComplete = vi.fn();
  const onDirty = vi.fn();
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { mutations: { retry: false } } })
      }
    >
      <SetRow
        set={set}
        sessionId="s1"
        restSeconds={120}
        onComplete={onComplete}
        onDirty={onDirty}
      />
    </QueryClientProvider>,
  );
  return { onComplete, onDirty };
}
test('cargas vazias; não permite concluir sem dados e explica a base', () => {
  setup();
  expect(screen.getByLabelText('Carga série 1')).toHaveValue(null);
  expect(screen.getByLabelText('Concluir série')).toBeDisabled();
  fireEvent.click(screen.getByText('Nota e base de carga'));
  expect(screen.getByLabelText('Base da carga')).toHaveValue('total');
});
test('salva carga/reps/RIR na API e inicia descanso após confirmação do backend', async () => {
  const fetchMock = vi
    .spyOn(globalThis, 'fetch')
    .mockImplementation(async (_url, options) => {
      const input = JSON.parse(options?.body as string);
      return new Response(
        JSON.stringify({
          ...set,
          ...input,
          weight: String(input.weight),
          revision: input.revision + 1,
        }),
        { status: 200 },
      );
    });
  try {
    const { onComplete } = setup();
    fireEvent.change(screen.getByLabelText('Carga série 1'), {
      target: { value: '40' },
    });
    fireEvent.change(screen.getByLabelText('Repetições série 1'), {
      target: { value: '10' },
    });
    fireEvent.change(screen.getByLabelText('RIR série 1'), {
      target: { value: '2' },
    });
    fireEvent.click(screen.getByLabelText('Concluir série'));
    expect(localStorage.getItem('ht-draft:s1:set1')).toContain('40');
    await waitFor(() => expect(onComplete).toHaveBeenCalledWith(120), {
      timeout: 2500,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Salvo')).toBeInTheDocument();
    expect(localStorage.getItem('ht-draft:s1:set1')).toBeNull();
  } finally {
    fetchMock.mockRestore();
  }
});
test('recupera rascunho e conserva dados quando a API falha', async () => {
  localStorage.setItem(
    'ht-draft:s1:set1',
    JSON.stringify({
      weight: 35,
      actualReps: 9,
      rir: 1,
      completed: false,
      techniqueOk: true,
      notes: 'Minha nota',
      weightBasis: 'total',
      revision: 0,
    }),
  );
  const mock = vi
    .spyOn(globalThis, 'fetch')
    .mockRejectedValue(new Error('Sem conexão'));
  try {
    setup();
    expect(screen.getByLabelText('Carga série 1')).toHaveValue(35);
    await waitFor(
      () => expect(screen.getByText(/Sem conexão/)).toBeInTheDocument(),
      { timeout: 2500 },
    );
    expect(localStorage.getItem('ht-draft:s1:set1')).toContain('Minha nota');
  } finally {
    mock.mockRestore();
  }
});
