import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpRight,
  Clock,
  Dumbbell,
  GripVertical,
  Pencil,
  Play,
  Plus,
  Trash2,
} from 'lucide-react';
import type { Prescription, Session, Workout } from '@ht/shared';
import { useTraining } from '../app/context';
import { api } from '../services/api';
import {
  AddButton,
  Empty,
  ErrorMessage,
  Modal,
  PageTitle,
} from '../components/common';
import { PrescriptionEditor } from '../components/prescription-editor';
import { SchedulePanel } from '../components/schedule-panel';
export function Workouts({ start = false }: { start?: boolean }) {
  const { program, weekNumber, refresh } = useTraining();
  const week = program?.weeks.find((w) => w.weekNumber === weekNumber);
  const [focus, setFocus] = useState(week?.focus ?? 'A');
  useEffect(() => setFocus(week?.focus ?? 'A'), [week?.focus]);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const create = useMutation({
    mutationFn: () =>
      api('/workouts', 'POST', {
        programId: program?.id,
        name,
        focus,
        dayNumber: 1,
      }),
    onSuccess: async () => {
      await refresh();
      setCreating(false);
      setName('');
    },
  });
  return (
    <>
      <PageTitle
        eyebrow="PLANEJAMENTO"
        title={start ? 'Qual é o treino de hoje?' : 'Meus treinos'}
        description="Seu programa, organizado para você se concentrar no que importa."
        action={
          program && (
            <AddButton onClick={() => setCreating(true)}>
              Criar treino
            </AddButton>
          )
        }
      />
      <div className="tabs">
        <button
          className={focus === 'A' ? 'selected' : ''}
          onClick={() => setFocus('A')}
        >
          Semana A
        </button>
        <button
          className={focus === 'B' ? 'selected' : ''}
          onClick={() => setFocus('B')}
        >
          Semana B
        </button>
        <span className="muted">
          {focus === 'A'
            ? 'Peitoral superior · Espessura dorsal · Quadríceps'
            : 'Peitoral médio/inferior · Largura dorsal · Posteriores'}
        </span>
      </div>
      <div className="workout-grid">
        {program?.workouts
          .filter((w) => w.focus === focus)
          .map((w) => (
            <Link
              to={`/treinos/${w.id}${start ? '?iniciar=1' : ''}`}
              className="panel workout-card"
              key={w.id}
            >
              <div className="workout-card-top">
                <span className="day-marker">0{w.dayNumber}</span>
                <span className="tiny-badge">SEMANA {w.focus}</span>
              </div>
              <Dumbbell className="workout-icon" size={26} />
              <h2>{w.name}</h2>
              <p className="muted">{w.description}</p>
              <div className="workout-card-footer">
                <span>
                  {w.exercises.length} exercícios ·{' '}
                  {w.exercises.reduce((a, e) => a + e.targetSets, 0)}{' '}
                  séries-alvo
                </span>
                <ArrowUpRight size={20} />
              </div>
            </Link>
          ))}
      </div>
      <SchedulePanel />
      {!program && (
        <Empty title="Nenhum programa ativo.">
          <Link className="primary" to="/periodizacao">
            Criar programa
          </Link>
        </Empty>
      )}
      {creating && (
        <Modal
          title="Criar treino personalizado"
          onClose={() => setCreating(false)}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              create.mutate();
            }}
          >
            <label>
              Nome
              <input
                required
                maxLength={150}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <p className="muted">
              O treino será adicionado à semana {focus}. Em seguida, escolha
              exercícios do catálogo.
            </p>
            <ErrorMessage error={create.error} />
            <button className="primary" disabled={create.isPending}>
              Criar treino
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}
export function WorkoutDetail() {
  const [searchParams] = useSearchParams();
  const { id } = useParams();
  const nav = useNavigate();
  const { program, weekNumber, setWeekNumber, refresh } = useTraining();
  const workout = useQuery({
    queryKey: ['workout', id],
    queryFn: () => api<Workout>(`/workouts/${id}`),
  });
  const [editing, setEditing] = useState<Prescription | 'new' | null>(null);
  const [remove, setRemove] = useState<Prescription | null>(null);
  const [drag, setDrag] = useState<string | null>(null);
  const [key] = useState(() => crypto.randomUUID());
  const begin = useMutation({
    mutationFn: () =>
      api<Session>('/sessions', 'POST', {
        workoutTemplateId: id,
        weekNumber,
        idempotencyKey: key,
        scheduleId: searchParams.get('agendamento') ?? undefined,
      }),
    onSuccess: (s) => {
      void refresh();
      nav(`/sessao/${s.id}`);
    },
  });
  const reorder = useMutation({
    mutationFn: (ids: string[]) =>
      api(`/workouts/${id}/reorder`, 'PATCH', { ids }),
    onSuccess: () => refresh(),
  });
  const deletion = useMutation({
    mutationFn: () => api(`/workouts/${id}/exercises/${remove?.id}`, 'DELETE'),
    onSuccess: async () => {
      setRemove(null);
      await refresh();
    },
  });
  if (workout.isPending) return <p>Carregando treino…</p>;
  if (!workout.data) return <ErrorMessage error={workout.error} />;
  const w = workout.data;
  const week = program?.weeks.find((a) => a.weekNumber === weekNumber);
  const compatible = week?.focus === w.focus;
  const move = (from: string, to: string) => {
    const ids = w.exercises.map((e) => e.id);
    const a = ids.indexOf(from);
    const b = ids.indexOf(to);
    if (a < 0 || b < 0 || a === b) return;
    ids.splice(a, 1);
    ids.splice(b, 0, from);
    reorder.mutate(ids);
  };
  return (
    <>
      <Link className="subtle-link" to="/treinos">
        ← Meus treinos
      </Link>
      <PageTitle
        eyebrow={`SEMANA ${w.focus} · DIA ${w.dayNumber}`}
        title={w.name}
        description={w.description}
        action={
          <button
            className="primary"
            disabled={begin.isPending || !compatible || !w.exercises.length}
            onClick={() => begin.mutate()}
          >
            <Play size={17} />
            {begin.isPending ? 'Iniciando…' : 'Iniciar treino'}
          </button>
        }
      />
      {!compatible && (
        <div className="notice">
          Este treino é do foco {w.focus}. Selecione uma semana correspondente:{' '}
          <select
            aria-label="Escolher semana compatível"
            value=""
            onChange={(e) => setWeekNumber(Number(e.target.value))}
          >
            <option value="" disabled>
              Selecionar semana
            </option>
            {program?.weeks
              .filter(
                (a) =>
                  a.weekNumber <= program.totalWeeks && a.focus === w.focus,
              )
              .map((a) => (
                <option value={a.weekNumber} key={a.id}>
                  Semana {a.weekNumber}
                </option>
              ))}
          </select>
        </div>
      )}
      <ErrorMessage error={begin.error ?? reorder.error} />
      <div className="section-heading">
        <div>
          <h2>Prescrição do treino</h2>
          <p>
            {week?.volumeRule === 'target'
              ? 'Volume-alvo individual'
              : `${week?.setsOverride ?? 2} séries por exercício nesta semana`}{' '}
            · RIR {week?.rirMin}–{week?.rirMax}
          </p>
        </div>
        <AddButton onClick={() => setEditing('new')}>
          Adicionar exercício
        </AddButton>
      </div>
      <div className="exercise-list">
        {w.exercises.map((e, i) => (
          <article
            className="panel exercise-item"
            key={e.id}
            draggable={!reorder.isPending}
            onDragStart={() => setDrag(e.id)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              if (drag) move(drag, e.id);
              setDrag(null);
            }}
          >
            <GripVertical size={18} className="muted" />
            <span className="exercise-index">
              {String(i + 1).padStart(2, '0')}
            </span>
            <div className="exercise-summary">
              <span className="eyebrow">{e.exercise.primaryMuscle.name}</span>
              <h3>{e.exercise.name}</h3>
              <p>
                {e.targetSets} séries-alvo · {e.minReps}–{e.maxReps} reps ·{' '}
                {e.targetRirMin}–{e.targetRirMax} RIR{' '}
                <span>
                  <Clock size={13} />
                  {e.restSeconds}
                  {e.restMaxSeconds !== e.restSeconds
                    ? `–${e.restMaxSeconds}`
                    : ''}
                  s
                </span>
              </p>
              {e.futureOverride && (
                <small className="accent">
                  Há uma prescrição diferente para próximas sessões.
                </small>
              )}
              {e.notes && <p>{e.notes}</p>}
            </div>
            <div className="exercise-actions">
              <button
                className="icon-button"
                aria-label="Mover para cima"
                disabled={i === 0 || reorder.isPending}
                onClick={() => move(e.id, w.exercises[i - 1].id)}
              >
                <ArrowUp size={16} />
              </button>
              <button
                className="icon-button"
                aria-label="Mover para baixo"
                disabled={i === w.exercises.length - 1 || reorder.isPending}
                onClick={() => move(e.id, w.exercises[i + 1].id)}
              >
                <ArrowDown size={16} />
              </button>
              <button
                className="icon-button"
                aria-label={`Editar ${e.exercise.name}`}
                onClick={() => setEditing(e)}
              >
                <Pencil size={16} />
              </button>
              <button
                className="icon-button danger"
                aria-label={`Remover ${e.exercise.name}`}
                onClick={() => setRemove(e)}
              >
                <Trash2 size={16} />
              </button>
            </div>
          </article>
        ))}
      </div>
      {!w.exercises.length && (
        <Empty title="Monte seu treino.">
          <button onClick={() => setEditing('new')}>
            <Plus size={16} />
            Adicionar primeiro exercício
          </button>
        </Empty>
      )}
      {editing && (
        <PrescriptionEditor
          item={editing === 'new' ? undefined : editing}
          path={`/workouts/${id}/exercises${editing === 'new' ? '' : `/${editing.id}`}`}
          onClose={() => setEditing(null)}
          onSaved={refresh}
        />
      )}
      {remove && (
        <Modal title="Remover exercício?" onClose={() => setRemove(null)}>
          <p>
            {remove.exercise.name} será removido do modelo. Sessões já iniciadas
            e o histórico serão preservados.
          </p>
          <ErrorMessage error={deletion.error} />
          <div className="modal-actions">
            <button onClick={() => setRemove(null)}>Cancelar</button>
            <button
              className="danger"
              disabled={deletion.isPending}
              onClick={() => deletion.mutate()}
            >
              Remover exercício
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
