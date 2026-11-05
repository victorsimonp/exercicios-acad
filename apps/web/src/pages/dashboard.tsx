import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  Clock3,
  Flame,
  Play,
  Target,
  Trophy,
  Weight,
} from 'lucide-react';
import type { Analytics, Paginated, Session } from '@ht/shared';
import { api } from '../services/api';
import { useTraining } from '../app/context';
import {
  date,
  Empty,
  ErrorMessage,
  number,
  PageTitle,
} from '../components/common';
export function Dashboard() {
  const { user, program, weekNumber } = useTraining();
  const week = program?.weeks.find((w) => w.weekNumber === weekNumber);
  const analytics = useQuery({
    queryKey: ['analytics'],
    queryFn: () => api<Analytics>('/analytics/dashboard'),
  });
  const history = useQuery({
    queryKey: ['recent-sessions'],
    queryFn: () => api<Paginated<Session>>('/sessions?pageSize=5'),
  });
  const stats = analytics.data;
  const plannedSessions = useQuery({
    queryKey: ['week-sessions', program?.id, weekNumber],
    queryFn: () =>
      api<Paginated<Session>>(
        `/sessions?programId=${program?.id}&weekNumber=${weekNumber}&status=completed&pageSize=100`,
      ),
    enabled: !!program,
  });
  const completedDays = new Set(
    plannedSessions.data?.items
      .filter(
        (s) =>
          s.status === 'completed' &&
          s.weekNumberSnapshot === weekNumber &&
          s.focusSnapshot === week?.focus,
      )
      .map((s) => s.workoutTemplateId),
  );
  const next =
    program?.workouts.find(
      (w) => w.focus === week?.focus && !completedDays.has(w.id),
    ) ?? program?.workouts.find((w) => w.focus === week?.focus);
  const active = history.data?.items.find((s) => s.status !== 'completed');
  return (
    <>
      <PageTitle
        eyebrow="SEU PROGRESSO, UM DIA DE CADA VEZ"
        title={`Vamos evoluir, ${user.name.split(' ')[0]}.`}
        description="Um bom treino começa com um plano. O seu está aqui."
        action={
          <span className="date-label">
            <CalendarDays size={16} />
            {new Date().toLocaleDateString('pt-BR', {
              timeZone: 'America/Sao_Paulo',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </span>
        }
      />
      <ErrorMessage error={analytics.error ?? history.error} />
      <section className="hero-panel">
        <div className="hero-copy">
          <div className="pill">
            <span className="status-dot" /> SEMANA {weekNumber} DE{' '}
            {program?.totalWeeks ?? 8}
            <span className="pill-divider" />
            FOCO {week?.focus ?? 'A'}
          </div>
          <p className="hero-kicker">
            {active ? 'CONTINUE DE ONDE PAROU' : 'SEU PRÓXIMO TREINO'}
          </p>
          <h2>{active?.nameSnapshot ?? next?.name ?? 'Seu próximo ciclo'}</h2>
          <p>
            {next?.description ??
              'Crie um novo programa para começar a treinar.'}
          </p>
          <div className="hero-meta">
            <span>
              <Activity size={16} />
              {next?.exercises.length ?? 0} exercícios
            </span>
            <span>
              <Target size={16} />
              {week?.rirMin ?? 1}–{week?.rirMax ?? 2} RIR
            </span>
            <span>
              <CalendarDays size={16} />
              {week?.isDeload ? 'Deload' : 'Hipertrofia'}
            </span>
          </div>
          <Link
            className="primary"
            to={active ? `/sessao/${active.id}` : '/iniciar'}
          >
            <Play size={16} fill="currentColor" />
            {active ? 'Continuar treino' : 'Iniciar treino'}
            <ArrowRight size={18} />
          </Link>
        </div>
        <div className="hero-visual" aria-hidden="true">
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <div className="hero-letter">{week?.focus ?? 'A'}</div>
          <span className="hero-visual-label">FOCO DA SEMANA</span>
        </div>
      </section>
      <section className="stats-grid">
        {[
          {
            label: 'Treinos na semana',
            value: `${stats?.weeklyCompleted ?? 0}`,
            unit: '/ 4',
            icon: CalendarDays,
            foot: 'Consistência constrói resultados',
          },
          {
            label: 'Séries de trabalho',
            value: number(stats?.weeklySets ?? 0),
            unit: '',
            icon: Activity,
            foot: 'Realizadas nesta semana',
          },
          {
            label: 'Volume acumulado',
            value: number((stats?.volume ?? 0) / 1000),
            unit: 't',
            icon: Weight,
            foot: 'Carga × repetições de trabalho',
          },
          {
            label: 'Tempo médio',
            value: `${stats?.averageMinutes ?? 0}`,
            unit: 'min',
            icon: Clock3,
            foot:
              stats?.adherencePercent == null
                ? 'Por treino concluído'
                : `${stats.adherencePercent}% de adesão aos agendamentos`,
          },
        ].map((m) => (
          <article className="stat-card" key={m.label}>
            <div>
              <span>{m.label}</span>
              <m.icon size={18} />
            </div>
            <strong>
              {analytics.isPending ? '—' : m.value}
              <small>{m.unit}</small>
            </strong>
            <p>{m.foot}</p>
          </article>
        ))}
      </section>
      <div className="dashboard-columns">
        <section className="panel">
          <div className="section-heading">
            <div>
              <h2>Seu plano da semana</h2>
              <p>Quatro dias. Um objetivo: evoluir.</p>
            </div>
            <Link className="subtle-link" to="/treinos">
              Ver treinos <ArrowUpRight size={16} />
            </Link>
          </div>
          {program?.workouts
            .filter((w) => w.focus === week?.focus)
            .map((w) => (
              <Link className="plan-row" to={`/treinos/${w.id}`} key={w.id}>
                <span
                  className={`day-marker ${completedDays.has(w.id) ? 'done' : ''}`}
                >
                  {completedDays.has(w.id) ? (
                    <Check size={18} />
                  ) : (
                    `0${w.dayNumber}`
                  )}
                </span>
                <div>
                  <strong>{w.name}</strong>
                  <p>
                    {w.exercises.length} exercícios · {w.description}
                  </p>
                </div>
                <span className="plan-row-status">
                  {completedDays.has(w.id) ? 'Concluído' : 'Planejado'}
                </span>
                <ArrowUpRight size={17} />
              </Link>
            ))}
        </section>
        <section className="panel focus-panel">
          <div className="section-heading">
            <h2>
              <Flame size={18} /> Foco da semana {week?.focus}
            </h2>
            <span className="tiny-badge">
              {week?.isDeload ? 'RECUPERAÇÃO' : 'HIPERTROFIA'}
            </span>
          </div>
          <h3>
            {week?.isDeload
              ? 'Recupere para progredir.'
              : week?.focus === 'B'
                ? 'Novos ângulos. Mesmo objetivo.'
                : 'Construa uma base sólida.'}
          </h3>
          <p className="muted">
            {week?.focus === 'B'
              ? 'Ênfase em peitoral médio/inferior, largura dorsal, deltoide anterior e cadeia posterior.'
              : 'Ênfase em peitoral superior, espessura dorsal, deltoides lateral/posterior e quadríceps.'}
          </p>
          <div className="focus-detail">
            <Target size={20} />
            <div>
              <strong>
                {week?.rirMin}–{week?.rirMax} repetições em reserva
              </strong>
              <p>
                Termine a série sentindo que conseguiria realizar essa
                quantidade de repetições a mais.
              </p>
            </div>
          </div>
          <Link className="subtle-link" to="/periodizacao">
            Entender meu ciclo <ArrowRight size={16} />
          </Link>
        </section>
      </div>
      <div className="dashboard-columns">
        <section className="panel">
          <div className="section-heading">
            <div>
              <h2>Últimas atividades</h2>
              <p>Cada sessão faz parte da sua história.</p>
            </div>
            <Link className="subtle-link" to="/historico">
              Ver histórico <ArrowUpRight size={16} />
            </Link>
          </div>
          {history.data?.items.length ? (
            history.data.items.slice(0, 3).map((s) => (
              <Link className="activity-row" to={`/sessao/${s.id}`} key={s.id}>
                <span className="activity-icon">
                  <Activity size={18} />
                </span>
                <div>
                  <strong>{s.nameSnapshot}</strong>
                  <p>
                    {date(s.startedAt)} · Semana {s.weekNumberSnapshot} · Foco{' '}
                    {s.focusSnapshot}
                  </p>
                </div>
                <span className="tiny-badge">
                  {s.status === 'completed' ? 'Concluído' : 'Em andamento'}
                </span>
              </Link>
            ))
          ) : (
            <Empty title="Seu primeiro treino fica na história.">
              <p>Inicie uma sessão e seus resultados aparecerão aqui.</p>
            </Empty>
          )}
        </section>
        <section className="panel">
          <div className="section-heading">
            <h2>
              <Trophy size={18} /> Suas conquistas
            </h2>
          </div>
          {stats?.records.length ? (
            stats.records.slice(-3).map((r, i) => (
              <div className="record-row" key={i}>
                <Trophy size={19} />
                <div>
                  <strong>{r.name}</strong>
                  <p>
                    {number(r.weight)} kg × {r.reps} repetições
                  </p>
                </div>
              </div>
            ))
          ) : (
            <Empty title="O próximo recorde é seu.">
              <p>Registre suas cargas para acompanhar suas melhores marcas.</p>
            </Empty>
          )}
        </section>
      </div>
      <p className="metric-note">
        Volume de carga não mede diretamente estímulo hipertrófico. Compare o
        mesmo exercício e a mesma base de carga.
      </p>
    </>
  );
}
