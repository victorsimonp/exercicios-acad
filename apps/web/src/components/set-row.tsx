import { useEffect, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import type { ExerciseSet } from '@ht/shared';
import { Check, RotateCcw } from 'lucide-react';
import { api } from '../services/api';
import { basisLabel } from './common';
import { draftSchema } from '../lib/validation';
type Draft = {
  weight: number | null;
  actualReps: number | null;
  rir: number | null;
  completed: boolean;
  techniqueOk: boolean;
  notes: string;
  weightBasis: string;
  revision: number;
};
const draftFrom = (set: ExerciseSet): Draft => ({
  weight: set.weight === null ? null : Number(set.weight),
  actualReps: set.actualReps,
  rir: set.rir,
  completed: set.completed,
  techniqueOk: set.techniqueOk,
  notes: set.notes,
  weightBasis: set.weightBasis,
  revision: set.revision,
});
export function SetRow({
  set,
  sessionId,
  restSeconds,
  onComplete,
  onDirty,
  onSaved,
  historical = false,
}: {
  set: ExerciseSet;
  sessionId: string;
  restSeconds: number;
  onComplete: (seconds: number) => void;
  onDirty: (id: string, dirty: boolean) => void;
  onSaved?: () => void;
  historical?: boolean;
}) {
  const key = `ht-draft:${sessionId}:${set.id}`;
  const [draft, setDraft] = useState<Draft>(() => {
    try {
      const local = JSON.parse(
        localStorage.getItem(key) ?? 'null',
      ) as Draft | null;
      return local ?? draftFrom(set);
    } catch {
      return draftFrom(set);
    }
  });
  const [saved, setSaved] = useState(JSON.stringify(draftFrom(set)));
  const [retry, setRetry] = useState(0);
  const [detail, setDetail] = useState(false);
  const current = JSON.stringify(draft);
  const dirty = current !== saved;
  const validation = draftSchema.safeParse(draft);
  const alive = useRef(true);
  const mutation = useMutation({
    mutationKey: ['set-save'],
    mutationFn: (d: Draft) =>
      api<ExerciseSet>(`/sessions/${sessionId}/sets/${set.id}`, 'PATCH', d),
    onSuccess: (result, sent) => {
      const next = draftFrom(result);
      setDraft(next);
      setSaved(JSON.stringify(next));
      localStorage.removeItem(key);
      if (sent.completed && !set.completed && !historical)
        onComplete(restSeconds);
      onSaved?.();
    },
  });
  useEffect(() => {
    onDirty(set.id, dirty || mutation.isPending);
    return () => onDirty(set.id, false);
  }, [dirty, mutation.isPending, set.id, onDirty]);
  useEffect(() => {
    alive.current = true;
    if (!dirty || mutation.isPending || mutation.isError || !validation.success)
      return;
    localStorage.setItem(key, current);
    const timer = window.setTimeout(() => {
      if (alive.current) mutation.mutate(JSON.parse(current) as Draft);
    }, 800);
    return () => {
      alive.current = false;
      window.clearTimeout(timer);
    };
  }, [current, dirty, mutation.isPending, mutation.isError, retry]); // mutation is stable through its mutate method
  const update = (patch: Partial<Draft>) => {
    const next = { ...draft, ...patch };
    setDraft(next);
    localStorage.setItem(key, JSON.stringify(next));
  };
  const numeric = (value: string) => (value === '' ? null : Number(value));
  return (
    <div
      className={`set-block ${set.setType !== 'work' ? 'preparatory' : ''} ${draft.completed ? 'set-completed' : ''}`}
    >
      <div className="set-row">
        <span className="set-kind">
          <strong>
            {set.setType === 'warmup'
              ? 'A'
              : set.setType === 'feeder'
                ? 'AP'
                : set.setNumber}
          </strong>
          <small>
            {set.setType === 'warmup'
              ? 'Aquec.'
              : set.setType === 'feeder'
                ? 'Aprox.'
                : 'Trabalho'}
          </small>
        </span>
        <label className="set-field">
          <span>{basisLabel(draft.weightBasis)}</span>
          <input
            aria-label={`Carga série ${set.setNumber}`}
            disabled={mutation.isPending}
            type="number"
            inputMode="decimal"
            step="0.001"
            min="0"
            max="2000"
            placeholder="—"
            value={draft.weight ?? ''}
            onChange={(e) => update({ weight: numeric(e.target.value) })}
          />
        </label>
        <label className="set-field">
          <span>
            Reps · {set.prescribedRepsMin}–{set.prescribedRepsMax}
          </span>
          <input
            aria-label={`Repetições série ${set.setNumber}`}
            disabled={mutation.isPending}
            type="number"
            inputMode="numeric"
            min="0"
            max="200"
            placeholder="—"
            value={draft.actualReps ?? ''}
            onChange={(e) => update({ actualReps: numeric(e.target.value) })}
          />
        </label>
        <label className="set-field">
          <span>RIR</span>
          <input
            aria-label={`RIR série ${set.setNumber}`}
            disabled={mutation.isPending}
            type="number"
            inputMode="numeric"
            min="0"
            max="10"
            placeholder="—"
            value={draft.rir ?? ''}
            onChange={(e) => update({ rir: numeric(e.target.value) })}
          />
        </label>
        <button
          aria-label={draft.completed ? 'Desmarcar série' : 'Concluir série'}
          aria-pressed={draft.completed}
          className={`complete-set ${draft.completed ? 'checked' : ''}`}
          disabled={
            mutation.isPending ||
            (!draft.completed &&
              (draft.weight === null ||
                !draft.actualReps ||
                draft.rir === null))
          }
          onClick={() => update({ completed: !draft.completed })}
        >
          <Check size={20} />
        </button>
      </div>
      <div className="set-row-footer">
        <button className="text-button" onClick={() => setDetail(!detail)}>
          {detail ? 'Ocultar detalhes' : 'Nota e base de carga'}
        </button>
        <span className={mutation.isError ? 'danger' : 'muted'} role="status">
          {mutation.isPending
            ? 'Salvando…'
            : mutation.isError
              ? 'Não salvo'
              : dirty
                ? 'Alterações pendentes'
                : 'Salvo'}
        </span>
      </div>
      {detail && (
        <div className="set-details">
          <label>
            Observação
            <input
              value={draft.notes}
              disabled={mutation.isPending}
              onChange={(e) => update({ notes: e.target.value })}
            />
          </label>
          <label>
            Base da carga
            <select
              disabled={mutation.isPending}
              value={draft.weightBasis}
              onChange={(e) => update({ weightBasis: e.target.value })}
            >
              <option value="total">Total (inclua a barra)</option>
              <option value="per_side">Por lado (sem peso da barra)</option>
              <option value="per_dumbbell">Por halter</option>
            </select>
          </label>
          <label className="check-label">
            <input
              type="checkbox"
              disabled={mutation.isPending}
              checked={draft.techniqueOk}
              onChange={(e) => update({ techniqueOk: e.target.checked })}
            />
            Técnica adequada
          </label>
        </div>
      )}
      {mutation.error && (
        <div className="error">
          {mutation.error.message}
          <button
            onClick={() => {
              mutation.reset();
              setRetry((r) => r + 1);
            }}
          >
            Tentar salvar
          </button>
          <button
            onClick={() => {
              const next = draftFrom(set);
              setDraft(next);
              setSaved(JSON.stringify(next));
              localStorage.removeItem(key);
              mutation.reset();
              onSaved?.();
            }}
          >
            <RotateCcw size={14} />
            Descartar rascunho
          </button>
        </div>
      )}
      {dirty && !validation.success && (
        <p className="error" role="alert">
          {validation.error.issues[0]?.message}
        </p>
      )}
    </div>
  );
}
