import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Pencil, Search, Trash2 } from 'lucide-react';
import type { Exercise, Muscle, Paginated } from '@ht/shared';
import { api, queryString } from '../services/api';
import {
  AddButton,
  basisLabel,
  Empty,
  ErrorMessage,
  Modal,
  PageTitle,
} from '../components/common';
import { useTraining } from '../app/context';
export function CatalogPage() {
  const { user, refresh } = useTraining();
  const [search, setSearch] = useState('');
  const [muscle, setMuscle] = useState('');
  const [equipment, setEquipment] = useState('');
  const [movement, setMovement] = useState('');
  const [region, setRegion] = useState('');
  const [edit, setEdit] = useState<Exercise | 'new' | null>(null);
  const [detail, setDetail] = useState<Exercise | null>(null);
  const catalog = useQuery({
    queryKey: ['exercises', search, muscle],
    queryFn: () =>
      api<Paginated<Exercise>>(
        `/exercises${queryString({ search, muscle, pageSize: 100 })}`,
      ),
  });
  const muscles = useQuery({
    queryKey: ['muscles'],
    queryFn: () => api<Muscle[]>('/muscles'),
  });
  const deletion = useMutation({
    mutationFn: (id: string) => api(`/exercises/${id}`, 'DELETE'),
    onSuccess: async () => {
      setDetail(null);
      await refresh();
    },
  });
  const items = catalog.data?.items.filter(
    (e) =>
      (!equipment || e.equipment === equipment) &&
      (!movement || e.movementType === movement) &&
      (!region || e.region === region),
  );
  return (
    <>
      <PageTitle
        eyebrow="SUA BIBLIOTECA DE MOVIMENTOS"
        title="Catálogo de exercícios"
        description="Os 32 exercícios do programa inicial e os seus movimentos personalizados."
        action={
          <AddButton onClick={() => setEdit('new')}>Novo exercício</AddButton>
        }
      />
      <div className="notice">
        Catálogo completo do PDF pendente. Os exercícios iniciais foram
        transcritos exclusivamente do programa fornecido; os metadados podem ser
        revisados.
      </div>
      <div className="filters">
        <label className="search-field">
          <Search size={17} />
          <input
            placeholder="Buscar exercício…"
            aria-label="Buscar exercício"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <select
          aria-label="Grupo muscular"
          value={muscle}
          onChange={(e) => setMuscle(e.target.value)}
        >
          <option value="">Todos os grupos</option>
          {muscles.data?.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
        <select
          aria-label="Equipamento"
          value={equipment}
          onChange={(e) => setEquipment(e.target.value)}
        >
          <option value="">Equipamentos</option>
          {[...new Set(catalog.data?.items.map((e) => e.equipment))].map(
            (e) => (
              <option key={e}>{e}</option>
            ),
          )}
        </select>
        <select
          aria-label="Tipo de movimento"
          value={movement}
          onChange={(e) => setMovement(e.target.value)}
        >
          <option value="">Movimentos</option>
          <option value="compound">Multiarticular</option>
          <option value="isolation">Isolador</option>
        </select>
        <select
          aria-label="Região"
          value={region}
          onChange={(e) => setRegion(e.target.value)}
        >
          <option value="">Todas as regiões</option>
          {[
            ...new Set(
              catalog.data?.items.map((e) => e.region).filter(Boolean),
            ),
          ].map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>
      </div>
      <ErrorMessage error={catalog.error} />
      {catalog.isPending ? (
        <p>Carregando catálogo…</p>
      ) : (
        <div className="catalog-grid">
          {items?.map((e) => (
            <button
              className="panel catalog-item"
              onClick={() => setDetail(e)}
              key={e.id}
            >
              <span className="tiny-badge">{e.primaryMuscle.name}</span>
              <h3>{e.name}</h3>
              <p>
                {e.equipment} ·{' '}
                {e.movementType === 'compound' ? 'Multiarticular' : 'Isolador'}
              </p>
              <small>
                {e.source === 'prompt' ? 'Programa inicial' : 'Personalizado'}
                {e._count?.prescriptions
                  ? ` · Em ${e._count.prescriptions} treino(s)`
                  : ''}
              </small>
            </button>
          ))}
        </div>
      )}
      {items?.length === 0 && <Empty title="Nenhum exercício encontrado." />}
      {detail && (
        <Modal title={detail.name} onClose={() => setDetail(null)}>
          <p>
            {detail.primaryMuscle.name} ·{' '}
            {detail.region || 'Região não especificada'} · {detail.equipment}
          </p>
          <p>
            {detail.instructions || 'Sem instruções adicionais cadastradas.'}
          </p>
          <p className="muted">
            {detail.laterality === 'unilateral' ? 'Unilateral' : 'Bilateral'} ·{' '}
            {basisLabel(detail.weightBasis)}
          </p>
          <p>
            Progressão: incremento disponível de {Number(detail.increment)} kg e
            referência de {Number(detail.incrementPercent)}%.
          </p>
          <p className="muted">
            Origem:{' '}
            {detail.source === 'prompt'
              ? 'Programa fornecido'
              : 'Exercício personalizado'}
            . Metadados da aplicação, sujeitos à revisão.
          </p>
          <ErrorMessage error={deletion.error} />
          <div className="button-group">
            <button
              onClick={() => {
                setEdit(detail);
                setDetail(null);
              }}
            >
              <Pencil size={16} />
              {detail.userId === user.id
                ? 'Editar exercício'
                : 'Criar cópia e editar'}
            </button>
            {detail.userId === user.id && (
              <button
                className="danger"
                disabled={deletion.isPending}
                onClick={() => deletion.mutate(detail.id)}
              >
                <Trash2 size={16} />
                Desativar
              </button>
            )}
          </div>
        </Modal>
      )}
      {edit && (
        <ExerciseForm
          exercise={edit === 'new' ? undefined : edit}
          copy={edit !== 'new' && edit.userId !== user.id}
          muscles={muscles.data ?? []}
          onClose={() => setEdit(null)}
          onSaved={refresh}
        />
      )}
    </>
  );
}
function ExerciseForm({
  exercise,
  copy,
  muscles,
  onClose,
  onSaved,
}: {
  exercise?: Exercise;
  copy?: boolean;
  muscles: Muscle[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [data, setData] = useState({
    name: exercise ? `${exercise.name}${copy ? ' (personalizado)' : ''}` : '',
    primaryMuscleGroupId:
      exercise?.primaryMuscleGroupId ?? muscles[0]?.id ?? '',
    region: exercise?.region ?? '',
    equipment: exercise?.equipment ?? '',
    movementType: exercise?.movementType ?? 'compound',
    laterality: exercise?.laterality ?? 'bilateral',
    instructions: exercise?.instructions ?? '',
    increment: Number(exercise?.increment ?? 1),
    incrementPercent: Number(exercise?.incrementPercent ?? 2.5),
    weightBasis: exercise?.weightBasis ?? 'total',
    isActive: true,
    secondaryMuscles:
      exercise?.muscles
        ?.filter((m) => m.role === 'secondary')
        .map((m) => ({
          muscleGroupId: m.muscleGroupId,
          emphasis: m.emphasis,
        })) ?? ([] as { muscleGroupId: string; emphasis: number }[]),
  });
  const mutation = useMutation({
    mutationFn: () =>
      api(
        exercise && !copy ? `/exercises/${exercise.id}` : '/exercises',
        exercise && !copy ? 'PATCH' : 'POST',
        data,
      ),
    onSuccess: async () => {
      await onSaved();
      onClose();
    },
  });
  return (
    <Modal
      title={exercise && !copy ? 'Editar exercício' : 'Exercício personalizado'}
      onClose={onClose}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate();
        }}
      >
        <label>
          Nome original
          <input
            required
            minLength={2}
            maxLength={200}
            value={data.name}
            onChange={(e) => setData({ ...data, name: e.target.value })}
          />
        </label>
        <div className="form-grid">
          <label>
            Grupo principal
            <select
              value={data.primaryMuscleGroupId}
              onChange={(e) =>
                setData({ ...data, primaryMuscleGroupId: e.target.value })
              }
            >
              {muscles.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Região
            <input
              value={data.region}
              onChange={(e) => setData({ ...data, region: e.target.value })}
            />
          </label>
          <label>
            Equipamento
            <input
              value={data.equipment}
              onChange={(e) => setData({ ...data, equipment: e.target.value })}
            />
          </label>
          <label>
            Movimento
            <select
              value={data.movementType}
              onChange={(e) =>
                setData({ ...data, movementType: e.target.value })
              }
            >
              <option value="compound">Multiarticular</option>
              <option value="isolation">Isolador</option>
            </select>
          </label>
          <label>
            Lateralidade
            <select
              value={data.laterality}
              onChange={(e) => setData({ ...data, laterality: e.target.value })}
            >
              <option value="bilateral">Bilateral</option>
              <option value="unilateral">Unilateral</option>
            </select>
          </label>
          <label>
            Base da carga
            <select
              value={data.weightBasis}
              onChange={(e) =>
                setData({ ...data, weightBasis: e.target.value })
              }
            >
              <option value="total">Total</option>
              <option value="per_side">Por lado (sem barra)</option>
              <option value="per_dumbbell">Por halter</option>
            </select>
          </label>
          <label>
            Incremento disponível (kg)
            <input
              type="number"
              min="0.001"
              max="100"
              step="0.001"
              required
              value={data.increment}
              onChange={(e) =>
                setData({ ...data, increment: Number(e.target.value) })
              }
            />
          </label>
          <label>
            Referência de aumento (%)
            <input
              type="number"
              min="1"
              max="10"
              step="0.1"
              required
              value={data.incrementPercent}
              onChange={(e) =>
                setData({ ...data, incrementPercent: Number(e.target.value) })
              }
            />
          </label>
        </div>
        <p className="muted">
          Referências configuráveis: compostos superiores 2–5%; inferiores
          2,5–10%; isoladores 1–5%. O incremento do equipamento pode resultar em
          percentual maior; aceite somente após revisar.
        </p>
        <fieldset className="secondary-muscles">
          <legend>Participação muscular secundária estimada</legend>
          <p className="muted">
            Opcional. Cadastre somente estimativas revisadas. Esses valores são
            separados das séries diretas e copiados nas novas sessões.
          </p>
          {muscles
            .filter((m) => m.id !== data.primaryMuscleGroupId)
            .map((m) => {
              const selected = data.secondaryMuscles.find(
                (s) => s.muscleGroupId === m.id,
              );
              return (
                <div className="secondary-muscle" key={m.id}>
                  <label className="check-label">
                    <input
                      type="checkbox"
                      checked={!!selected}
                      onChange={(e) =>
                        setData({
                          ...data,
                          secondaryMuscles: e.target.checked
                            ? [
                                ...data.secondaryMuscles,
                                { muscleGroupId: m.id, emphasis: 0.5 },
                              ]
                            : data.secondaryMuscles.filter(
                                (s) => s.muscleGroupId !== m.id,
                              ),
                        })
                      }
                    />
                    {m.name}
                  </label>
                  {selected && (
                    <label>
                      Peso por série
                      <input
                        type="number"
                        step="0.05"
                        min="0"
                        max="1"
                        value={selected.emphasis}
                        onChange={(e) =>
                          setData({
                            ...data,
                            secondaryMuscles: data.secondaryMuscles.map((s) =>
                              s.muscleGroupId === m.id
                                ? { ...s, emphasis: Number(e.target.value) }
                                : s,
                            ),
                          })
                        }
                      />
                    </label>
                  )}
                </div>
              );
            })}
        </fieldset>
        <label>
          Instruções e observações
          <textarea
            value={data.instructions}
            onChange={(e) => setData({ ...data, instructions: e.target.value })}
          />
        </label>
        <ErrorMessage error={mutation.error} />
        <button className="primary" disabled={mutation.isPending}>
          Salvar exercício
        </button>
      </form>
    </Modal>
  );
}
