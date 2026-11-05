import { useState } from 'react';
import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { Download, ArrowUpRight } from 'lucide-react';
import type { Exercise, Muscle, Paginated, Session } from '@ht/shared';
import { api, queryString } from '../services/api';
import {
  date,
  Empty,
  ErrorMessage,
  Modal,
  number,
  PageTitle,
} from '../components/common';
function totalVolume(s: Session) {
  return s.exercises
    .flatMap((e) => e.sets)
    .filter((s) => s.completed && s.setType === 'work')
    .reduce(
      (sum, a) =>
        sum +
        Number(a.weight ?? 0) *
          (a.actualReps ?? 0) *
          (a.weightBasis === 'total' ? 1 : 2),
      0,
    );
}
function csvCell(value: unknown) {
  const str = String(value ?? '');
  return `"${(/^[=+@\-\t\r]/.test(str) ? "'" : '') + str.replaceAll('"', '""')}"`;
}
export function HistoryPage() {
  const [focus, setFocus] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [exercise, setExercise] = useState('');
  const [muscle, setMuscle] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string[]>([]);
  const [comparing, setComparing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<Error | null>(null);
  const params = {
    focus,
    from: from ? `${from}T03:00:00.000Z` : '',
    to: to
      ? new Date(
          new Date(`${to}T03:00:00.000Z`).getTime() + 86399999,
        ).toISOString()
      : '',
    exerciseId: exercise,
    muscle,
    page,
    pageSize: 20,
  };
  const q = useQuery({
    queryKey: ['history', params],
    queryFn: () => api<Paginated<Session>>(`/sessions${queryString(params)}`),
  });
  const catalog = useQuery({
    queryKey: ['catalog'],
    queryFn: () => api<Paginated<Exercise>>('/exercises?pageSize=100'),
  });
  const muscles = useQuery({
    queryKey: ['muscles'],
    queryFn: () => api<Muscle[]>('/muscles'),
  });
  const exportCsv = async () => {
    setExporting(true);
    setExportError(null);
    try {
      const all: Session[] = [];
      let current = 1;
      let total = Infinity;
      while (all.length < total) {
        const result = await api<Paginated<Session>>(
          `/sessions${queryString({ ...params, page: current, pageSize: 100 })}`,
        );
        all.push(...result.items);
        total = result.total;
        if (!result.items.length) break;
        current++;
      }
      const rows: unknown[][] = [
        [
          'Sessão',
          'Data',
          'Treino',
          'Semana',
          'Foco',
          'Status',
          'Exercício',
          'Tipo',
          'Série',
          'Carga kg',
          'Base',
          'Repetições',
          'RIR',
          'Concluída',
          'Observações',
        ],
      ];
      for (const s of all)
        for (const e of s.exercises)
          for (const a of e.sets)
            rows.push([
              s.id,
              s.startedAt,
              s.nameSnapshot,
              s.weekNumberSnapshot,
              s.focusSnapshot,
              s.status,
              e.exerciseNameSnapshot,
              a.setType,
              a.setNumber,
              a.weight,
              a.weightBasis,
              a.actualReps,
              a.rir,
              a.completed,
              a.notes,
            ]);
      const url = URL.createObjectURL(
        new Blob(
          ['\uFEFF' + rows.map((r) => r.map(csvCell).join(';')).join('\r\n')],
          { type: 'text/csv;charset=utf-8' },
        ),
      );
      const link = document.createElement('a');
      link.href = url;
      link.download = 'hypertrophy-historico.csv';
      link.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setExportError(e instanceof Error ? e : new Error('Falha ao exportar.'));
    } finally {
      setExporting(false);
    }
  };
  const sessions = q.data?.items ?? [];
  return (
    <>
      <PageTitle
        eyebrow="SEU ESFORÇO FICA REGISTRADO"
        title="Histórico de treinamento"
        description="Revisite suas sessões, compare resultados e acompanhe sua consistência."
        action={
          <button disabled={exporting} onClick={() => void exportCsv()}>
            <Download size={17} />
            {exporting ? 'Exportando…' : 'Exportar CSV'}
          </button>
        }
      />
      <div className="filters">
        <label>
          De
          <input
            aria-label="Data inicial"
            type="date"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              setPage(1);
            }}
          />
        </label>
        <label>
          Até
          <input
            aria-label="Data final"
            type="date"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              setPage(1);
            }}
          />
        </label>
        <select
          aria-label="Filtrar foco"
          value={focus}
          onChange={(e) => {
            setFocus(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Semanas A e B</option>
          <option>A</option>
          <option>B</option>
        </select>
        <select
          aria-label="Filtrar exercício"
          value={exercise}
          onChange={(e) => {
            setExercise(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Todos os exercícios</option>
          {catalog.data?.items.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>
        <select
          aria-label="Filtrar grupo muscular"
          value={muscle}
          onChange={(e) => {
            setMuscle(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Todos os grupos</option>
          {muscles.data?.map((m) => (
            <option key={m.id} value={m.name}>
              {m.name}
            </option>
          ))}
        </select>
        <button
          disabled={selected.length !== 2}
          onClick={() => setComparing(true)}
        >
          Comparar {selected.length}/2
        </button>
      </div>
      <ErrorMessage error={q.error ?? exportError} />
      {q.isPending ? (
        <p>Carregando histórico…</p>
      ) : sessions.length ? (
        <section className="panel table-scroll">
          <table>
            <thead>
              <tr>
                <th>Comparar</th>
                <th>Data</th>
                <th>Treino</th>
                <th>Semana</th>
                <th>Séries</th>
                <th>Volume</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s.id}>
                  <td>
                    <input
                      aria-label={`Comparar sessão ${s.nameSnapshot} ${date(s.startedAt)}`}
                      type="checkbox"
                      checked={selected.includes(s.id)}
                      disabled={
                        !selected.includes(s.id) && selected.length === 2
                      }
                      onChange={() =>
                        setSelected((old) =>
                          old.includes(s.id)
                            ? old.filter((id) => id !== s.id)
                            : [...old, s.id],
                        )
                      }
                    />
                  </td>
                  <td>{date(s.startedAt)}</td>
                  <td>
                    <strong>{s.nameSnapshot}</strong>
                  </td>
                  <td>
                    {s.weekNumberSnapshot} · {s.focusSnapshot}
                  </td>
                  <td>
                    {
                      s.exercises
                        .flatMap((e) => e.sets)
                        .filter((a) => a.completed && a.setType === 'work')
                        .length
                    }
                  </td>
                  <td>{number(totalVolume(s))} kg</td>
                  <td>
                    <span className="tiny-badge">
                      {s.status === 'completed'
                        ? 'Concluído'
                        : s.status === 'paused'
                          ? 'Pausado'
                          : 'Em andamento'}
                    </span>
                  </td>
                  <td>
                    <Link
                      aria-label="Ver detalhes da sessão"
                      to={`/sessao/${s.id}`}
                    >
                      <ArrowUpRight size={20} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : (
        <Empty title="Seu histórico começa no primeiro treino.">
          <p>As sessões registradas aparecerão aqui.</p>
          <Link className="primary" to="/iniciar">
            Iniciar um treino
          </Link>
        </Empty>
      )}
      <div className="pagination">
        <button
          disabled={page === 1}
          onClick={() => {
            setPage(page - 1);
            setSelected([]);
          }}
        >
          Anterior
        </button>
        <span>
          Página {page} · {q.data?.total ?? 0} sessões
        </span>
        <button
          disabled={page * 20 >= (q.data?.total ?? 0)}
          onClick={() => {
            setPage(page + 1);
            setSelected([]);
          }}
        >
          Próxima
        </button>
      </div>
      {comparing && (
        <Comparison ids={selected} onClose={() => setComparing(false)} />
      )}
    </>
  );
}
function Comparison({ ids, onClose }: { ids: string[]; onClose: () => void }) {
  const q = useQuery({
    queryKey: ['comparison', ids],
    queryFn: () =>
      Promise.all(ids.map((id) => api<Session>(`/sessions/${id}`))),
  });
  return (
    <Modal title="Comparar sessões" onClose={onClose}>
      <p className="muted">
        Compare cargas apenas do mesmo exercício e da mesma base. Volume total
        não indica isoladamente estímulo hipertrófico.
      </p>
      <ErrorMessage error={q.error} />
      <div className="compare-grid">
        {q.data?.map((s) => (
          <div key={s.id}>
            <h3>{s.nameSnapshot}</h3>
            <p>
              {date(s.startedAt)} · Semana {s.weekNumberSnapshot}
              {s.focusSnapshot}
            </p>
            {s.exercises.map((e) => (
              <div className="compare-exercise" key={e.id}>
                <strong>{e.exerciseNameSnapshot}</strong>
                {e.sets
                  .filter((a) => a.setType === 'work')
                  .map((a) => (
                    <p key={a.id}>
                      {a.completed
                        ? `${a.weight} kg (${a.weightBasis}) × ${a.actualReps} · ${a.rir} RIR`
                        : 'Não concluída'}
                    </p>
                  ))}
              </div>
            ))}
          </div>
        ))}
      </div>
    </Modal>
  );
}
