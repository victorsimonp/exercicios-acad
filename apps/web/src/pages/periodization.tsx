import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import type { Program, Week } from '@ht/shared';
import { Archive, Copy, Plus, RotateCcw } from 'lucide-react';
import { useTraining } from '../app/context';
import { api } from '../services/api';
import { ErrorMessage, Modal, PageTitle } from '../components/common';
export function PeriodizationPage() {
  const { programs, program, weekNumber, refresh, setProgramId } =
    useTraining();
  const [editing, setEditing] = useState(false);
  const [confirmation, setConfirmation] = useState<{
    id: string;
    action: string;
  } | null>(null);
  const mutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: string }) =>
      api<{ id: string }>(
        action === 'create' ? '/programs' : `/programs/${id}/${action}`,
        'POST',
      ),
    onSuccess: async (result) => {
      setProgramId(result.id);
      setConfirmation(null);
      await refresh();
    },
  });
  return (
    <>
      <PageTitle
        eyebrow="PLANEJE. EXECUTE. EVOLUA."
        title="Periodização"
        description="Equilibre volume, intensidade e recuperação ao longo do ciclo."
        action={
          <button
            className="primary"
            disabled={mutation.isPending}
            onClick={() => mutation.mutate({ id: '', action: 'create' })}
          >
            <Plus size={17} />
            Novo programa
          </button>
        }
      />
      <ErrorMessage error={mutation.error} />
      {program && (
        <>
          <section className="panel">
            <div className="section-heading">
              <div>
                <span className="eyebrow">CICLO ATIVO</span>
                <h2>{program.name}</h2>
                <p>
                  {program.totalWeeks} semanas · Início{' '}
                  {new Date(program.startDate).toLocaleDateString('pt-BR')}
                </p>
              </div>
              <button onClick={() => setEditing(true)}>Editar ciclo</button>
            </div>
            <div className="week-grid">
              {program.weeks
                .filter((w) => w.weekNumber <= program.totalWeeks)
                .map((w) => (
                  <article
                    className={`week-card ${w.weekNumber === weekNumber ? 'current-week' : ''} ${w.isDeload ? 'deload' : ''}`}
                    key={w.id}
                  >
                    <small>SEMANA {w.weekNumber}</small>
                    <strong>{w.focus}</strong>
                    <span>
                      {w.volumeRule === 'target'
                        ? 'Séries-alvo'
                        : `${w.setsOverride} séries / exercício`}
                    </span>
                    <span>
                      {w.rirMin}–{w.rirMax} RIR
                    </span>
                    <small>
                      {w.isDeload
                        ? 'DELOAD'
                        : w.weekNumber <= 2
                          ? 'ADAPTAÇÃO'
                          : 'DESENVOLVIMENTO'}
                    </small>
                  </article>
                ))}
            </div>
            <div className="button-group">
              <button
                onClick={() =>
                  setConfirmation({ id: program.id, action: 'duplicate' })
                }
              >
                <Copy size={16} />
                Duplicar ciclo
              </button>
              <button
                onClick={() =>
                  setConfirmation({ id: program.id, action: 'restart' })
                }
              >
                <RotateCcw size={16} />
                Reiniciar ciclo
              </button>
              <button
                onClick={() =>
                  setConfirmation({ id: program.id, action: 'archive' })
                }
              >
                <Archive size={16} />
                Arquivar
              </button>
            </div>
          </section>
          <div className="notice">
            Semanas 1–2: duas séries por exercício. Semanas 3–7: volume-alvo
            individual. Semana 8: deload com volume reduzido e 3–4 RIR. O foco
            alterna A/B; todos os parâmetros são editáveis.
          </div>
        </>
      )}
      <section className="panel">
        <h2>Seus ciclos</h2>
        {programs.map((p) => (
          <div className="cycle-history" key={p.id}>
            <div>
              <strong>{p.name}</strong>
              <p>
                {p.totalWeeks} semanas ·{' '}
                {p.status === 'active' ? 'Ativo' : 'Arquivado'} ·{' '}
                {new Date(p.startDate).toLocaleDateString('pt-BR')}
              </p>
            </div>
            {p.status === 'active' && p.id !== program?.id && (
              <button onClick={() => setProgramId(p.id)}>Selecionar</button>
            )}
            <button
              onClick={() => setConfirmation({ id: p.id, action: 'duplicate' })}
            >
              <Copy size={15} />
              Duplicar
            </button>
          </div>
        ))}
      </section>
      {editing && program && (
        <CycleEditor
          program={program}
          onClose={() => setEditing(false)}
          onSaved={refresh}
        />
      )}
      {confirmation && (
        <Modal
          title={
            confirmation.action === 'archive'
              ? 'Arquivar ciclo?'
              : confirmation.action === 'restart'
                ? 'Reiniciar ciclo?'
                : 'Duplicar ciclo?'
          }
          onClose={() => setConfirmation(null)}
        >
          <p>
            {confirmation.action === 'restart'
              ? 'O ciclo atual será arquivado e uma nova cópia começará hoje.'
              : confirmation.action === 'duplicate'
                ? 'Uma cópia do modelo será criada com início hoje.'
                : 'O programa deixará de aparecer na seleção de treinos ativos.'}{' '}
            Todas as sessões e resultados serão preservados.
          </p>
          <ErrorMessage error={mutation.error} />
          <button
            className="primary"
            disabled={mutation.isPending}
            onClick={() => mutation.mutate(confirmation)}
          >
            Confirmar
          </button>
        </Modal>
      )}
    </>
  );
}
function CycleEditor({
  program,
  onClose,
  onSaved,
}: {
  program: Program;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [weeks, setWeeks] = useState(
    program.weeks.filter((w) => w.weekNumber <= program.totalWeeks),
  );
  const [total, setTotal] = useState(program.totalWeeks);
  const [name, setName] = useState(program.name);
  const [start, setStart] = useState(program.startDate.slice(0, 10));
  const mutation = useMutation({
    mutationFn: async () => {
      await api(`/periodization/${program.id}`, 'PATCH', {
        totalWeeks: total,
        weeks,
      });
      await api(`/programs/${program.id}`, 'PATCH', {
        name,
        startDate: `${start}T03:00:00.000Z`,
      });
    },
    onSuccess: async () => {
      await onSaved();
      onClose();
    },
  });
  const changeTotal = (n: number) => {
    setTotal(n);
    setWeeks((old) =>
      Array.from(
        { length: n },
        (_, i) =>
          old[i] ?? {
            id: `new-${i}`,
            weekNumber: i + 1,
            focus: i % 2 ? 'B' : 'A',
            isDeload: false,
            rirMin: 1,
            rirMax: 2,
            volumeRule: 'target',
            setsOverride: null,
          },
      ),
    );
  };
  const update = (i: number, patch: Partial<Week>) =>
    setWeeks((old) =>
      old.map((w, index) => (index === i ? { ...w, ...patch } : w)),
    );
  return (
    <Modal title="Editar periodização" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate();
        }}
      >
        <label>
          Nome do programa
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <div className="form-grid">
          <label>
            Data de início
            <input
              required
              type="date"
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
          </label>
          <label>
            Total de semanas
            <input
              type="number"
              min="1"
              max="52"
              required
              value={total}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (n >= 1 && n <= 52) changeTotal(n);
              }}
            />
          </label>
        </div>
        <div className="table-scroll">
          <table className="cycle-table">
            <thead>
              <tr>
                <th>Semana</th>
                <th>Foco</th>
                <th>Volume</th>
                <th>Séries</th>
                <th>RIR mín.</th>
                <th>RIR máx.</th>
                <th>Deload</th>
              </tr>
            </thead>
            <tbody>
              {weeks.map((w, i) => (
                <tr key={w.id}>
                  <td>{w.weekNumber}</td>
                  <td>
                    <select
                      aria-label={`Foco semana ${w.weekNumber}`}
                      value={w.focus}
                      onChange={(e) => update(i, { focus: e.target.value })}
                    >
                      <option>A</option>
                      <option>B</option>
                    </select>
                  </td>
                  <td>
                    <select
                      aria-label={`Regra semana ${w.weekNumber}`}
                      value={w.volumeRule}
                      onChange={(e) =>
                        update(i, {
                          volumeRule: e.target.value,
                          setsOverride: e.target.value === 'target' ? null : 2,
                        })
                      }
                    >
                      <option value="target">Alvo</option>
                      <option value="fixed">Fixo</option>
                      <option value="deload">Deload</option>
                    </select>
                  </td>
                  <td>
                    <input
                      aria-label={`Séries semana ${w.weekNumber}`}
                      type="number"
                      min="1"
                      max="20"
                      disabled={w.volumeRule === 'target'}
                      value={w.setsOverride ?? ''}
                      onChange={(e) =>
                        update(i, { setsOverride: Number(e.target.value) })
                      }
                    />
                  </td>
                  <td>
                    <input
                      aria-label={`RIR mínimo semana ${w.weekNumber}`}
                      type="number"
                      min="0"
                      max="10"
                      value={w.rirMin}
                      onChange={(e) =>
                        update(i, { rirMin: Number(e.target.value) })
                      }
                    />
                  </td>
                  <td>
                    <input
                      aria-label={`RIR máximo semana ${w.weekNumber}`}
                      type="number"
                      min="0"
                      max="10"
                      value={w.rirMax}
                      onChange={(e) =>
                        update(i, { rirMax: Number(e.target.value) })
                      }
                    />
                  </td>
                  <td>
                    <input
                      aria-label={`Deload semana ${w.weekNumber}`}
                      type="checkbox"
                      checked={w.isDeload}
                      onChange={(e) =>
                        update(i, { isDeload: e.target.checked })
                      }
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted">
          Sessões existentes mantêm a prescrição original. As alterações valem
          ao iniciar novas sessões.
        </p>
        <ErrorMessage error={mutation.error} />
        <button className="primary" disabled={mutation.isPending}>
          Salvar ciclo
        </button>
      </form>
    </Modal>
  );
}
