import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { Analytics, Exercise, Paginated, Schedule } from '@ht/shared';
import { api, queryString } from '../services/api';
import {
  basisLabel,
  date,
  Empty,
  ErrorMessage,
  number,
  PageTitle,
} from '../components/common';
import { SchedulePanel, scheduleLabel } from '../components/schedule-panel';
export function AnalyticsPage() {
  const [exerciseId, setExerciseId] = useState('');
  const [basis, setBasis] = useState('total');
  const schedules = useQuery({
    queryKey: ['schedules'],
    queryFn: () => api<Schedule[]>('/schedules'),
  });
  const catalog = useQuery({
    queryKey: ['catalog'],
    queryFn: () => api<Paginated<Exercise>>('/exercises?pageSize=100'),
  });
  const q = useQuery({
    queryKey: ['analytics', exerciseId],
    queryFn: () =>
      api<Analytics>(`/analytics/dashboard${queryString({ exerciseId })}`),
  });
  const data = q.data;
  const exercise = catalog.data?.items.find((e) => e.id === exerciseId);
  const points = data?.points.filter((p) => p.weightBasis === basis) ?? [];
  const muscle = Object.entries(data?.muscleVolume ?? {}).map(([name, v]) => ({
    name,
    ...v,
  }));
  return (
    <>
      <PageTitle
        eyebrow="TRANSFORME REGISTROS EM DIREÇÃO"
        title="Sua evolução"
        description="Resultados reais. Tendências que ajudam a planejar o próximo passo."
      />
      <ErrorMessage error={q.error} />
      <section className="stats-grid">
        {[
          ['Treinos concluídos', data?.completed ?? 0],
          ['Séries de trabalho', data?.totalSets ?? 0],
          ['Volume total (kg)', number(data?.volume ?? 0)],
          ['Tempo médio (min)', data?.averageMinutes ?? 0],
        ].map(([label, value]) => (
          <div className="stat-card" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </section>
      <section className="panel">
        <div className="section-heading">
          <div>
            <h2>Progressão de carga</h2>
            <p>Melhor série por sessão do mesmo exercício.</p>
          </div>
          <select
            aria-label="Exercício do gráfico"
            value={exerciseId}
            onChange={(e) => {
              setExerciseId(e.target.value);
              setBasis(
                catalog.data?.items.find((item) => item.id === e.target.value)
                  ?.weightBasis ?? 'total',
              );
            }}
          >
            <option value="">Selecione um exercício</option>
            {catalog.data?.items.map((e) => (
              <option value={e.id} key={e.id}>
                {e.name}
              </option>
            ))}
          </select>
          <select
            aria-label="Base de carga do gráfico"
            value={basis}
            onChange={(e) => setBasis(e.target.value)}
          >
            <option value="total">Carga total</option>
            <option value="per_side">Por lado</option>
            <option value="per_dumbbell">Por halter</option>
          </select>
        </div>
        {points.length ? (
          <>
            <p className="muted">
              {exercise?.name} · {basisLabel(basis)}
            </p>
            <div className="chart">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={points.map((p) => ({ ...p, date: date(p.date) }))}
                >
                  <CartesianGrid stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="date" stroke="var(--muted)" fontSize={12} />
                  <YAxis stroke="var(--muted)" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      background: 'var(--panel)',
                      border: '1px solid var(--border)',
                      borderRadius: 8,
                    }}
                  />
                  <Line
                    dataKey="weight"
                    name="Carga (kg)"
                    stroke="var(--accent)"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Carga</th>
                    <th>Repetições</th>
                    <th>RIR</th>
                  </tr>
                </thead>
                <tbody>
                  {points.map((p, i) => (
                    <tr key={i}>
                      <td>{date(p.date)}</td>
                      <td>{p.weight} kg</td>
                      <td>{p.reps}</td>
                      <td>{p.rir}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <Empty
            title={
              exerciseId
                ? 'Ainda sem registros para este exercício.'
                : 'Escolha um exercício para acompanhar suas cargas.'
            }
          />
        )}
      </section>
      <div className="dashboard-columns">
        <section className="panel">
          <div className="section-heading">
            <h2>Séries por grupo muscular</h2>
          </div>
          {muscle.length ? (
            <div className="chart">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={muscle} layout="vertical">
                  <CartesianGrid stroke="var(--border)" horizontal={false} />
                  <XAxis
                    type="number"
                    stroke="var(--muted)"
                    allowDecimals={false}
                  />
                  <YAxis
                    dataKey="name"
                    type="category"
                    width={100}
                    stroke="var(--muted)"
                    fontSize={11}
                  />
                  <Tooltip
                    contentStyle={{
                      background: 'var(--panel)',
                      border: '1px solid var(--border)',
                    }}
                  />
                  <Bar
                    dataKey="direct"
                    name="Séries diretas"
                    fill="var(--accent)"
                    radius={[0, 4, 4, 0]}
                  />
                  <Bar
                    dataKey="secondary"
                    name="Participação secundária estimada"
                    fill="#8191d5"
                    radius={[0, 4, 4, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <Empty title="Seu volume muscular aparecerá aqui." />
          )}
          <p className="metric-note">{data?.secondaryNote}</p>
        </section>
        <section className="panel">
          <h2>Comparativo A/B</h2>
          <p className="muted">
            Volume de carga por sessão, separado por foco.
          </p>
          {data?.bySession.length ? (
            <div className="chart">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={data.bySession.map((s) => ({
                    date: s.date,
                    A: s.focus === 'A' ? s.volume : 0,
                    B: s.focus === 'B' ? s.volume : 0,
                  }))}
                >
                  <CartesianGrid stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="date" stroke="var(--muted)" fontSize={10} />
                  <YAxis stroke="var(--muted)" fontSize={11} />
                  <Tooltip
                    contentStyle={{
                      background: 'var(--panel)',
                      border: '1px solid var(--border)',
                    }}
                  />
                  <Bar dataKey="A" fill="var(--accent)" />
                  <Bar dataKey="B" fill="#8191d5" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <Empty title="Registre treinos A e B para comparar." />
          )}
        </section>
      </div>
      <section className="panel">
        <h2>Frequência e consistência</h2>
        <p className="muted">
          Dias com sessões concluídas, treinos não realizados e reagendamentos
          registrados na sua agenda.
        </p>
        <div className="attendance-grid">
          {Array.from({ length: 35 }, (_, i) => {
            const d = new Date();
            d.setDate(d.getDate() - 34 + i);
            const key = d.toLocaleDateString('en-CA', {
              timeZone: 'America/Sao_Paulo',
            });
            const sessions = data?.attendance.filter((s) => s.date === key);
            const planned = schedules.data?.filter(
              (s) =>
                new Date(s.scheduledDate).toLocaleDateString('en-CA', {
                  timeZone: 'America/Sao_Paulo',
                }) === key &&
                s.status !== 'cancelled' &&
                s.status !== 'completed',
            );
            return (
              <div
                key={key}
                className={`attendance-day ${sessions?.length ? 'trained' : planned?.some((s) => s.status === 'missed') ? 'missed' : ''}`}
                title={`${key}: ${sessions?.length ?? 0} sessões`}
              >
                <small>
                  {d.toLocaleDateString('pt-BR', { weekday: 'short' })}
                </small>
                <strong>{d.getDate()}</strong>
                {sessions?.map((s) => (
                  <Link key={s.sessionId} to={`/sessao/${s.sessionId}`}>
                    {s.focus}
                  </Link>
                ))}
                {planned?.map((s) => (
                  <small key={s.id} title={s.workout.name}>
                    {scheduleLabel(s.status)}
                  </small>
                ))}
              </div>
            );
          })}
        </div>
      </section>
      <SchedulePanel />
      <p className="metric-note">
        Volume de carga = soma de carga × repetições das séries de trabalho
        concluídas. Carga por halter e por lado é multiplicada por dois; a base
        por lado exclui a barra. Essa métrica não mede diretamente estímulo
        hipertrófico e não deve comparar exercícios distintos.
      </p>
    </>
  );
}
