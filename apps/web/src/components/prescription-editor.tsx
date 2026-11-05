import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import type { Exercise, Paginated, Prescription } from '@ht/shared';
import { api } from '../services/api';
import { ErrorMessage, Modal } from './common';
type EditablePrescription = Omit<Prescription, 'exercise'> & {
  exercise?: Exercise;
};
export function PrescriptionEditor({
  item,
  path,
  onClose,
  onSaved,
  session = false,
}: {
  item?: EditablePrescription;
  path: string;
  onClose: () => void;
  onSaved: () => Promise<void>;
  session?: boolean;
}) {
  const catalog = useQuery({
    queryKey: ['catalog'],
    queryFn: () => api<Paginated<Exercise>>('/exercises?pageSize=100'),
  });
  const [search, setSearch] = useState('');
  const [compatible, setCompatible] = useState(true);
  const base = item?.futureOverride ?? item;
  const [d, setD] = useState({
    exerciseId: base?.exerciseId ?? '',
    order: item?.order ?? 0,
    targetSets: base?.targetSets ?? 3,
    minReps: base?.minReps ?? 8,
    maxReps: base?.maxReps ?? 12,
    targetRirMin: base?.targetRirMin ?? 1,
    targetRirMax: base?.targetRirMax ?? 2,
    restSeconds: base?.restSeconds ?? 90,
    restMaxSeconds: base?.restMaxSeconds ?? 120,
    notes: base?.notes ?? '',
    scope: item?.futureOverride ? 'future' : 'template',
  });
  const mutation = useMutation({
    mutationFn: () => api(path, item ? 'PATCH' : 'POST', d),
    onSuccess: async () => {
      await onSaved();
      onClose();
    },
  });
  const selected = catalog.data?.items.find((e) => e.id === d.exerciseId);
  const referenceGroup =
    catalog.data?.items.find((e) => e.id === base?.exerciseId)
      ?.primaryMuscleGroupId ?? item?.exercise?.primaryMuscleGroupId;
  return (
    <Modal
      title={item ? 'Editar exercício e prescrição' : 'Adicionar exercício'}
      onClose={onClose}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate();
        }}
      >
        <label>
          Buscar exercício
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Nome do exercício…"
          />
        </label>
        {item && (
          <label className="check-label">
            <input
              type="checkbox"
              checked={compatible}
              onChange={(e) => setCompatible(e.target.checked)}
            />
            Mostrar o mesmo grupo muscular
          </label>
        )}
        <label>
          Exercício
          <select
            aria-label="Exercício"
            required
            size={5}
            value={d.exerciseId}
            onChange={(e) => setD({ ...d, exerciseId: e.target.value })}
          >
            <option disabled value="">
              Selecione um exercício
            </option>
            {catalog.data?.items
              .filter(
                (e) =>
                  (!compatible ||
                    !item ||
                    !referenceGroup ||
                    e.primaryMuscleGroupId === referenceGroup) &&
                  e.name
                    .toLocaleLowerCase()
                    .includes(search.toLocaleLowerCase()),
              )
              .map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
          </select>
        </label>
        {selected && (
          <p className="muted">
            {selected.primaryMuscle.name} · {selected.equipment}.{' '}
            {selected.id !== item?.exerciseId
              ? 'Substituir não transfere cargas de outro exercício.'
              : ''}
          </p>
        )}
        <div className="form-grid">
          {(
            [
              ['targetSets', 'Séries', 1, 20],
              ['minReps', 'Repetições mín.', 1, 100],
              ['maxReps', 'Repetições máx.', 1, 100],
              ['targetRirMin', 'RIR mín.', 0, 10],
              ['targetRirMax', 'RIR máx.', 0, 10],
              ['restSeconds', 'Descanso mín. (s)', 0, 900],
              ['restMaxSeconds', 'Descanso máx. (s)', 0, 900],
            ] as const
          ).map(([key, label, min, max]) => (
            <label key={key}>
              {label}
              <input
                required
                type="number"
                min={min}
                max={max}
                value={d[key]}
                onChange={(e) => setD({ ...d, [key]: Number(e.target.value) })}
              />
            </label>
          ))}
        </div>
        <label>
          Observações
          <textarea
            value={d.notes}
            onChange={(e) => setD({ ...d, notes: e.target.value })}
          />
        </label>
        {item && !session && (
          <label>
            Aplicar alteração
            <select
              value={d.scope}
              onChange={(e) => setD({ ...d, scope: e.target.value })}
            >
              <option value="template">
                Modelo do programa e próximas sessões
              </option>
              <option value="future">
                Somente futuras sessões (preservar modelo)
              </option>
            </select>
          </label>
        )}
        {session && (
          <p className="muted">
            Alterar somente esta sessão. O modelo permanece igual.
          </p>
        )}
        <ErrorMessage error={mutation.error ?? catalog.error} />
        <div className="modal-actions">
          <button type="button" onClick={onClose}>
            Cancelar
          </button>
          <button
            className="primary"
            disabled={mutation.isPending || !d.exerciseId}
          >
            {mutation.isPending ? 'Salvando…' : 'Salvar alteração'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
