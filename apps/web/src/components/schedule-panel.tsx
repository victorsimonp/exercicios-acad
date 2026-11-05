import { useState } from 'react';
import { Link } from 'react-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import type { Schedule } from '@ht/shared';
import { CalendarPlus } from 'lucide-react';
import { useTraining } from '../app/context';
import { api } from '../services/api';
import { date, ErrorMessage, Modal } from './common';
export const scheduleLabel = (status: string) =>
  ({
    completed: 'Concluído',
    scheduled: 'Agendado',
    rescheduled: 'Reagendado',
    missed: 'Não realizado',
    cancelled: 'Cancelado',
  })[status] ?? status;
export function SchedulePanel() {
  const { program, refresh } = useTraining();
  const [editing, setEditing] = useState<Schedule | 'new' | null>(null);
  const q = useQuery({
    queryKey: ['schedules'],
    queryFn: () => api<Schedule[]>('/schedules'),
  });
  const cancel = useMutation({
    mutationFn: (id: string) =>
      api(`/schedules/${id}`, 'PATCH', { status: 'cancelled' }),
    onSuccess: refresh,
  });
  return (
    <section className="panel schedule-panel">
      <div className="section-heading">
        <div>
          <h2>Agenda de treinos</h2>
          <p>Planeje seus dias e acompanhe sua adesão ao programa.</p>
        </div>
        <button disabled={!program} onClick={() => setEditing('new')}>
          <CalendarPlus size={16} />
          Agendar
        </button>
      </div>
      <ErrorMessage error={q.error ?? cancel.error} />
      {q.data?.length ? (
        q.data.map((s) => (
          <div className="schedule-row" key={s.id}>
            <span className="day-marker">
              {date(s.scheduledDate).slice(0, 2)}
            </span>
            <div>
              <strong>{s.workout.name}</strong>
              <p>
                {date(s.scheduledDate)} · Foco {s.workout.focus} ·{' '}
                <span className={s.status === 'missed' ? 'danger' : ''}>
                  {scheduleLabel(s.status)}
                </span>
              </p>
              {s.previousDates.length > 0 && (
                <small className="muted">
                  Reagendado de {s.previousDates.map(date).join(', ')}
                </small>
              )}
            </div>
            <div className="button-group">
              {s.sessionId ? (
                <Link className="subtle-link" to={`/sessao/${s.sessionId}`}>
                  Ver sessão ↗
                </Link>
              ) : (
                s.status !== 'cancelled' && (
                  <>
                    <Link
                      className="subtle-link"
                      to={`/treinos/${s.workoutTemplateId}?agendamento=${s.id}`}
                    >
                      Iniciar ↗
                    </Link>
                    <button
                      className="text-button"
                      onClick={() => setEditing(s)}
                    >
                      Reagendar
                    </button>
                    <button
                      className="text-button muted"
                      disabled={cancel.isPending}
                      onClick={() => cancel.mutate(s.id)}
                    >
                      Cancelar
                    </button>
                  </>
                )
              )}
            </div>
          </div>
        ))
      ) : (
        <p className="muted">
          Sem agendamentos. Escolha um dia para o próximo treino; sessões não
          realizadas serão indicadas após o dia planejado.
        </p>
      )}
      {editing && (
        <ScheduleForm
          schedule={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
          onSaved={refresh}
        />
      )}
    </section>
  );
}
function ScheduleForm({
  schedule,
  onClose,
  onSaved,
}: {
  schedule?: Schedule;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const { program } = useTraining();
  const [workout, setWorkout] = useState(
    schedule?.workoutTemplateId ?? program?.workouts[0]?.id ?? '',
  );
  const [when, setWhen] = useState(
    schedule?.scheduledDate.slice(0, 10) ??
      new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }),
  );
  const mutation = useMutation({
    mutationFn: () =>
      api(
        schedule ? `/schedules/${schedule.id}` : '/schedules',
        schedule ? 'PATCH' : 'POST',
        { workoutTemplateId: workout, scheduledDate: `${when}T03:00:00.000Z` },
      ),
    onSuccess: async () => {
      await onSaved();
      onClose();
    },
  });
  return (
    <Modal
      title={schedule ? 'Reagendar treino' : 'Agendar treino'}
      onClose={onClose}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate();
        }}
      >
        <label>
          Treino
          <select
            disabled={!!schedule}
            value={workout}
            onChange={(e) => setWorkout(e.target.value)}
          >
            {program?.workouts.map((w) => (
              <option key={w.id} value={w.id}>
                {w.focus} · Dia {w.dayNumber} · {w.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Data
          <input
            required
            type="date"
            value={when}
            onChange={(e) => setWhen(e.target.value)}
          />
        </label>
        <ErrorMessage error={mutation.error} />
        <button className="primary" disabled={mutation.isPending}>
          Salvar agendamento
        </button>
      </form>
    </Modal>
  );
}
