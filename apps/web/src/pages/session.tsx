import { useCallback, useState } from 'react';
import { Link, useParams } from 'react-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import type {
  Analytics,
  Prescription,
  Session as SessionType,
  SessionExercise,
} from '@ht/shared';
import { Check, Clock, Pause, Pencil, Play, Plus, Trophy } from 'lucide-react';
import { api } from '../services/api';
import { useTraining } from '../app/context';
import {
  basisLabel,
  date,
  ErrorMessage,
  Modal,
  PageTitle,
} from '../components/common';
import { SetRow } from '../components/set-row';
import { RestTimer } from '../components/rest-timer';
import { PrescriptionEditor } from '../components/prescription-editor';
function LastPerformance({
  exerciseId,
  sessionId,
}: {
  exerciseId: string;
  sessionId: string;
}) {
  const q = useQuery({
    queryKey: ['last', exerciseId],
    queryFn: () => api<Analytics>(`/analytics/exercises/${exerciseId}`),
  });
  const points = q.data?.points as
    (Analytics['points'][number] & { sessionId: string })[] | undefined;
  const last = points?.filter((p) => p.sessionId !== sessionId).at(-1);
  return (
    <p className="last-performance">
      {last
        ? `Último desempenho: ${last.weight} ${basisLabel(last.weightBasis)} × ${last.reps} reps · ${last.rir} RIR · ${date(last.date)}`
        : 'Sem registro anterior para este exercício.'}
    </p>
  );
}
export function SessionPage() {
  const { id } = useParams();
  const { refresh } = useTraining();
  const [dirty, setDirty] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState(false);
  const [edit, setEdit] = useState<SessionExercise | null>(null);
  const [skip, setSkip] = useState<string | null>(null);
  const query = useQuery({
    queryKey: ['session', id],
    queryFn: () => api<SessionType>(`/sessions/${id}`),
    refetchOnWindowFocus: false,
  });
  const dirtyChange = useCallback(
    (key: string, isDirty: boolean) =>
      setDirty((old) => {
        const next = new Set(old);
        if (isDirty) next.add(key);
        else next.delete(key);
        return next;
      }),
    [],
  );
  const update = useMutation({
    mutationFn: (data: unknown) =>
      api<SessionType>(`/sessions/${id}`, 'PATCH', data),
    onSuccess: () => query.refetch(),
  });
  const complete = useMutation({
    mutationFn: () => api<SessionType>(`/sessions/${id}/complete`, 'POST'),
    onSuccess: async () => {
      setConfirm(false);
      await refresh();
    },
  });
  const add = useMutation({
    mutationFn: (data: unknown) => api(`/sessions/${id}/sets`, 'POST', data),
    onSuccess: () => query.refetch(),
  });
  const persistTimer = (value: string | null) =>
    update.mutate({ restEndsAt: value });
  const skipWarmup = useMutation({
    mutationFn: () =>
      api(`/sessions/${id}/exercises/${skip}/skip-warmup`, 'POST'),
    onSuccess: async () => {
      setSkip(null);
      await query.refetch();
    },
  });
  if (query.isPending) return <p>Carregando sessão…</p>;
  if (!query.data) return <ErrorMessage error={query.error} />;
  const s = query.data;
  const completed = s.status === 'completed';
  const work = s.exercises
    .flatMap((e) => e.sets)
    .filter((a) => a.setType === 'work');
  const done = work.filter((a) => a.completed).length;
  const editPrescription: Omit<Prescription, 'exercise'> | undefined = edit
    ? {
        id: edit.id,
        exerciseId: edit.exerciseId,
        order: edit.order,
        targetSets: edit.prescribedSetsSnapshot,
        minReps: edit.minRepsSnapshot,
        maxReps: edit.maxRepsSnapshot,
        targetRirMin: edit.targetRirMinSnapshot,
        targetRirMax: edit.targetRirMaxSnapshot,
        restSeconds: edit.restSecondsSnapshot,
        restMaxSeconds: edit.restSecondsSnapshot,
        notes: edit.notes,
      }
    : undefined;
  return (
    <>
      <PageTitle
        eyebrow={`SEMANA ${s.weekNumberSnapshot} · FOCO ${s.focusSnapshot}${s.isDeloadSnapshot ? ' · DELOAD' : ''}`}
        title={completed ? 'Treino concluído.' : 'Treino em andamento'}
        description={`${s.nameSnapshot} · Iniciado em ${date(s.startedAt)}`}
        action={
          completed ? (
            <span className="pill">
              <Trophy size={16} />
              HISTÓRICO SALVO
            </span>
          ) : (
            <div className="button-group">
              <button
                disabled={update.isPending || dirty.size > 0}
                onClick={() =>
                  update.mutate({
                    status: s.status === 'paused' ? 'active' : 'paused',
                  })
                }
              >
                {s.status === 'paused' ? (
                  <Play size={16} />
                ) : (
                  <Pause size={16} />
                )}
                {s.status === 'paused' ? 'Continuar' : 'Pausar'}
              </button>
              <button
                className="primary"
                disabled={dirty.size > 0 || complete.isPending}
                onClick={() => setConfirm(true)}
              >
                <Check size={17} />
                Finalizar treino
              </button>
            </div>
          )
        }
      />
      <ErrorMessage error={update.error ?? complete.error ?? add.error} />
      {completed ? (
        <div className="notice">
          Você está visualizando o histórico. Correções nos resultados são
          auditadas e recalculam as sugestões de progressão.
        </div>
      ) : (
        <div className="session-progress">
          <span>
            {done} de {work.length} séries de trabalho salvas
          </span>
          <span>
            {dirty.size > 0
              ? 'Salvando alterações…'
              : 'Todos os registros salvos'}
          </span>
          <div className="progress">
            <span
              style={{
                width: `${work.length ? (done / work.length) * 100 : 0}%`,
              }}
            />
          </div>
        </div>
      )}
      {s.status === 'paused' && (
        <div className="notice">
          Sessão pausada. Seus dados estão salvos; continue quando estiver
          pronto.
        </div>
      )}
      <div className="notice rir-note">
        RIR é quantas repetições você ainda conseguiria fazer com boa técnica. 0
        = falha técnica; 2 = mais duas repetições. Aquecimento e aproximação não
        contam como volume de trabalho.
      </div>
      {s.exercises.map((e, index) => (
        <section className="panel session-exercise" key={e.id}>
          <header>
            <span className="day-marker">
              {String(index + 1).padStart(2, '0')}
            </span>
            <div>
              <span className="eyebrow">{e.muscleSnapshot}</span>
              <h2>{e.exerciseNameSnapshot}</h2>
              <p className="muted">
                {e.prescribedSetsSnapshot} séries · {e.minRepsSnapshot}–
                {e.maxRepsSnapshot} reps · {e.targetRirMinSnapshot}–
                {e.targetRirMaxSnapshot} RIR · <Clock size={13} />
                {e.restSecondsSnapshot}s · {basisLabel(e.weightBasisSnapshot)}
              </p>
            </div>
            {!completed && (
              <button
                className="icon-button"
                aria-label="Editar somente esta sessão"
                disabled={dirty.size > 0}
                onClick={() => setEdit(e)}
              >
                <Pencil size={17} />
              </button>
            )}
          </header>
          <LastPerformance exerciseId={e.exerciseId} sessionId={s.id} />
          {e.notes && <p className="notice">{e.notes}</p>}
          {e.sets.some((a) => a.setType === 'warmup' && !a.skipped) &&
            !completed && (
              <div className="warmup-note">
                Aquecimento sugerido: séries leves de 15–20 reps, referência de
                20–40% da sua carga de trabalho.
                <button className="text-button" onClick={() => setSkip(e.id)}>
                  Pular aquecimento
                </button>
              </div>
            )}
          <div className={s.status === 'paused' ? 'paused-sets' : ''}>
            {e.sets
              .filter((a) => !a.skipped)
              .map((a) => (
                <SetRow
                  key={`${a.id}:${a.revision}`}
                  set={a}
                  sessionId={s.id}
                  restSeconds={e.restSecondsSnapshot}
                  onComplete={(seconds) => {
                    persistTimer(
                      new Date(Date.now() + seconds * 1000).toISOString(),
                    );
                  }}
                  onSaved={() => void query.refetch()}
                  onDirty={dirtyChange}
                  historical={completed}
                />
              ))}
          </div>
          {!completed && (
            <div className="button-group add-sets">
              {(['warmup', 'feeder', 'work'] as const).map((type) => (
                <button
                  key={type}
                  className="text-button"
                  disabled={
                    add.isPending || dirty.size > 0 || s.status === 'paused'
                  }
                  onClick={() =>
                    add.mutate({ sessionExerciseId: e.id, setType: type })
                  }
                >
                  <Plus size={14} />
                  {type === 'warmup'
                    ? 'Aquecimento'
                    : type === 'feeder'
                      ? 'Aproximação'
                      : 'Série de trabalho'}
                </button>
              ))}
            </div>
          )}
        </section>
      ))}
      <section className="panel">
        <h2>Observações da sessão</h2>
        <textarea
          aria-label="Observações da sessão"
          defaultValue={s.notes}
          maxLength={4000}
          placeholder="Como foi o treino? Algum ajuste para a próxima sessão?"
          onBlur={(e) => {
            if (e.target.value !== s.notes)
              update.mutate({ notes: e.target.value });
          }}
        />
        <p className="muted">Salvo ao sair do campo.</p>
      </section>
      {completed && (
        <section className="panel">
          <h2>Próxima exposição: sugestões de progressão</h2>
          <p className="muted">
            Sugestões opcionais; as cargas não são aplicadas automaticamente.
          </p>
          {s.recommendations.map((r) => (
            <div className="recommendation" key={r.id}>
              <strong>
                {
                  s.exercises.find((e) => e.exerciseId === r.exerciseId)
                    ?.exerciseNameSnapshot
                }
              </strong>
              <p>{r.reason}</p>
              {r.suggestedWeight !== null && (
                <p>
                  {r.currentWeight} →{' '}
                  <span className="accent">{r.suggestedWeight} kg</span>
                </p>
              )}
              <RecommendationActions
                id={r.id}
                status={r.status}
                weight={r.suggestedWeight}
                onSaved={refresh}
              />
            </div>
          ))}
          <Link className="primary" to="/historico">
            Ver histórico
          </Link>
        </section>
      )}
      {!completed && (
        <RestTimer
          storageKey={`ht-rest:${s.id}`}
          duration={
            s.exercises
              .flatMap((e) =>
                e.sets
                  .filter((a) => a.completedAt)
                  .map((a) => ({
                    time: new Date(a.completedAt!).getTime(),
                    rest: e.restSecondsSnapshot,
                  })),
              )
              .sort((a, b) => b.time - a.time)[0]?.rest ?? 90
          }
          endsAt={s.restEndsAt}
          persist={persistTimer}
        />
      )}
      {confirm && (
        <Modal title="Finalizar treino?" onClose={() => setConfirm(false)}>
          <p>
            As séries registradas serão salvas no histórico. Séries não
            concluídas ficam identificadas e impedem sugestões de aumento.
          </p>
          <ErrorMessage error={complete.error} />
          <div className="modal-actions">
            <button onClick={() => setConfirm(false)}>
              Continuar treinando
            </button>
            <button
              className="primary"
              disabled={complete.isPending || dirty.size > 0}
              onClick={() => complete.mutate()}
            >
              Concluir e salvar
            </button>
          </div>
        </Modal>
      )}
      {skip && (
        <Modal title="Pular aquecimento?" onClose={() => setSkip(null)}>
          <p>
            As séries não executadas permanecerão identificadas como
            incompletas. Nenhuma carga será preenchida.
          </p>
          <button
            disabled={skipWarmup.isPending || dirty.size > 0}
            onClick={() => skipWarmup.mutate()}
          >
            Confirmar e ocultar aquecimento
          </button>
          <ErrorMessage error={skipWarmup.error} />
        </Modal>
      )}
      {edit && editPrescription && (
        <PrescriptionEditor
          session
          item={editPrescription}
          path={`/sessions/${id}/exercises/${edit.id}`}
          onClose={() => setEdit(null)}
          onSaved={async () => {
            await query.refetch();
          }}
        />
      )}
    </>
  );
}
function RecommendationActions({
  id,
  status,
  weight,
  onSaved,
}: {
  id: string;
  status: string;
  weight: string | null;
  onSaved: () => Promise<void>;
}) {
  const [value, setValue] = useState(weight ?? '');
  const mutate = useMutation({
    mutationFn: (action: string) =>
      api(
        `/progression/recommendations/${id}/${action}`,
        'POST',
        action === 'accept' && value !== ''
          ? { suggestedWeight: Number(value) }
          : {},
      ),
    onSuccess: onSaved,
  });
  return status === 'pending' ? (
    <div>
      <div className="button-group">
        <input
          aria-label="Editar carga sugerida"
          type="number"
          step="0.001"
          min="0"
          max="2000"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <button
          disabled={mutate.isPending || !value}
          onClick={() => mutate.mutate('accept')}
        >
          Aceitar sugestão
        </button>
        <button
          disabled={mutate.isPending}
          onClick={() => mutate.mutate('dismiss')}
        >
          Ignorar
        </button>
      </div>
      <ErrorMessage error={mutate.error} />
    </div>
  ) : (
    <p className="tiny-badge">
      {status === 'accepted' ? 'Sugestão aceita' : 'Sugestão ignorada'}
    </p>
  );
}
